import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import type { JwtRefreshPayload } from '../../common/types/jwt-payload';
import { CommerceService } from '../../commerce/commerce.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from './auth.service';

type RefreshCreateArgs = {
  data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  };
};

describe('AuthService', () => {
  let service: AuthService;
  let jwtVerify: jest.Mock;
  let refreshFindUnique: jest.Mock;
  let tenantMemberFindUnique: jest.Mock;
  let refreshDelete: jest.Mock;
  let refreshCreate: jest.MockedFunction<
    (args: RefreshCreateArgs) => Promise<unknown>
  >;
  let signAsync: jest.Mock;
  let configValues: Record<string, string | undefined>;

  beforeEach(async () => {
    configValues = {};
    jwtVerify = jest.fn();
    signAsync = jest.fn();
    refreshFindUnique = jest.fn();
    refreshDelete = jest.fn();
    refreshCreate = jest
      .fn<(args: RefreshCreateArgs) => Promise<unknown>>()
      .mockResolvedValue({});
    tenantMemberFindUnique = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jwtVerify,
            signAsync,
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (k: string) => {
              if (
                k === 'JWT_REFRESH_SECRET' ||
                k === 'JWT_ACCESS_SECRET' ||
                k === 'JWT_ACCESS_TTL' ||
                k === 'JWT_REFRESH_TTL'
              ) {
                return configValues[k] ?? 'test-secret';
              }
              throw new Error(`unexpected ${k}`);
            },
            get: (k: string) => configValues[k],
          },
        },
        {
          provide: PrismaService,
          useValue: {
            refreshToken: {
              findUnique: refreshFindUnique,
              delete: refreshDelete,
              create: refreshCreate,
            },
            tenantMember: {
              findUnique: tenantMemberFindUnique,
            },
          },
        },
        {
          provide: CommerceService,
          useValue: {},
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('refresh', () => {
    it('rejects when refresh JWT payload omits tenantId', async () => {
      jwtVerify.mockResolvedValue({
        sub: 'user-1',
        tokenId: 'tok',
        type: 'refresh',
      } satisfies Partial<JwtRefreshPayload>);

      await expect(service.refresh('token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshFindUnique).not.toHaveBeenCalled();
    });

    it('rejects when user is not a member of tenant in refresh token', async () => {
      jwtVerify.mockResolvedValue({
        sub: 'user-1',
        tokenId: 'tok',
        tenantId: 'tenant-a',
        type: 'refresh',
      } as JwtRefreshPayload);
      refreshFindUnique.mockResolvedValue({
        id: 'rt1',
        expiresAt: new Date(Date.now() + 60_000),
      });
      tenantMemberFindUnique.mockResolvedValue(null);

      await expect(service.refresh('token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshDelete).not.toHaveBeenCalled();
    });
  });

  describe('issueTokens', () => {
    beforeEach(() => {
      signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('honors configured JWT TTLs for token response and refresh expiry', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
      configValues.JWT_ACCESS_SECRET = 'a'.repeat(32);
      configValues.JWT_REFRESH_SECRET = 'b'.repeat(32);
      configValues.JWT_ACCESS_TTL = '45m';
      configValues.JWT_REFRESH_TTL = '10d';

      const privateService = service as unknown as {
        issueTokens: (
          userId: string,
          tenantId: string,
          permissions: string[],
        ) => Promise<{
          accessToken: string;
          refreshToken: string;
          expiresIn: number;
        }>;
      };
      const issued = await privateService.issueTokens('user-1', 'tenant-1', [
        'orders.view',
      ]);

      expect(issued).toMatchObject({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 2700,
      });
      const refreshCreateArgs = refreshCreate.mock.calls[0]?.[0];

      expect(refreshCreateArgs?.data.userId).toBe('user-1');
      expect(refreshCreateArgs?.data.expiresAt).toEqual(
        new Date('2026-01-11T00:00:00.000Z'),
      );
    });
  });
});
