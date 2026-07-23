import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService, SESSION_COOKIE_NAME, SESSION_TTL_MS } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SessionGuard } from './guards/session.guard';
import { SkipPasswordCheck } from './decorators/skip-password-check.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthUser } from './types/auth-user.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.authService.login(dto.login, dto.senha, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_TTL_MS,
    });

    return { user };
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  @SkipPasswordCheck()
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (token) await this.authService.logout(token);
    res.clearCookie(SESSION_COOKIE_NAME);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  @SkipPasswordCheck()
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }

  @Patch('change-password')
  @UseGuards(SessionGuard)
  @SkipPasswordCheck()
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(user, dto.senhaAtual, dto.novaSenha);
    return { ok: true };
  }
}
