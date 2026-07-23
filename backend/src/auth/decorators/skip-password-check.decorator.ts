import { SetMetadata } from '@nestjs/common';

/** Rotas marcadas ficam acessíveis mesmo com `mustChangePassword: true`
 *  (ex.: a própria rota de trocar senha, e "quem sou eu"). */
export const SKIP_PASSWORD_CHECK_KEY = 'skipPasswordCheck';
export const SkipPasswordCheck = () => SetMetadata(SKIP_PASSWORD_CHECK_KEY, true);
