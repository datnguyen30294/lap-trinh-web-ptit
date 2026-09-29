import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { compare, hash } from 'bcryptjs';
import { User } from './user.entity.js';

@Injectable()
export class AuthService {
  // Comparable bcrypt work even when the email does not exist.
  private readonly dummyHash = hash('unusable-login-placeholder', 12);
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}
  async login(email: string, password: string) {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.password_hash')
      .where('u.email = :email', { email })
      .getOne();
    const valid = await compare(
      password,
      user?.password_hash ?? (await this.dummyHash),
    );
    if (!user?.is_active || !valid)
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
    return this.publicUser(user);
  }
  async current(id?: string) {
    const user = id ? await this.users.findOneBy({ id }) : null;
    if (!user?.is_active)
      throw new UnauthorizedException(
        'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.',
      );
    return this.publicUser(user);
  }
  private publicUser(user: User) {
    return {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
    };
  }
}
