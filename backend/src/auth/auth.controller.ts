import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './login.dto.js';
import { RegisterDto } from './register.dto.js';
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const user = await this.auth.register(dto);
    await this.startSession(req, user.id);
    return user;
  }
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const user = await this.auth.login(dto.email, dto.password);
    await this.startSession(req, user.id);
    return user;
  }
  private async startSession(req: Request, userId: string) {
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((err) => (err ? reject(err) : resolve())),
    );
    req.session.userId = userId;
    await new Promise<void>((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve())),
    );
  }
  @Get('me') me(@Req() req: Request) {
    return this.auth.current(req.session?.userId);
  }
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await new Promise<void>((resolve, reject) =>
      req.session.destroy((err) => (err ? reject(err) : resolve())),
    );
    res.clearCookie('gobus.sid', {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
    });
    return { message: 'Đã đăng xuất.' };
  }
}
