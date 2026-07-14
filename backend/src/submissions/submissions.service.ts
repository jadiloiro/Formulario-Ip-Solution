import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission } from './entities/submission.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Submission)
    private readonly repo: Repository<Submission>,
  ) {}

  create(dto: CreateSubmissionDto): Promise<Submission> {
    const submission = this.repo.create({ ...dto, status: dto.status ?? 'rascunho' });
    return this.repo.save(submission);
  }

  findAll(): Promise<Submission[]> {
    return this.repo.find({ order: { updatedAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Submission> {
    const submission = await this.repo.findOneBy({ id });
    if (!submission) throw new NotFoundException(`Submissão ${id} não encontrada`);
    return submission;
  }

  /**
   * "current": o rascunho mais recente ainda não enviado.
   * Se não existir, cria um vazio — assim o frontend sempre tem onde salvar.
   */
  async findOrCreateCurrent(): Promise<Submission> {
    const current = await this.repo.findOne({
      where: { status: 'rascunho' },
      order: { updatedAt: 'DESC' },
    });
    if (current) return current;
    return this.repo.save(this.repo.create({}));
  }

  async update(id: string, dto: UpdateSubmissionDto): Promise<Submission> {
    const submission = await this.findOne(id);
    Object.assign(submission, dto);
    return this.repo.save(submission);
  }

  async updateFlow(id: string, flowData: Record<string, unknown>): Promise<Submission> {
    const submission = await this.findOne(id);
    submission.flowData = flowData;
    return this.repo.save(submission);
  }

  /** Marca o levantamento como enviado (fim do onboarding) */
  async submit(id: string): Promise<Submission> {
    const submission = await this.findOne(id);
    submission.status = 'enviado';
    return this.repo.save(submission);
  }

  async remove(id: string): Promise<void> {
    const submission = await this.findOne(id);
    await this.repo.remove(submission);
  }
}
