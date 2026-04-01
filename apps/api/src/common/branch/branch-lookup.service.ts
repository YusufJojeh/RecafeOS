import { Injectable, NotFoundException } from '@nestjs/common';
import { Branch } from '@prisma/client';
import { whereBranchInTenant } from '../persistence/branch-scope';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BranchLookupService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrThrow(branchId: string, tenantId: string): Promise<Branch> {
    const b = await this.prisma.branch.findFirst({
      where: whereBranchInTenant(branchId, tenantId),
    });
    if (!b) {
      throw new NotFoundException('Branch');
    }
    return b;
  }
}
