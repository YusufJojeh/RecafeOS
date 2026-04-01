import { NotFoundException } from '@nestjs/common';
import { PublicService } from './public.service';

describe('PublicService', () => {
  function createService() {
    const prisma = {
      tenant: { findUnique: jest.fn() },
      branch: { findUnique: jest.fn() },
      tableSession: { findUnique: jest.fn() },
      menuCategory: { findMany: jest.fn() },
      waiterCall: { create: jest.fn() },
    };
    const commerce = {
      assertPublicTenantAccess: jest.fn(),
    };
    const ops = {
      emitBranchEvent: jest.fn(),
    };
    const menuBranding = {
      getPublishedForPublicMenu: jest.fn().mockResolvedValue(null),
    };
    return {
      prisma,
      commerce,
      ops,
      menuBranding,
      service: new PublicService(
        prisma as never,
        ops as never,
        commerce as never,
        menuBranding as never,
      ),
    };
  }

  it('returns session menu when token matches the tenant and branch path', async () => {
    const { prisma, commerce, service } = createService();
    prisma.tableSession.findUnique.mockResolvedValue({
      id: 'session-1',
      status: 'OPEN',
      branch: {
        id: 'branch-1',
        name: 'Main',
        slug: 'main',
        tenant: {
          id: 'tenant-1',
          slug: 'demo',
        },
      },
    });
    prisma.menuCategory.findMany.mockResolvedValue([
      { id: 'cat-1', name: 'Coffee', items: [{ id: 'item-1', name: 'Latte' }] },
    ]);

    await expect(
      service.menuForSession('demo', 'main', 'token-123'),
    ).resolves.toMatchObject({
      branch: { id: 'branch-1', name: 'Main', slug: 'main' },
      categories: [{ id: 'cat-1', name: 'Coffee' }],
    });
    expect(commerce.assertPublicTenantAccess).toHaveBeenCalledWith({
      id: 'tenant-1',
      slug: 'demo',
    });
  });

  it('rejects session menu when the token belongs to another branch path', async () => {
    const { prisma, service } = createService();
    prisma.tableSession.findUnique.mockResolvedValue({
      id: 'session-1',
      status: 'OPEN',
      branch: {
        id: 'branch-1',
        name: 'Main',
        slug: 'main',
        tenant: {
          id: 'tenant-1',
          slug: 'demo',
        },
      },
    });

    await expect(
      service.menuForSession('demo', 'side-branch', 'token-123'),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects session menu when the session is closed', async () => {
    const { prisma, service } = createService();
    prisma.tableSession.findUnique.mockResolvedValue({
      id: 'session-1',
      status: 'CLOSED',
      branch: {
        id: 'branch-1',
        name: 'Main',
        slug: 'main',
        tenant: {
          id: 'tenant-1',
          slug: 'demo',
        },
      },
    });

    await expect(
      service.menuForSession('demo', 'main', 'token-123'),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns branch menu by slug for non-session public access', async () => {
    const { prisma, commerce, service } = createService();
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      slug: 'demo',
    });
    prisma.branch.findUnique.mockResolvedValue({
      id: 'branch-1',
      name: 'Main',
      slug: 'main',
      tenantId: 'tenant-1',
      tenant: { id: 'tenant-1', slug: 'demo' },
    });
    prisma.menuCategory.findMany.mockResolvedValue([]);

    await expect(service.menuBySlug('demo', 'main')).resolves.toMatchObject({
      branch: { id: 'branch-1', name: 'Main', slug: 'main' },
      categories: [],
    });
    expect(commerce.assertPublicTenantAccess).toHaveBeenCalledWith({
      id: 'tenant-1',
      slug: 'demo',
    });
  });
});
