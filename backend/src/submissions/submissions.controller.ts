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
  Query,
} from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly service: SubmissionsService) {}

  /** Cria um novo levantamento */
  @Post()
  create(@Body() dto: CreateSubmissionDto) {
    return this.service.create(dto);
  }

  /** Lista todos (painel da equipe IP Solution) */
  @Get()
  findAll() {
    return this.service.findAll();
  }

  /** Rascunho atual: o frontend usa este endpoint como "sessão" de trabalho.
   *  sessionId identifica o navegador (gerado no frontend) para que atendentes
   *  simultâneos não caiam no mesmo rascunho. */
  @Get('current')
  current(@Query('sessionId') sessionId?: string) {
    return this.service.findOrCreateCurrent(sessionId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  /** Atualização parcial (formData e/ou flowData e/ou clientName) */
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSubmissionDto) {
    return this.service.update(id, dto);
  }

  /** Salva apenas o fluxo visual (chamado pelo editor Drawflow) */
  @Put(':id/flow')
  updateFlow(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFlowDto) {
    return this.service.updateFlow(id, dto.flowData);
  }

  /** Finaliza o levantamento */
  @Post(':id/submit')
  submit(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.submit(id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
