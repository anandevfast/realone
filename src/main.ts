import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const configDocs = new DocumentBuilder()
    .setTitle('RealSmart API')
    .setDescription('RealSmart Backend API')
    .setVersion('1.0.0')
    // .addBearerAuth(
    //   {
    //     type: 'http',
    //     scheme: 'bearer',
    //     bearerFormat: 'JWT',
    //   },
    //   'access-token',
    // )
    .build();
  const document = SwaggerModule.createDocument(app, configDocs);
  SwaggerModule.setup('docs', app, document);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.setGlobalPrefix('api');
  const port = config.get<number>('APP_PORT', { infer: true }) ?? 8082;
  await app.listen(port);
}
bootstrap();
