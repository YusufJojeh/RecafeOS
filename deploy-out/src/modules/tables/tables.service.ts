import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FloorTableStatus, TableSessionStatus } from '@prisma/client';
import { BranchLookupService } from '../../common/branch/branch-lookup.service';
import { whereUnderBranchTenant } from '../../common/persistence/branch-scope';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branches: BranchLookupService,
  ) {}

  listTables(branchId: string, tenantId: string) {
    return this.prisma.floorTable.findMany({
      where: whereUnderBranchTenant(branchId, tenantId),
      orderBy: { sortOrder: 'asc' },
      include: {
        sessions: { where: { status: TableSessionStatus.OPEN }, take: 1 },
      },
    });
  }

  async createTable(
    branchId: string,
    tenantId: string,
    body: { label: string; sortOrder?: number },
  ) {
    await this.branches.findOrThrow(branchId, tenantId);
    return this.prisma.floorTable.create({
      data: { branchId, label: body.label, sortOrder: body.sortOrder ?? 0 },
    });
  }

  async patchTable(
    branchId: string,
    tenantId: string,
    tableId: string,
    body: Partial<{ status: FloorTableStatus; label: string }>,
  ) {
    const t = await this.prisma.floorTable.findFirst({
      where: { id: tableId, ...whereUnderBranchTenant(branchId, tenantId) },
    });
    if (!t) {
      throw new NotFoundException();
    }
    return this.prisma.floorTable.update({
      where: { id: tableId },
      data: body,
    });
  }

  async openSession(
    branchId: string,
    tenantId: string,
    body: { floorTableId: string; guestCount: number },
  ) {
    await this.branches.findOrThrow(branchId, tenantId);
    const table = await this.prisma.floorTable.findFirst({
      where: {
        id: body.floorTableId,
        ...whereUnderBranchTenant(branchId, tenantId),
      },
    });
    if (!table) {
      throw new NotFoundException('Table');
    }
    if (
      table.status !== FloorTableStatus.AVAILABLE &&
      table.status !== FloorTableStatus.RESERVED
    ) {
      throw new BadRequestException('Table not available');
    }
    try {
      if (this.prisma.isMysqlLocalMode()) {
        return await this.prisma.$transaction(async (tx) => {
          const claim = await tx.floorTable.updateMany({
            where: {
              id: table.id,
              branchId,
              status: {
                in: [FloorTableStatus.AVAILABLE, FloorTableStatus.RESERVED],
              },
            },
            data: { status: FloorTableStatus.OCCUPIED },
          });
          if (claim.count !== 1) {
            throw new ConflictException('table_has_open_session');
          }
          return tx.tableSession.create({
            data: {
              branchId,
              floorTableId: table.id,
              guestCount: body.guestCount,
              status: TableSessionStatus.OPEN,
            },
          });
        });
      }

      const session = await this.prisma.$transaction(async (tx) => {
        // Lock the table row to prevent concurrent session creation races.
        const [locked] = await tx.$queryRaw<Array<{ status: string }>>`
          SELECT status FROM "FloorTable" WHERE id = ${table.id} FOR UPDATE
        `;
        if (
          locked?.status !== FloorTableStatus.AVAILABLE &&
          locked?.status !== FloorTableStatus.RESERVED
        ) {
          throw new ConflictException('table_has_open_session');
        }
        const s = await tx.tableSession.create({
          data: {
            branchId,
            floorTableId: table.id,
            guestCount: body.guestCount,
            status: TableSessionStatus.OPEN,
          },
        });
        await tx.floorTable.update({
          where: { id: table.id },
          data: { status: FloorTableStatus.OCCUPIED },
        });
        return s;
      });
      return session;
    } catch (e) {
      if (e instanceof ConflictException) {
        throw e;
      }
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('table_has_open_session');
      }
      throw e;
    }
  }

  async mergeSessions(
    branchId: string,
    tenantId: string,
    targetSessionId: string,
    sourceSessionId: string,
  ) {
    if (targetSessionId === sourceSessionId) {
      throw new BadRequestException();
    }
    const [a, b] = await Promise.all([
      this.prisma.tableSession.findFirst({
        where: {
          id: targetSessionId,
          status: TableSessionStatus.OPEN,
          ...whereUnderBranchTenant(branchId, tenantId),
        },
      }),
      this.prisma.tableSession.findFirst({
        where: {
          id: sourceSessionId,
          status: TableSessionStatus.OPEN,
          ...whereUnderBranchTenant(branchId, tenantId),
        },
      }),
    ]);
    if (!a || !b) {
      throw new NotFoundException('Sessions');
    }

    await this.prisma.$transaction(async (tx) => {
      if (!this.prisma.isMysqlLocalMode()) {
        const [lockFirst, lockSecond] = [
          targetSessionId,
          sourceSessionId,
        ].sort();
        await tx.$executeRaw(
          Prisma.sql`SELECT id FROM "TableSession" WHERE id = ${lockFirst} AND "branchId" = ${branchId} FOR UPDATE`,
        );
        await tx.$executeRaw(
          Prisma.sql`SELECT id FROM "TableSession" WHERE id = ${lockSecond} AND "branchId" = ${branchId} FOR UPDATE`,
        );
      }

      const target = await tx.tableSession.findFirst({
        where: {
          id: targetSessionId,
          status: TableSessionStatus.OPEN,
          ...whereUnderBranchTenant(branchId, tenantId),
        },
      });
      const source = await tx.tableSession.findFirst({
        where: {
          id: sourceSessionId,
          status: TableSessionStatus.OPEN,
          ...whereUnderBranchTenant(branchId, tenantId),
        },
      });
      if (!target || !source) {
        throw new NotFoundException('Sessions');
      }

      await tx.order.updateMany({
        where: { tableSessionId: sourceSessionId, branchId, tenantId },
        data: { tableSessionId: targetSessionId },
      });
      await tx.tableSession.update({
        where: { id: sourceSessionId },
        data: { status: TableSessionStatus.CLOSED, closedAt: new Date() },
      });
      const ft = await tx.floorTable.findUnique({
        where: { id: source.floorTableId },
      });
      if (ft) {
        await tx.floorTable.update({
          where: { id: ft.id },
          data: { status: FloorTableStatus.AVAILABLE },
        });
      }
    });
    return this.prisma.tableSession.findUnique({
      where: { id: targetSessionId },
    });
  }
}
