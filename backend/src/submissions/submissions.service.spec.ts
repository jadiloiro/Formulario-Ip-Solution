import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubmissionsService } from './submissions.service';
import { Submission } from './entities/submission.entity';

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
      ],
    }).compile();

    service = module.get(SubmissionsService);
    repo = module.get(getRepositoryToken(Submission));
  });

  it('cria uma submissão com status "rascunho" por padrão', async () => {
    const result = await service.create({});
    expect(result.status).toBe('rascunho');
  });

  describe('findOrCreateCurrent', () => {
    it('cria um rascunho novo quando não existe nenhum para o sessionId', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.findOrCreateCurrent('sessao-A');

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { status: 'rascunho', sessionId: 'sessao-A' },
        order: { updatedAt: 'DESC' },
      });
      expect(result.sessionId).toBe('sessao-A');
    });

    it('isola sessões: um sessionId não enxerga o rascunho de outro', async () => {
      const draftA = { id: '1', sessionId: 'sessao-A', status: 'rascunho' } as Submission;
      repo.findOne.mockImplementation(async ({ where }: any) => {
        return where.sessionId === 'sessao-A' ? draftA : null;
      });

      const resultA = await service.findOrCreateCurrent('sessao-A');
      const resultB = await service.findOrCreateCurrent('sessao-B');

      expect(resultA).toBe(draftA);
      expect(resultB).not.toBe(draftA);
      expect(resultB.sessionId).toBe('sessao-B');
    });

    it('sem sessionId, cai no rascunho global mais recente (compatibilidade)', async () => {
      repo.findOne.mockResolvedValue(null);

      await service.findOrCreateCurrent();

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { status: 'rascunho' },
        order: { updatedAt: 'DESC' },
      });
    });
  });

  describe('submit', () => {
    it('marca a submissão como "enviado"', async () => {
      const existing = { id: '1', status: 'rascunho' } as Submission;
      repo.findOneBy.mockResolvedValue(existing);

      const result = await service.submit('1');

      expect(result.status).toBe('enviado');
    });

    it('lança NotFoundException se a submissão não existir', async () => {
      repo.findOneBy.mockResolvedValue(null);
      await expect(service.submit('inexistente')).rejects.toThrow(NotFoundException);
    });
  });
});
