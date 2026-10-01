import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';

@Injectable()
export class PassengerGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const user = await this.auth.current(req.session?.userId);
    if (user.role !== 'USER' && user.role !== 'ADMIN')
      throw new ForbiddenException('Tài khoản không có quyền truy cập.');
    return true;
  }
}
