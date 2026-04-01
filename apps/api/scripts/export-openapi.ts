import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import 'reflect-metadata';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const OUT = resolve(__dirname, '../../../contracts/openapi.json');

async function main(): Promise<void> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue({
      $connect: async () => undefined,
      $disconnect: async () => undefined,
      onModuleInit: async () => undefined,
      onModuleDestroy: async () => undefined,
    })
    .compile();

  const app = moduleRef.createNestApplication();
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('RestoCafe OS').setVersion('1').build(),
  );
  await app.close();

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Wrote ${OUT}`);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
