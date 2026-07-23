import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { AttachmentsService } from './attachments.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.interface';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB por arquivo

@Controller('submissions/:submissionId/attachments')
@UseGuards(SessionGuard)
export class AttachmentsController {
  constructor(private readonly service: AttachmentsService) {}

  @Get()
  list(@Param('submissionId', ParseUUIDPipe) submissionId: string, @CurrentUser() user: AuthUser) {
    return this.service.list(submissionId, user);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } }))
  upload(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('stepNumber') stepNumber: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    const parsedStep = stepNumber ? parseInt(stepNumber, 10) : undefined;
    return this.service.upload(submissionId, user, file, Number.isFinite(parsedStep) ? parsedStep : undefined);
  }

  @Get(':id/download')
  async download(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const { attachment, filePath } = await this.service.getForDownload(submissionId, id, user);
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(attachment.originalName)}"`,
    );
    res.sendFile(filePath);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.remove(submissionId, id, user);
  }
}
