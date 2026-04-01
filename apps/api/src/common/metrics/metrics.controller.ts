import { Controller, Get, Header, NotFoundException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { getPrometheusRegister } from './prometheus';

@ApiExcludeController()
@SkipThrottle()
@Controller('internal/metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(): Promise<string> {
    if (process.env.METRICS_ENABLED !== 'true') {
      throw new NotFoundException();
    }
    return getPrometheusRegister().metrics();
  }
}
