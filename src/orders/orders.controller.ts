import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  ParseFilePipeBuilder,
  UseGuards
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import type { AuthContext } from '../auth/auth.types';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { UpdateCheckpointDto } from './dto/update-checkpoint.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { maxAttachmentSizeBytes } from './order-operations';
import { OrdersService, type UploadedMemoryFile } from './orders.service';

@Controller('orders')
@UseGuards(SupabaseAuthGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequirePermissions('orders:read')
  findAll(@CurrentAuth() auth: AuthContext) {
    return this.ordersService.findAll(auth);
  }

  @Post()
  @RequirePermissions('orders:write')
  create(@CurrentAuth() auth: AuthContext, @Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto, auth);
  }

  @Patch(':id')
  @RequirePermissions('orders:write')
  update(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.ordersService.update(id, updateOrderDto, auth);
  }

  @Patch(':id/status')
  @RequirePermissions('orders:write')
  updateStatus(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Body() updateOrderStatusDto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, updateOrderStatusDto, auth);
  }

  @Patch(':id/checkpoints/:checkpointKey')
  @RequirePermissions('checkpoints:write')
  updateCheckpoint(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Param('checkpointKey') checkpointKey: string,
    @Body() updateCheckpointDto: UpdateCheckpointDto
  ) {
    return this.ordersService.updateCheckpoint(id, checkpointKey, updateCheckpointDto, auth);
  }

  @Post(':id/attachments')
  @RequirePermissions('attachments:write')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadAttachment(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: maxAttachmentSizeBytes })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY })
    )
    file: UploadedMemoryFile,
    @Body('kind') kind: 'photo' | 'signature',
    @Body('clientAttachmentId') clientAttachmentId?: string,
    @Body('capturedAt') capturedAt?: string
  ) {
    return this.ordersService.uploadAttachment(
      id,
      file,
      {
        kind,
        clientAttachmentId,
        capturedAt
      },
      auth
    );
  }

  @Get(':id/attachments')
  @RequirePermissions('attachments:read')
  listAttachments(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.ordersService.listAttachments(id, auth);
  }

  @Get(':id/attachments/:attachmentId/file')
  @RequirePermissions('attachments:read')
  async downloadAttachment(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Param('attachmentId') attachmentId: string) {
    const file = await this.ordersService.openAttachmentFile(id, attachmentId, auth);
    return new StreamableFile(file.stream, {
      type: file.contentType,
      disposition: `inline; filename="${file.filename}"`
    });
  }

  @Post(':id/payment-intents')
  @RequirePermissions('payments:write')
  createPaymentIntent(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Body() dto: CreatePaymentIntentDto) {
    return this.ordersService.createPaymentIntent(id, dto, auth);
  }
}
