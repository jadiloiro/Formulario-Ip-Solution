import { Controller, Get } from '@nestjs/common';

/** O frontend usa este endpoint para detectar se a API está no ar
 *  (e cair para o modo offline/localStorage caso contrário). */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'ipsolution-onboarding', timestamp: new Date().toISOString() };
  }
}
