import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
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
            find: jest.fn(),
            remove: jest.fn(async (entity) => entity),
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

  it('findAllClients só busca contas com role "cliente" (nunca super_admin)', async () => {
    repo.find.mockResolvedValue([]);

    await service.findAllClients();

    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: 'cliente' } }),
    );
  });

  describe('updateClient', () => {
    it('atualiza os campos informados de um cliente existente', async () => {
      repo.findOneBy.mockResolvedValueOnce({
        id: 'user-1',
        login: 'cliente-a',
        role: 'cliente',
        clientName: 'Antigo',
        moduleWhatsapp: false,
        moduleTelefonia: false,
        mustChangePassword: false,
      } as User);

      const result = await service.updateClient('user-1', { clientName: 'Novo Nome', moduleWhatsapp: true });

      expect(result.clientName).toBe('Novo Nome');
      expect(result.moduleWhatsapp).toBe(true);
      expect(repo.save).toHaveBeenCalled();
    });

    it('lança 404 ao tentar editar um id que não é cliente (ex.: super_admin ou inexistente)', async () => {
      repo.findOneBy.mockResolvedValueOnce(null);
      await expect(service.updateClient('nao-existe', { clientName: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('recusa trocar para um login já usado por outra conta', async () => {
      repo.findOneBy
        .mockResolvedValueOnce({ id: 'user-1', login: 'cliente-a', role: 'cliente' } as User)
        .mockResolvedValueOnce({ id: 'user-2', login: 'ja-existe' } as User);

      await expect(service.updateClient('user-1', { login: 'ja-existe' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('novaSenha troca o hash e força troca de senha no próximo login', async () => {
      repo.findOneBy.mockResolvedValueOnce({
        id: 'user-1',
        login: 'cliente-a',
        role: 'cliente',
        passwordHash: 'hash-antigo',
        mustChangePassword: false,
      } as User);

      const result = await service.updateClient('user-1', { novaSenha: 'outraSenha123' });

      expect(result.passwordHash).not.toBe('hash-antigo');
      expect(await argon2.verify(result.passwordHash, 'outraSenha123')).toBe(true);
      expect(result.mustChangePassword).toBe(true);
    });
  });

  describe('removeClient', () => {
    it('remove um cliente existente', async () => {
      const user = { id: 'user-1', role: 'cliente' } as User;
      repo.findOneBy.mockResolvedValueOnce(user);

      await service.removeClient('user-1');

      expect(repo.remove).toHaveBeenCalledWith(user);
    });

    it('lança 404 ao tentar remover um id que não é cliente', async () => {
      repo.findOneBy.mockResolvedValueOnce(null);
      await expect(service.removeClient('nao-existe')).rejects.toThrow(NotFoundException);
    });
  });
});
