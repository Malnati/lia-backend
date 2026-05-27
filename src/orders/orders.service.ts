import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Connection, Model } from 'mongoose';
import { Readable } from 'node:stream';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { UpdateCheckpointDto } from './dto/update-checkpoint.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import {
  applyCheckpointUpdate,
  applyOrderUpdate,
  createDefaultCheckpoints,
  isAllowedAttachmentMime,
  maxAttachmentSizeBytes
} from './order-operations';
import { canTransitionOrder } from './order-status';
import { MockPaymentProvider } from './payment/mock-payment.provider';
import type { PaymentIntent } from './payment/payment.types';
import { Order, type OrderDocument } from './schemas/order.schema';

export type UploadedMemoryFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
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

@Injectable()
export class OrdersService {
  private readonly paymentProvider = new MockPaymentProvider();

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectConnection() private readonly connection: Connection
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    const clientId = createOrderDto.clientId ?? createOrderDto.id;
    const existing = clientId ? await this.orderModel.findOne({ clientId }).exec() : null;

    if (existing) {
      applyOrderUpdate(existing, {
        customerName: createOrderDto.customerName,
        customerPhone: createOrderDto.customerPhone,
        deliveryAddress: createOrderDto.deliveryAddress,
        product: createOrderDto.product ?? 'Molde prótese',
        status: createOrderDto.status,
        paymentStatus: createOrderDto.paymentStatus,
        pendingSync: false,
        notes: createOrderDto.notes ?? ''
      });
      if (Array.isArray(createOrderDto.checkpoints)) {
        existing.checkpoints = createOrderDto.checkpoints as never;
      }
      existing.version = Math.max(existing.version, createOrderDto.version ?? existing.version);
      return existing.save();
    }

    const order = new this.orderModel({
      clientId,
      customerName: createOrderDto.customerName,
      customerPhone: createOrderDto.customerPhone,
      deliveryAddress: createOrderDto.deliveryAddress,
      product: createOrderDto.product ?? 'Molde prótese',
      status: createOrderDto.status ?? 'draft',
      paymentStatus: createOrderDto.paymentStatus ?? 'pending',
      notes: createOrderDto.notes ?? '',
      pendingSync: false,
      version: createOrderDto.version ?? 1,
      checkpoints: Array.isArray(createOrderDto.checkpoints)
        ? createOrderDto.checkpoints
        : createDefaultCheckpoints()
    });

    return order.save();
  }

  async findAll(): Promise<Order[]> {
    return this.orderModel.find().sort({ updatedAt: -1, createdAt: -1 }).exec();
  }

  async update(id: string, updateOrderDto: UpdateOrderDto): Promise<Order> {
    const order = await this.findByIdOrClientId(id);
    applyOrderUpdate(order, updateOrderDto);
    return order.save();
  }

  async updateStatus(id: string, updateOrderStatusDto: UpdateOrderStatusDto): Promise<Order> {
    const order = await this.findByIdOrClientId(id);

    if (!canTransitionOrder(order.status, updateOrderStatusDto.status)) {
      throw new BadRequestException(
        `Cannot transition order ${id} from ${order.status} to ${updateOrderStatusDto.status}`
      );
    }

    order.status = updateOrderStatusDto.status;
    order.version = (order.version ?? 0) + 1;
    return order.save();
  }

  async updateCheckpoint(id: string, checkpointKey: string, dto: UpdateCheckpointDto): Promise<Order> {
    const order = await this.findByIdOrClientId(id);
    applyCheckpointUpdate(order, checkpointKey, dto);
    return order.save();
  }

  async uploadAttachment(
    orderId: string,
    file: UploadedMemoryFile,
    metadata: { kind: 'photo' | 'signature'; clientAttachmentId?: string; capturedAt?: string }
  ): Promise<AttachmentMetadata> {
    await this.findByIdOrClientId(orderId);

    if (!isAllowedAttachmentMime(file.mimetype)) {
      throw new BadRequestException(`Unsupported attachment type ${file.mimetype}`);
    }
    if (file.size > maxAttachmentSizeBytes) {
      throw new BadRequestException(`Attachment exceeds ${maxAttachmentSizeBytes} bytes`);
    }

    const db = this.connection.db;
    if (!db) throw new BadRequestException('MongoDB connection is not ready');

    const bucket = new GridFSBucket(db, { bucketName: 'orderAttachments' });
    const capturedAt = metadata.capturedAt ?? new Date().toISOString();
    const uploadStream = bucket.openUploadStream(file.originalname, {
      metadata: {
        orderId,
        kind: metadata.kind,
        clientAttachmentId: metadata.clientAttachmentId,
        capturedAt,
        contentType: file.mimetype
      }
    });

    await new Promise<void>((resolve, reject) => {
      Readable.from(file.buffer)
        .on('error', reject)
        .pipe(uploadStream)
        .on('error', reject)
        .on('finish', () => resolve());
    });

    return {
      id: uploadStream.id.toString(),
      orderId,
      kind: metadata.kind,
      filename: file.originalname,
      contentType: file.mimetype,
      size: file.size,
      clientAttachmentId: metadata.clientAttachmentId,
      capturedAt
    };
  }

  async listAttachments(orderId: string): Promise<AttachmentMetadata[]> {
    await this.findByIdOrClientId(orderId);
    const db = this.connection.db;
    if (!db) throw new BadRequestException('MongoDB connection is not ready');

    const bucket = new GridFSBucket(db, { bucketName: 'orderAttachments' });
    const files = await bucket.find({ 'metadata.orderId': orderId }).toArray();

    return files.map((file) => ({
      id: file._id.toString(),
      orderId,
      kind: file.metadata?.kind,
      filename: file.filename,
      contentType: file.metadata?.contentType ?? 'application/octet-stream',
      size: file.length,
      clientAttachmentId: file.metadata?.clientAttachmentId,
      capturedAt: file.metadata?.capturedAt ?? file.uploadDate.toISOString()
    }));
  }

  async openAttachmentFile(orderId: string, attachmentId: string) {
    await this.findByIdOrClientId(orderId);
    const db = this.connection.db;
    if (!db) throw new BadRequestException('MongoDB connection is not ready');

    const bucket = new GridFSBucket(db, { bucketName: 'orderAttachments' });
    const objectId = new ObjectId(attachmentId);
    const [file] = await bucket.find({ _id: objectId, 'metadata.orderId': orderId }).toArray();
    if (!file) throw new NotFoundException(`Attachment ${attachmentId} not found`);

    return {
      stream: bucket.openDownloadStream(objectId),
      filename: file.filename,
      contentType: file.metadata?.contentType ?? 'application/octet-stream'
    };
  }

  async createPaymentIntent(orderId: string, dto: CreatePaymentIntentDto): Promise<PaymentIntent> {
    const order = await this.findByIdOrClientId(orderId);
    order.paymentStatus = 'mock_pending';
    order.version = (order.version ?? 0) + 1;
    await order.save();

    return this.paymentProvider.createIntent({
      orderId,
      amount: dto.amount ?? 0,
      currency: dto.currency ?? 'PYG'
    });
  }

  private async findByIdOrClientId(id: string): Promise<OrderDocument> {
    const order = ObjectId.isValid(id)
      ? await this.orderModel.findById(id).exec()
      : await this.orderModel.findOne({ clientId: id }).exec();

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    return order;
  }
}
