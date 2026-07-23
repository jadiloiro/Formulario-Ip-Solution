import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

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
