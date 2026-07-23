import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
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

  /** Painel de clientes da Implantação — nunca expõe passwordHash. */
  @Get()
  async findAll() {
    const users = await this.usersService.findAllClients();
    return users.map((u) => ({
      id: u.id,
      login: u.login,
      clientName: u.clientName,
      moduleWhatsapp: u.moduleWhatsapp,
      moduleTelefonia: u.moduleTelefonia,
      mustChangePassword: u.mustChangePassword,
      createdAt: u.createdAt,
    }));
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    const user = await this.usersService.updateClient(id, dto);
    return {
      id: user.id,
      login: user.login,
      clientName: user.clientName,
      moduleWhatsapp: user.moduleWhatsapp,
      moduleTelefonia: user.moduleTelefonia,
      mustChangePassword: user.mustChangePassword,
    };
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.removeClient(id);
  }
}
