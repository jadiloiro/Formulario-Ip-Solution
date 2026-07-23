import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService, SESSION_COOKIE_NAME } from '../auth.service';
import { SKIP_PASSWORD_CHECK_KEY } from '../decorators/skip-password-check.decorator';

/** Autentica todo request pelo cookie de sessão (httpOnly) e popula `request.user`.
 *  Também bloqueia quem ainda não trocou a senha inicial, exceto nas rotas marcadas
 *  com @SkipPasswordCheck() — a obrigatoriedade é aplicada aqui, não só na UI. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.cookies?.[SESSION_COOKIE_NAME];
    if (!token) throw new UnauthorizedException('Não autenticado');

    const user = await this.authService.validateSession(token);
    request.user = user;

    const skipPasswordCheck = this.reflector.getAllAndOverride<boolean>(SKIP_PASSWORD_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (user.mustChangePassword && !skipPasswordCheck) {
      throw new ForbiddenException({ code: 'PASSWORD_CHANGE_REQUIRED', message: 'Troca de senha obrigatória' });
    }

    return true;
  }
}
