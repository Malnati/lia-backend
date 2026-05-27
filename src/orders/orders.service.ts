import type { AuthContext } from '../auth/auth.types';
import { badRequest, notFound } from '../http-error';
import type { SupabaseService } from '../supabase/supabase.service';
import {
  applyCheckpointUpdate,
  applyOrderUpdate,
  createDefaultCheckpoints,
  isAllowedAttachmentMime,
  maxAttachmentSizeBytes
} from './order-operations';
import { canTransitionOrder } from './order-status';
import type { CreateOrderInput, Order, OrderCheckpoint, UpdateCheckpointInput, UpdateOrderInput } from './order.types';
import type { CreatePaymentIntentInput, PaymentIntent } from './payment/payment.types';

export type UploadedWorkerFile = {
  filename: string;
  contentType: string;
  size: number;
  data: ArrayBuffer;
};

export type AttachmentMetadata = {
  id: string;
  orderId: string;
  kind: 'photo' | 'signature';
  filename: string;
  contentType: string;
  size: number;
  clientAttachmentId?: string;
  capturedAt: string;
};

export type AttachmentFile = {
  data: ArrayBuffer;
  filename: string;
  contentType: string;
};

type OrderRow = {
  id: string;
  tenant_id: string;
  client_id?: string | null;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  product: string;
  status: Order['status'];
  payment_status: Order['paymentStatus'];
  pending_sync: boolean;
  notes: string;
  version: number;
  created_at?: string;
  updated_at?: string;
};

type CheckpointRow = {
  id: string;
  order_id: string;
  key: string;
  label: string;
  completed: boolean;
  actor?: string | null;
  occurred_at?: string | null;
  notes?: string | null;
};

type AttachmentRow = {
  id: string;
  order_id: string;
  kind: 'photo' | 'signature';
  filename: string;
  content_type: string;
  size_bytes: number;
  client_attachment_id?: string | null;
  captured_at?: string | null;
};

type AttachmentFileRow = AttachmentRow & { storage_path: string };

type PaymentIntentRow = {
  id: string;
  order_id: string;
  provider: 'pending_gateway' | 'external_gateway';
  amount: number;
  currency: 'PYG' | 'USD';
  status: PaymentIntent['status'];
  checkout_url?: string | null;
  created_at?: string;
};

export class OrdersService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(createOrderDto: CreateOrderInput, auth: AuthContext): Promise<Order> {
    const tenantId = auth.tenantId;
    const client = this.supabase.getUserClient(auth);
    const clientId = createOrderDto.clientId ?? createOrderDto.id;
    const existing = clientId ? await this.findRowByIdOrClientId(clientId, tenantId, auth, false) : null;

    if (existing) {
      const current = await this.rowToOrder(existing, auth);
      applyOrderUpdate(current, {
        customerName: createOrderDto.customerName,
        customerPhone: createOrderDto.customerPhone,
        deliveryAddress: createOrderDto.deliveryAddress,
        product: createOrderDto.product ?? 'Molde prótese',
        status: createOrderDto.status,
        paymentStatus: createOrderDto.paymentStatus,
        pendingSync: false,
        notes: createOrderDto.notes ?? ''
      });
      current.version = Math.max(current.version, createOrderDto.version ?? current.version);
      return this.persistOrder(current, auth);
    }

