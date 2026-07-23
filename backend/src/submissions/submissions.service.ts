import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission } from './entities/submission.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';
import { AuthService } from '../auth/auth.service';
import { AuthUser } from '../auth/types/auth-user.interface';

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Submission)
    private readonly repo: Repository<Submission>,
    private readonly authService: AuthService,
  ) {}

  async create(dto: CreateSubmissionDto, user: AuthUser): Promise<Submission> {
    this.authService.assertModuleAccess(user, dto.onboardingType);
    const submission = this.repo.create({
      ...dto,
      userId: user.id,
      status: dto.status ?? 'rascunho',
    });
    return this.repo.save(submission);
  }

  /** Painel da equipe IP Solution — só chamado para usuários super_admin (guard no controller). */
  findAll(): Promise<Submission[]> {
    return this.repo.find({ order: { updatedAt: 'DESC' } });
  }

  /**
   * Busca por id sempre amarrada ao dono: um cliente comum só enxerga suas próprias
   * submissões, mesmo manipulando o id na URL. Retorna 404 (não 403) em caso de
   * acesso cross-tenant, para não confirmar a existência do recurso de outro cliente.
   */
  async findOneForUser(id: string, user: AuthUser): Promise<Submission> {
    const where = user.role === 'super_admin' ? { id } : { id, userId: user.id };
    const submission = await this.repo.findOneBy(where);
    if (!submission) throw new NotFoundException(`Submissão ${id} não encontrada`);
    return submission;
  }

  /**
   * "current": o rascunho mais recente ainda não enviado do usuário autenticado.
   * Se não existir, cria um vazio já amarrado a ele — assim o frontend sempre tem onde salvar.
   */
  async findOrCreateCurrent(user: AuthUser): Promise<Submission> {
    const current = await this.repo.findOne({
      where: { status: 'rascunho', userId: user.id },
      order: { updatedAt: 'DESC' },
    });
    if (current) return current;
    return this.repo.save(
      this.repo.create({
        userId: user.id,
        clientName: user.clientName ?? undefined,
      }),
    );
  }

  async update(id: string, dto: UpdateSubmissionDto, user: AuthUser): Promise<Submission> {
    const submission = await this.findOneForUser(id, user);
    this.authService.assertModuleAccess(user, dto.onboardingType ?? submission.onboardingType);
    Object.assign(submission, dto);
    return this.repo.save(submission);
  }

  async updateFlow(id: string, flowData: Record<string, unknown>, user: AuthUser): Promise<Submission> {
    const submission = await this.findOneForUser(id, user);
    submission.flowData = flowData;
    return this.repo.save(submission);
  }

  /** Marca o levantamento como enviado (fim do onboarding) */
  async submit(id: string, user: AuthUser): Promise<Submission> {
    const submission = await this.findOneForUser(id, user);
    submission.status = 'enviado';
    return this.repo.save(submission);
  }

  async remove(id: string, user: AuthUser): Promise<void> {
    const submission = await this.findOneForUser(id, user);
    await this.repo.remove(submission);
  }
}
