import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Attachment } from './entities/attachment.entity';
import { SubmissionsService } from './submissions.service';
import { AuthUser } from '../auth/types/auth-user.interface';

/** Raiz onde os binários ficam em disco — nunca servida pelo ServeStaticModule
 *  (arquivo de cliente é dado sensível; só sai por download autenticado). */
const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment)
    private readonly repo: Repository<Attachment>,
    private readonly submissionsService: SubmissionsService,
  ) {}

  async list(submissionId: string, user: AuthUser): Promise<Attachment[]> {
    await this.submissionsService.findOneForUser(submissionId, user); // 404 se sem acesso
    return this.repo.find({ where: { submissionId }, order: { createdAt: 'DESC' } });
  }

  async upload(
    submissionId: string,
    user: AuthUser,
    file: Express.Multer.File | undefined,
    stepNumber: number | undefined,
  ): Promise<Attachment> {
    await this.submissionsService.findOneForUser(submissionId, user);
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');

    const dir = path.join(UPLOAD_ROOT, submissionId);
    fs.mkdirSync(dir, { recursive: true });
    const storedName = `${crypto.randomUUID()}${path.extname(file.originalname)}`;
    fs.writeFileSync(path.join(dir, storedName), file.buffer);

    const attachment = this.repo.create({
      submissionId,
      stepNumber: stepNumber ?? null,
      originalName: file.originalname,
      storedName,
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size,
    });
    return this.repo.save(attachment);
  }

  async getForDownload(
    submissionId: string,
    attachmentId: string,
    user: AuthUser,
  ): Promise<{ attachment: Attachment; filePath: string }> {
    await this.submissionsService.findOneForUser(submissionId, user);
    const attachment = await this.repo.findOneBy({ id: attachmentId, submissionId });
    if (!attachment) throw new NotFoundException(`Anexo ${attachmentId} não encontrado`);
    return { attachment, filePath: path.join(UPLOAD_ROOT, submissionId, attachment.storedName) };
  }

  async remove(submissionId: string, attachmentId: string, user: AuthUser): Promise<void> {
    await this.submissionsService.findOneForUser(submissionId, user);
    const attachment = await this.repo.findOneBy({ id: attachmentId, submissionId });
    if (!attachment) throw new NotFoundException(`Anexo ${attachmentId} não encontrado`);
    fs.rm(path.join(UPLOAD_ROOT, submissionId, attachment.storedName), { force: true }, () => {});
    await this.repo.remove(attachment);
  }
}
