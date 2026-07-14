import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Permite que o frontend (mesmo aberto de outro host/porta) consuma a API
  app.enableCors();

  // Valida e higieniza automaticamente todos os DTOs de entrada
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove campos não declarados no DTO
      transform: true, // converte payloads para as classes dos DTOs
    }),
  );

  app.setGlobalPrefix('api', { exclude: [''] });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`✅ IP Solution Onboarding API rodando em http://localhost:${port}`);
  console.log(`   Frontend servido em http://localhost:${port} (pasta /public)`);
}
bootstrap();
