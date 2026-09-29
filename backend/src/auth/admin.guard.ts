import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const user = await this.auth.current(req.session?.userId);
    if (user.role !== 'ADMIN')
      throw new ForbiddenException('Bạn cần quyền ADMIN để quản lý bến xe.');
    return true;
  }
}
