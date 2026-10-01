import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import session from 'express-session';
import { rateLimit } from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import './auth/session.types.js';

const validationMessages = (errors: ValidationError[]): string[] =>
  errors.flatMap((e) => [
    ...Object.entries(e.constraints ?? {}).map(([key, msg]) =>
      key === 'whitelistValidation'
        ? `Trường ${e.property} không được phép.`
        : msg,
    ),
    ...validationMessages(e.children ?? []),
  ]);

export function setupApp(app: INestApplication) {
  const config = app.get(ConfigService);
  const secret = config.getOrThrow<string>('SESSION_SECRET');
  if (secret.length < 32)
    throw new Error('SESSION_SECRET cần ít nhất 32 ký tự.');
  const origin = config.get<string>('WEB_ORIGIN', 'http://localhost:5173');
  app.enableCors({
    origin,
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-GoBus-Request'],
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      (req.get('X-GoBus-Request') !== '1' ||
        (req.get('Origin') && req.get('Origin') !== origin))
    ) {
      res
        .status(403)
        .json({ message: 'Yêu cầu không hợp lệ. Vui lòng tải lại trang.' });
      return;
    }
    next();
  });
  app.use(
    session({
      name: 'gobus.sid',
      secret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'strict',
        secure: config.get('NODE_ENV') === 'production',
        maxAge: 8 * 60 * 60 * 1000,
      },
    }),
  );
  app.use(
    '/auth/login',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 20,
      skipSuccessfulRequests: true,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        message:
          'Bạn đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.',
      },
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          message: validationMessages(errors),
        }),
    }),
  );
}
