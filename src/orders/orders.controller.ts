import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  ParseFilePipeBuilder
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { UpdateCheckpointDto } from './dto/update-checkpoint.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { maxAttachmentSizeBytes } from './order-operations';
import { OrdersService, type UploadedMemoryFile } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll() {
    return this.ordersService.findAll();
  }

  @Post()
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.ordersService.update(id, updateOrderDto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() updateOrderStatusDto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, updateOrderStatusDto);
  }

  @Patch(':id/checkpoints/:checkpointKey')
  updateCheckpoint(
    @Param('id') id: string,
    @Param('checkpointKey') checkpointKey: string,
    @Body() updateCheckpointDto: UpdateCheckpointDto
  ) {
    return this.ordersService.updateCheckpoint(id, checkpointKey, updateCheckpointDto);
  }

  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadAttachment(
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
    return this.ordersService.uploadAttachment(id, file, {
      kind,
      clientAttachmentId,
      capturedAt
    });
  }

  @Get(':id/attachments')
  listAttachments(@Param('id') id: string) {
    return this.ordersService.listAttachments(id);
  }

  @Get(':id/attachments/:attachmentId/file')
  async downloadAttachment(@Param('id') id: string, @Param('attachmentId') attachmentId: string) {
    const file = await this.ordersService.openAttachmentFile(id, attachmentId);
    return new StreamableFile(file.stream, {
      type: file.contentType,
      disposition: `inline; filename="${file.filename}"`
    });
  }

  @Post(':id/payment-intents')
  createPaymentIntent(@Param('id') id: string, @Body() dto: CreatePaymentIntentDto) {
    return this.ordersService.createPaymentIntent(id, dto);
  }
}
