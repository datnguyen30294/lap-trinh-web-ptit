import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupApp } from './setup-app.js';
const app = await NestFactory.create(AppModule);
setupApp(app);
await app.listen(process.env.PORT ?? 3001, '127.0.0.1');
