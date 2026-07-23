import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubmissionsService } from './submissions.service';
import { Submission } from './entities/submission.entity';
import { AuthService } from '../auth/auth.service';
import { AuthUser } from '../auth/types/auth-user.interface';

const cliente = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 'user-a',
  login: 'cliente-a',
  role: 'cliente',
  clientName: 'Cliente A',
  moduleWhatsapp: true,
  moduleTelefonia: false,
  mustChangePassword: false,
  ...overrides,
});

const superAdmin = (): AuthUser => ({
  id: 'admin-1',
  login: 'implantacao',
  role: 'super_admin',
  clientName: null,
  moduleWhatsapp: true,
  moduleTelefonia: true,
  mustChangePassword: false,
});

describe('SubmissionsService', () => {
  let service: SubmissionsService;
  let repo: jest.Mocked<Repository<Submission>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmissionsService,
        {
          provide: getRepositoryToken(Submission),
          useValue: {
            create: jest.fn((data) => data),
            save: jest.fn(async (entity) => ({ id: 'generated-id', ...entity })),
            find: jest.fn(),
            findOneBy: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          // assertModuleAccess não usa os providers injetados: instância real testa a regra de fato
          provide: AuthService,
          useValue: new AuthService(null as never, null as never),
        },
      ],
    }).compile();

    service = module.get(SubmissionsService);
    repo = module.get(getRepositoryToken(Submission));
  });

  it('cria uma submissão com status "rascunho" por padrão, amarrada ao usuário', async () => {
    const result = await service.create({}, cliente());
    expect(result.status).toBe('rascunho');
    expect(result.userId).toBe('user-a');
  });

  it('recusa criar uma submissão de um módulo que o cliente não contratou', async () => {
    await expect(
      service.create({ onboardingType: 'telefonia' }, cliente({ moduleTelefonia: false })),
    ).rejects.toThrow(ForbiddenException);
  });

  describe('findOrCreateCurrent', () => {
    it('cria um rascunho novo quando o usuário ainda não tem nenhum', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.findOrCreateCurrent(cliente());

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { status: 'rascunho', userId: 'user-a' },
        order: { updatedAt: 'DESC' },
      });
      expect(result.userId).toBe('user-a');
    });

    it('isola por usuário: um cliente não enxerga o rascunho de outro', async () => {
      const draftA = { id: '1', userId: 'user-a', status: 'rascunho' } as Submission;
      repo.findOne.mockImplementation(async ({ where }: any) => {
        return where.userId === 'user-a' ? draftA : null;
      });

      const resultA = await service.findOrCreateCurrent(cliente({ id: 'user-a' }));
      const resultB = await service.findOrCreateCurrent(cliente({ id: 'user-b' }));

      expect(resultA).toBe(draftA);
      expect(resultB).not.toBe(draftA);
      expect(resultB.userId).toBe('user-b');
    });
  });

  describe('findOneForUser', () => {
    it('cliente comum só busca dentro do próprio userId', async () => {
      repo.findOneBy.mockResolvedValue(null);
      await expect(service.findOneForUser('outro-id', cliente())).rejects.toThrow(NotFoundException);
      expect(repo.findOneBy).toHaveBeenCalledWith({ id: 'outro-id', userId: 'user-a' });
    });

    it('super_admin busca por id sem restrição de dono', async () => {
      const submission = { id: '1', userId: 'user-b' } as Submission;
      repo.findOneBy.mockResolvedValue(submission);

      const result = await service.findOneForUser('1', superAdmin());

      expect(repo.findOneBy).toHaveBeenCalledWith({ id: '1' });
      expect(result).toBe(submission);
    });

    it('retorna 404 (não 403) quando o id existe mas pertence a outro cliente', async () => {
      repo.findOneBy.mockResolvedValue(null); // where já filtra por userId, então "não encontrado"
      await expect(service.findOneForUser('id-do-cliente-b', cliente())).rejects.toThrow(NotFoundException);
    });
  });

  describe('submit', () => {
    it('marca a submissão como "enviado"', async () => {
      const existing = { id: '1', userId: 'user-a', status: 'rascunho' } as Submission;
      repo.findOneBy.mockResolvedValue(existing);

      const result = await service.submit('1', cliente());

      expect(result.status).toBe('enviado');
    });

    it('lança NotFoundException se a submissão não existir', async () => {
      repo.findOneBy.mockResolvedValue(null);
      await expect(service.submit('inexistente', cliente())).rejects.toThrow(NotFoundException);
    });
  });
});
