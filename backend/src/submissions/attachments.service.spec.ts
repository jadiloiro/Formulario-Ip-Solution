import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import { AttachmentsService } from './attachments.service';
import { Attachment } from './entities/attachment.entity';
import { SubmissionsService } from './submissions.service';
import { AuthUser } from '../auth/types/auth-user.interface';

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: () => 'fixed-uuid',
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  rm: jest.fn((...args: unknown[]) => {
    const cb = args[args.length - 1] as (err: NodeJS.ErrnoException | null) => void;
    cb(null);
  }),
}));

const cliente = (): AuthUser => ({
  id: 'user-a',
  login: 'cliente-a',
  role: 'cliente',
  clientName: 'Cliente A',
  moduleWhatsapp: true,
  moduleTelefonia: false,
  mustChangePassword: false,
});

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let repo: jest.Mocked<Repository<Attachment>>;
  let submissionsService: jest.Mocked<Pick<SubmissionsService, 'findOneForUser'>>;

  beforeEach(async () => {
    submissionsService = { findOneForUser: jest.fn().mockResolvedValue({ id: 'sub-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        {
          provide: getRepositoryToken(Attachment),
          useValue: {
            create: jest.fn((data) => data),
            save: jest.fn(async (entity) => ({ id: 'attachment-1', ...entity })),
            find: jest.fn(),
            findOneBy: jest.fn(),
            remove: jest.fn(),
            count: jest.fn().mockResolvedValue(0),
          },
        },
        { provide: SubmissionsService, useValue: submissionsService },
      ],
    }).compile();

    service = module.get(AttachmentsService);
    repo = module.get(getRepositoryToken(Attachment));
    jest.clearAllMocks();
  });

  it('list() confere o dono do levantamento antes de listar (404 encerra o acesso cruzado)', async () => {
    repo.find.mockResolvedValue([]);
    await service.list('sub-1', cliente());
    expect(submissionsService.findOneForUser).toHaveBeenCalledWith('sub-1', cliente());
    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { submissionId: 'sub-1' } }),
    );
  });

  it('upload() recusa quando nenhum arquivo foi enviado', async () => {
    await expect(service.upload('sub-1', cliente(), undefined, undefined)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('upload() grava o binário em disco com nome gerado e salva os metadados', async () => {
    const file = {
      originalname: 'planilha.csv',
      mimetype: 'text/csv',
      size: 42,
      buffer: Buffer.from('a,b\n1,2'),
    } as Express.Multer.File;

    const attachment = await service.upload('sub-1', cliente(), file, 6);

    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('fixed-uuid.csv'),
      file.buffer,
    );
    expect(attachment).toMatchObject({
      submissionId: 'sub-1',
      stepNumber: 6,
      originalName: 'planilha.csv',
      storedName: 'fixed-uuid.csv',
      mimeType: 'text/csv',
      size: 42,
    });
  });

  it('upload() recusa quando a etapa já atingiu o limite de arquivos', async () => {
    repo.count.mockResolvedValue(5);
    const file = {
      originalname: 'mais-um.csv',
      mimetype: 'text/csv',
      size: 10,
      buffer: Buffer.from('a'),
    } as Express.Multer.File;

    await expect(service.upload('sub-1', cliente(), file, 6)).rejects.toThrow(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('getForDownload() lança 404 quando o anexo não pertence ao levantamento', async () => {
    repo.findOneBy.mockResolvedValue(null);
    await expect(service.getForDownload('sub-1', 'anexo-x', cliente())).rejects.toThrow(
      NotFoundException,
    );
  });

  it('remove() apaga o arquivo em disco e a linha no banco', async () => {
    repo.findOneBy.mockResolvedValue({ id: 'anexo-1', storedName: 'fixed-uuid.csv' } as Attachment);

    await service.remove('sub-1', 'anexo-1', cliente());

    expect(fs.rm).toHaveBeenCalled();
    expect(repo.remove).toHaveBeenCalled();
  });
});
