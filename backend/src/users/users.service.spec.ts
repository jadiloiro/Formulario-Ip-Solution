import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            create: jest.fn((data) => data),
            save: jest.fn(async (entity) => ({ id: 'generated-id', ...entity })),
            findOneBy: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    repo = module.get(getRepositoryToken(User));
  });

  it('cria um cliente com a senha em hash (nunca em texto puro) e força troca no 1º acesso', async () => {
    repo.findOneBy.mockResolvedValue(null);

    const result = await service.create({ login: 'cliente-a', senha: 'segredo123', clientName: 'Cliente A' });

    expect(result.passwordHash).not.toBe('segredo123');
    expect(await argon2.verify(result.passwordHash, 'segredo123')).toBe(true);
    expect(result.mustChangePassword).toBe(true);
    expect(result.role).toBe('cliente');
  });

  it('recusa criar login duplicado', async () => {
    repo.findOneBy.mockResolvedValue({ id: 'existente' } as User);
    await expect(service.create({ login: 'ja-existe', senha: 'segredo123' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('setPassword troca o hash e derruba mustChangePassword', async () => {
    await service.setPassword('user-1', 'novaSenha123');

    expect(repo.update).toHaveBeenCalledWith(
      { id: 'user-1' },
      expect.objectContaining({ mustChangePassword: false }),
    );
  });
});
