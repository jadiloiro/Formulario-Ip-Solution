import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Submission } from './entities/submission.entity';
import { Attachment } from './entities/attachment.entity';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { AttachmentsService } from './attachments.service';
import { AttachmentsController } from './attachments.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Submission, Attachment]), AuthModule],
  controllers: [SubmissionsController, AttachmentsController],
  providers: [SubmissionsService, AttachmentsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
