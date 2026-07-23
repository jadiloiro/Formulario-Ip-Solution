import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.repo.findOneBy({ login: dto.login });
    if (existing) throw new ConflictException(`Login "${dto.login}" já está em uso`);

    const user = this.repo.create({
      login: dto.login,
      passwordHash: await argon2.hash(dto.senha),
      clientName: dto.clientName ?? null,
      role: dto.role ?? 'cliente',
      moduleWhatsapp: dto.moduleWhatsapp ?? false,
      moduleTelefonia: dto.moduleTelefonia ?? false,
      mustChangePassword: true,
    });
    return this.repo.save(user);
  }

  findByLogin(login: string): Promise<User | null> {
    return this.repo.findOneBy({ login });
  }

  /** Lista de clientes para o painel da Implantação — nunca inclui contas super_admin. */
  findAllClients(): Promise<User[]> {
    return this.repo.find({ where: { role: 'cliente' }, order: { createdAt: 'DESC' } });
  }

  /** Só enxerga contas 'cliente' — o painel nunca edita/exclui um super_admin por aqui. */
  private async findClientOrThrow(id: string): Promise<User> {
    const user = await this.repo.findOneBy({ id, role: 'cliente' });
    if (!user) throw new NotFoundException(`Cliente ${id} não encontrado`);
    return user;
  }

  async updateClient(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findClientOrThrow(id);

    if (dto.login && dto.login !== user.login) {
      const existing = await this.repo.findOneBy({ login: dto.login });
      if (existing) throw new ConflictException(`Login "${dto.login}" já está em uso`);
      user.login = dto.login;
    }
    if (dto.clientName !== undefined) user.clientName = dto.clientName;
    if (dto.moduleWhatsapp !== undefined) user.moduleWhatsapp = dto.moduleWhatsapp;
    if (dto.moduleTelefonia !== undefined) user.moduleTelefonia = dto.moduleTelefonia;
    if (dto.novaSenha) {
      user.passwordHash = await argon2.hash(dto.novaSenha);
      user.mustChangePassword = true;
    }
    return this.repo.save(user);
  }

  async removeClient(id: string): Promise<void> {
    const user = await this.findClientOrThrow(id);
    await this.repo.remove(user);
  }

  findById(id: string): Promise<User | null> {
    return this.repo.findOneBy({ id });
  }

  async setPassword(id: string, novaSenha: string): Promise<void> {
    await this.repo.update(
      { id },
      { passwordHash: await argon2.hash(novaSenha), mustChangePassword: false },
    );
  }
}
