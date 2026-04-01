import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { OperationalHealthService } from './common/health/operational-health.service';

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly operationalHealth: OperationalHealthService) {}

  private versionPayload() {
    return {
      service: 'restocafe-api',
      version:
        process.env.APP_VERSION ?? process.env.npm_package_version ?? 'unknown',
      gitSha: process.env.GIT_SHA ?? undefined,
    };
  }

  /** Process is up (orchestrator liveness). No dependency checks. */
  @Get('live')
  live() {
    return {
      status: 'ok',
      check: 'liveness',
      ts: new Date().toISOString(),
      ...this.versionPayload(),
    };
  }

  /** Database reachable (orchestrator readiness). */
  @Get('ready')
  async ready() {
    const snapshot = await this.operationalHealth.snapshot();
    const payload = {
      status: snapshot.status,
      check: 'readiness',
      summary: snapshot.summary,
      canServeTraffic: snapshot.canServeTraffic,
      dependencies: snapshot.dependencies,
      topology: snapshot.topology,
      ts: snapshot.checkedAt,
      ...this.versionPayload(),
    };

    if (snapshot.status === 'not_ready') {
      throw new ServiceUnavailableException(payload);
    }

    return payload;
  }

  /** @deprecated Use GET /health/live or /health/ready */
  @Get()
  health() {
    return {
      status: 'ok',
      ts: new Date().toISOString(),
      hint: 'Prefer /health/live and /health/ready',
      ...this.versionPayload(),
    };
  }
}
