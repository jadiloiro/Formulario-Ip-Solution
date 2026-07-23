import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { Session } from './entities/session.entity';
import { UsersService } from '../users/users.service';
import { AuthUser } from './types/auth-user.interface';

describe('AuthService', () => {
  let service: AuthService;
  let sessions: jest.Mocked<Repository<Session>>;
  let usersService: jest.Mocked<UsersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(Session),
          useValue: {
            create: jest.fn((data) => data),
            save: jest.fn(async (entity) => entity),
            update: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findByLogin: jest.fn(),
            findById: jest.fn(),
            setPassword: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    sessions = module.get(getRepositoryToken(Session));
    usersService = module.get(UsersService);
  });

  describe('login', () => {
    it('abre sessão quando login/senha batem', async () => {
      const passwordHash = await argon2.hash('segredo123');
      usersService.findByLogin.mockResolvedValue({
        id: 'user-1',
        login: 'cliente-a',
        passwordHash,
        role: 'cliente',
        clientName: 'Cliente A',
        moduleWhatsapp: true,
        moduleTelefonia: false,
        mustChangePassword: false,
      } as any);

      const { token, user } = await service.login('cliente-a', 'segredo123', {});

      expect(token).toHaveLength(64);
      expect(user.id).toBe('user-1');
      expect(sessions.save).toHaveBeenCalled();
    });

    it('rejeita senha errada', async () => {
      usersService.findByLogin.mockResolvedValue({
        id: 'user-1',
        passwordHash: await argon2.hash('segredo123'),
      } as any);

      await expect(service.login('cliente-a', 'senha-errada', {})).rejects.toThrow(UnauthorizedException);
    });

    it('rejeita login inexistente com a mesma mensagem (não confirma se o login existe)', async () => {
      usersService.findByLogin.mockResolvedValue(null);
      await expect(service.login('nao-existe', 'qualquer', {})).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('assertModuleAccess', () => {
    const clienteWhatsapp: AuthUser = {
      id: 'user-1',
      login: 'cliente-a',
      role: 'cliente',
      clientName: null,
      moduleWhatsapp: true,
      moduleTelefonia: false,
      mustChangePassword: false,
    };

    it('permite quando o cliente tem o módulo contratado', () => {
      expect(() => service.assertModuleAccess(clienteWhatsapp, 'whatsapp')).not.toThrow();
    });

    it('bloqueia quando o cliente não tem o módulo contratado', () => {
      expect(() => service.assertModuleAccess(clienteWhatsapp, 'telefonia')).toThrow(ForbiddenException);
    });

    it('super_admin não é restrito por módulo', () => {
      const admin: AuthUser = { ...clienteWhatsapp, role: 'super_admin' };
      expect(() => service.assertModuleAccess(admin, 'telefonia')).not.toThrow();
    });

    it('sem onboardingType informado, não valida nada', () => {
      expect(() => service.assertModuleAccess(clienteWhatsapp, undefined)).not.toThrow();
    });
  });
});
