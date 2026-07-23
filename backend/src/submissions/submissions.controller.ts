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
  Put,
  UseGuards,
} from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';
import { SessionGuard } from '../auth/guards/session.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.interface';

@Controller('submissions')
@UseGuards(SessionGuard, RolesGuard)
export class SubmissionsController {
  constructor(private readonly service: SubmissionsService) {}

  /** Cria um novo levantamento, sempre amarrado ao usuário autenticado */
  @Post()
  create(@Body() dto: CreateSubmissionDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  /** Lista todos (painel da equipe IP Solution) — só super_admin */
  @Get()
  @Roles('super_admin')
  findAll() {
    return this.service.findAll();
  }

  /** Rascunho atual do usuário autenticado: o frontend usa este endpoint como "sessão" de trabalho. */
  @Get('current')
  current(@CurrentUser() user: AuthUser) {
    return this.service.findOrCreateCurrent(user);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOneForUser(id, user);
  }

  /** Atualização parcial (formData e/ou flowData e/ou clientName) */
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubmissionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  /** Salva apenas o fluxo visual (chamado pelo editor Drawflow) */
  @Put(':id/flow')
  updateFlow(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFlowDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateFlow(id, dto.flowData, user);
  }

  /** Finaliza o levantamento */
  @Post(':id/submit')
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.submit(id, user);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}
