import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { SessionGuard } from './guards/session.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

/** Provisionamento de contas de cliente — só a Implantação (super_admin) pode
 *  criar login/senha e definir os módulos contratados (WhatsApp/Telefonia). */
@Controller('users')
@UseGuards(SessionGuard, RolesGuard)
@Roles('super_admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(@Body() dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    return {
      id: user.id,
      login: user.login,
      clientName: user.clientName,
      role: user.role,
      moduleWhatsapp: user.moduleWhatsapp,
      moduleTelefonia: user.moduleTelefonia,
    };
  }
}