    const { data, error } = await client
      .from('orders')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        customer_name: createOrderDto.customerName,
        customer_phone: createOrderDto.customerPhone,
        delivery_address: createOrderDto.deliveryAddress,
        product: createOrderDto.product ?? 'Molde prótese',
        status: createOrderDto.status ?? 'draft',
        payment_status: createOrderDto.paymentStatus ?? 'pending',
        notes: createOrderDto.notes ?? '',
        pending_sync: false,
        version: createOrderDto.version ?? 1
      })
      .select('*')
      .single<OrderRow>();

    if (error) throw badRequest(error.message);

    const checkpoints = Array.isArray(createOrderDto.checkpoints)
      ? (createOrderDto.checkpoints as OrderCheckpoint[])
      : createDefaultCheckpoints();

    await this.replaceCheckpoints(data.id, tenantId, checkpoints, auth);
    return this.findByIdOrClientId(data.id, auth);
  }

  async findAll(auth: AuthContext): Promise<Order[]> {
    const { data, error } = await this.supabase
      .getUserClient(auth)
      .from('orders')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw badRequest(error.message);
    return Promise.all(((data ?? []) as OrderRow[]).map((row) => this.rowToOrder(row, auth)));
  }

  async update(id: string, updateOrderDto: UpdateOrderInput, auth: AuthContext): Promise<Order> {
    const order = await this.findByIdOrClientId(id, auth);
    applyOrderUpdate(order, updateOrderDto);
    return this.persistOrder(order, auth);
  }

  async updateStatus(id: string, status: Order['status'], auth: AuthContext): Promise<Order> {
    const order = await this.findByIdOrClientId(id, auth);

    if (!canTransitionOrder(order.status, status)) {
      throw badRequest(`Cannot transition order ${id} from ${order.status} to ${status}`);
    }

    order.status = status;
    order.version = (order.version ?? 0) + 1;
    return this.persistOrder(order, auth);
  }

  async updateCheckpoint(id: string, checkpointKey: string, dto: UpdateCheckpointInput, auth: AuthContext): Promise<Order> {
    const order = await this.findByIdOrClientId(id, auth);
    applyCheckpointUpdate(order, checkpointKey, dto);
    const checkpoint = order.checkpoints.find((item) => item.key === checkpointKey);
    if (!checkpoint || !order.id || !order.tenantId) throw badRequest('Invalid checkpoint update');

    const { error } = await this.supabase
      .getUserClient(auth)
      .from('order_checkpoints')
      .update({
        completed: checkpoint.completed,
        actor: checkpoint.actor ?? null,
        occurred_at: checkpoint.timestamp ? new Date(checkpoint.timestamp).toISOString() : null,
        notes: checkpoint.notes ?? null
      })
      .eq('tenant_id', order.tenantId)
      .eq('order_id', order.id)
      .eq('key', checkpointKey);

    if (error) throw badRequest(error.message);
    return this.persistOrder(order, auth);
  }

  async uploadAttachment(
    orderId: string,
    file: UploadedWorkerFile,
    metadata: { kind: 'photo' | 'signature'; clientAttachmentId?: string; capturedAt?: string },
    auth: AuthContext
  ): Promise<AttachmentMetadata> {
    const order = await this.findByIdOrClientId(orderId, auth);
    if (!order.id || !order.tenantId) throw badRequest('Order id is required');

    if (!isAllowedAttachmentMime(file.contentType)) {
      throw badRequest(`Unsupported attachment type ${file.contentType}`);
    }
    if (file.size > maxAttachmentSizeBytes) {
      throw badRequest(`Attachment exceeds ${maxAttachmentSizeBytes} bytes`);
    }

    const safeName = file.filename.replace(/[^a-zA-Z0-9._-]+/g, '-');
    const storagePath = `${order.tenantId}/${order.id}/${crypto.randomUUID()}-${safeName}`;
    const client = this.supabase.getServiceClient();
    const upload = await client.storage.from('order-attachments').upload(storagePath, file.data, {
      contentType: file.contentType,
      upsert: false
    });
    if (upload.error) throw badRequest(upload.error.message);

    const capturedAt = metadata.capturedAt ?? new Date().toISOString();
    const { data, error } = await this.supabase
      .getUserClient(auth)
      .from('attachments')
      .insert({
        tenant_id: order.tenantId,
        order_id: order.id,
        kind: metadata.kind,
        filename: file.filename,
        content_type: file.contentType,
        size_bytes: file.size,
        storage_bucket: 'order-attachments',
        storage_path: storagePath,
        client_attachment_id: metadata.clientAttachmentId,
        captured_at: capturedAt
      })
      .select('*')
      .single<AttachmentRow>();

    if (error) throw badRequest(error.message);
    return this.mapAttachment(data);
  }

  async listAttachments(orderId: string, auth: AuthContext): Promise<AttachmentMetadata[]> {
    const order = await this.findByIdOrClientId(orderId, auth);
    if (!order.id || !order.tenantId) throw badRequest('Order id is required');

    const { data, error } = await this.supabase
      .getUserClient(auth)
      .from('attachments')
      .select('*')
      .eq('tenant_id', order.tenantId)
      .eq('order_id', order.id)
      .order('captured_at', { ascending: false });

    if (error) throw badRequest(error.message);
    return ((data ?? []) as AttachmentRow[]).map((row) => this.mapAttachment(row));
  }

  async openAttachmentFile(orderId: string, attachmentId: string, auth: AuthContext): Promise<AttachmentFile> {
    const order = await this.findByIdOrClientId(orderId, auth);
    if (!order.id || !order.tenantId) throw badRequest('Order id is required');

    const { data: row, error } = await this.supabase
      .getUserClient(auth)
      .from('attachments')
      .select('*')
      .eq('tenant_id', order.tenantId)
      .eq('order_id', order.id)
      .eq('id', attachmentId)
      .single<AttachmentFileRow>();

    if (error || !row) throw notFound(`Attachment ${attachmentId} not found`);

    const download = await this.supabase.getServiceClient().storage.from('order-attachments').download(row.storage_path);
    if (download.error || !download.data) throw notFound(`Attachment ${attachmentId} file not found`);

    return {
      data: await download.data.arrayBuffer(),
      filename: row.filename,
      contentType: row.content_type
    };
  }

  async createPaymentIntent(orderId: string, dto: CreatePaymentIntentInput, auth: AuthContext): Promise<PaymentIntent> {
    const order = await this.findByIdOrClientId(orderId, auth);
    if (!order.id || !order.tenantId) throw badRequest('Order id is required');

    const { data, error } = await this.supabase
      .getUserClient(auth)
      .from('payment_intents')
      .insert({
        tenant_id: order.tenantId,
        order_id: order.id,
        provider: 'pending_gateway',
        amount: dto.amount ?? 0,
        currency: dto.currency ?? 'PYG',
        status: 'pending'
      })
      .select('*')
      .single<PaymentIntentRow>();

    if (error) throw badRequest(error.message);
    order.paymentStatus = 'pending';
    order.version = (order.version ?? 0) + 1;
    await this.persistOrder(order, auth);
    return this.mapPaymentIntent(data);
  }

  private async findByIdOrClientId(id: string, auth: AuthContext): Promise<Order> {
    const row = await this.findRowByIdOrClientId(id, auth.tenantId, auth, true);
    return this.rowToOrder(row, auth);
  }

  private async findRowByIdOrClientId(id: string, tenantId: string, auth: AuthContext, required: true): Promise<OrderRow>;
  private async findRowByIdOrClientId(id: string, tenantId: string, auth: AuthContext, required: false): Promise<OrderRow | null>;
  private async findRowByIdOrClientId(id: string, tenantId: string, auth: AuthContext, required: boolean): Promise<OrderRow | null> {
    const key = isUuid(id) ? 'id' : 'client_id';
    const query = this.supabase.getUserClient(auth).from('orders').select('*').eq('tenant_id', tenantId).eq(key, id);
    const { data, error } = await query.maybeSingle<OrderRow>();

    if (error) throw badRequest(error.message);
    if (!data && required) throw notFound(`Order ${id} not found`);
    return data ?? null;
  }

  private async persistOrder(order: Order, auth: AuthContext): Promise<Order> {
    if (!order.id || !order.tenantId) throw badRequest('Order id is required');
    const { data, error } = await this.supabase
      .getUserClient(auth)
      .from('orders')
      .update({
        customer_name: order.customerName,
        customer_phone: order.customerPhone,
        delivery_address: order.deliveryAddress,
        product: order.product,
        status: order.status,
        payment_status: order.paymentStatus,
        pending_sync: order.pendingSync,
        notes: order.notes,
        version: order.version
      })
      .eq('tenant_id', order.tenantId)
      .eq('id', order.id)
      .select('*')
      .single<OrderRow>();

    if (error) throw badRequest(error.message);
    return this.rowToOrder(data, auth);
  }

  private async rowToOrder(row: OrderRow, auth: AuthContext): Promise<Order> {
    const { data, error } = await this.supabase
      .getUserClient(auth)
      .from('order_checkpoints')
      .select('*')
      .eq('tenant_id', row.tenant_id)
      .eq('order_id', row.id)
      .order('created_at', { ascending: true });

    if (error) throw badRequest(error.message);

    return {
      id: row.id,
      tenantId: row.tenant_id,
      clientId: row.client_id ?? undefined,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      deliveryAddress: row.delivery_address,
      product: row.product,
      status: row.status,
      paymentStatus: row.payment_status,
      pendingSync: row.pending_sync,
      checkpoints: ((data ?? []) as CheckpointRow[]).map((checkpoint) => ({
        id: checkpoint.id,
        orderId: checkpoint.order_id,
        key: checkpoint.key,
        label: checkpoint.label,
        completed: checkpoint.completed,
        actor: checkpoint.actor ?? undefined,
        timestamp: checkpoint.occurred_at ?? undefined,
        notes: checkpoint.notes ?? undefined
      })),
      notes: row.notes,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private async replaceCheckpoints(orderId: string, tenantId: string, checkpoints: OrderCheckpoint[], auth: AuthContext): Promise<void> {
    const client = this.supabase.getUserClient(auth);
    await client.from('order_checkpoints').delete().eq('tenant_id', tenantId).eq('order_id', orderId);

    const { error } = await client.from('order_checkpoints').insert(
      checkpoints.map((checkpoint) => ({
        tenant_id: tenantId,
        order_id: orderId,
        key: checkpoint.key,
        label: checkpoint.label,
        completed: checkpoint.completed,
        actor: checkpoint.actor ?? null,
        occurred_at: checkpoint.timestamp ? new Date(checkpoint.timestamp).toISOString() : null,
        notes: checkpoint.notes ?? null
      }))
    );

    if (error) throw badRequest(error.message);
  }

  private mapAttachment(row: AttachmentRow): AttachmentMetadata {
    return {
      id: row.id,
      orderId: row.order_id,
      kind: row.kind,
      filename: row.filename,
      contentType: row.content_type,
      size: row.size_bytes,
      clientAttachmentId: row.client_attachment_id ?? undefined,
      capturedAt: row.captured_at ?? new Date().toISOString()
    };
  }

  private mapPaymentIntent(row: PaymentIntentRow): PaymentIntent {
    return {
      id: row.id,
      provider: row.provider,
      orderId: row.order_id,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      checkoutUrl: row.checkout_url ?? undefined,
      createdAt: row.created_at ?? new Date().toISOString()
    };
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}
