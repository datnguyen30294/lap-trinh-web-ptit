import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, type Repository } from 'typeorm';
import { compare, hash } from 'bcryptjs';
import { User } from './user.entity.js';
import type { RegisterDto } from './register.dto.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  // Comparable bcrypt work even when the email does not exist.
  private readonly dummyHash = hash('unusable-login-placeholder', 12);
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}
  async register(dto: RegisterDto) {
    if (dto.password !== dto.confirm_password)
      throw new BadRequestException('Xác nhận mật khẩu không khớp.');
    const duplicateMessage =
      'Email đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.';
    if (await this.users.existsBy({ email: dto.email }))
      throw new ConflictException(duplicateMessage);
    const user = this.users.create({
      full_name: dto.full_name,
      email: dto.email,
      password_hash: await hash(dto.password, 12),
      role: 'USER',
      is_active: true,
    });
    try {
      await this.users.save(user);
    } catch (error) {
      // The unique key also covers simultaneous requests for the same email.
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === 'ER_DUP_ENTRY'
      )
        throw new ConflictException(duplicateMessage);
      throw error;
    }
    this.logger.log(`Registered USER id=${user.id}`);
    return this.publicUser(user);
  }
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
