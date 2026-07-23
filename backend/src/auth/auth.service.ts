import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { Session } from './entities/session.entity';
import { UsersService } from '../users/users.service';
import { AuthUser } from './types/auth-user.interface';

export const SESSION_COOKIE_NAME = 'ipsolution_session';
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8h

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Session)
    private readonly sessions: Repository<Session>,
    private readonly usersService: UsersService,
  ) {}

  /** Autentica login/senha e abre uma sessão nova (token opaco, persistido no banco). */
  async login(
    login: string,
    senha: string,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ token: string; user: AuthUser }> {
    const user = await this.usersService.findByLogin(login);
    // Mesma mensagem para login inexistente ou senha errada: não revela qual dos dois falhou.
    if (!user || !(await argon2.verify(user.passwordHash, senha))) {
      throw new UnauthorizedException('Login ou senha inválidos');
    }

    const token = randomBytes(32).toString('hex');
    await this.sessions.save(
      this.sessions.create({
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        userAgent: meta.userAgent ?? null,
        ip: meta.ip ?? null,
      }),
    );

    return { token, user: this.toAuthUser(user) };
  }

  async logout(token: string): Promise<void> {
    await this.sessions.update({ token }, { revokedAt: new Date() });
  }

  /** Valida o token do cookie contra a tabela de sessões e retorna o usuário atual. */
  async validateSession(token: string): Promise<AuthUser> {
    const session = await this.sessions.findOne({
      where: { token, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
    });
    if (!session) throw new UnauthorizedException('Sessão inválida ou expirada');

    const user = await this.usersService.findById(session.userId);
    if (!user) throw new UnauthorizedException('Sessão inválida ou expirada');

    return this.toAuthUser(user);
  }

  async changePassword(user: AuthUser, senhaAtual: string, novaSenha: string): Promise<void> {
    const dbUser = await this.usersService.findById(user.id);
    if (!dbUser || !(await argon2.verify(dbUser.passwordHash, senhaAtual))) {
      throw new UnauthorizedException('Senha atual incorreta');
    }
    await this.usersService.setPassword(user.id, novaSenha);
  }

  /** Barreira de RBAC por módulo: usada pelo submissions service antes de aceitar
   *  criação/edição de um levantamento de um tipo que o cliente não contratou. */
  assertModuleAccess(user: AuthUser, onboardingType?: string | null): void {
    if (!onboardingType || user.role === 'super_admin') return;
    const allowed =
      (onboardingType === 'whatsapp' && user.moduleWhatsapp) ||
      (onboardingType === 'telefonia' && user.moduleTelefonia);
    if (!allowed) {
      throw new ForbiddenException(`Seu contrato não inclui o módulo "${onboardingType}"`);
    }
  }

  private toAuthUser(user: {
    id: string;
    login: string;
    role: AuthUser['role'];
    clientName: string | null;
    moduleWhatsapp: boolean;
    moduleTelefonia: boolean;
    mustChangePassword: boolean;
  }): AuthUser {
    return {
      id: user.id,
      login: user.login,
      role: user.role,
      clientName: user.clientName,
      moduleWhatsapp: user.moduleWhatsapp,
      moduleTelefonia: user.moduleTelefonia,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
