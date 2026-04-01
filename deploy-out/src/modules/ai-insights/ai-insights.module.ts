import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CommerceModule } from '../../commerce/commerce.module';
import { BranchCommonModule } from '../../common/branch/branch-common.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ReportsModule } from '../reports/reports.module';
import { AiInsightsController } from './ai-insights.controller';
import { AiInsightsService } from './ai-insights.service';
import { HttpLlmClient } from './http-llm.client';
import type { LlmClient } from './llm-client.interface';
import { NoopLlmClient } from './noop-llm.client';
import { LLM_CLIENT } from './llm.types';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    BranchCommonModule,
    CommerceModule,
    ReportsModule,
  ],
  controllers: [AiInsightsController],
  providers: [
    NoopLlmClient,
    HttpLlmClient,
    AiInsightsService,
    {
      provide: LLM_CLIENT,
      useFactory: (
        config: ConfigService,
        http: HttpLlmClient,
        noop: NoopLlmClient,
      ): LlmClient => {
        if (config.get<string>('LLM_INSIGHTS_DISABLED') === 'true') {
          return noop;
        }
        return config.get<string>('LLM_API_KEY')?.trim() ? http : noop;
      },
      inject: [ConfigService, HttpLlmClient, NoopLlmClient],
    },
  ],
})
export class AiInsightsModule {}
