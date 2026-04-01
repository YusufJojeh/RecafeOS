import {
  BadRequestException,
  Injectable,
  NotImplementedException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { CommerceService } from '../../commerce/commerce.service';
import { BranchLookupService } from '../../common/branch/branch-lookup.service';
import {
  calendarDateInTimeZone,
  normalizeCalendarDateInput,
  zonedDayBoundsUtc,
} from '../../common/datetime/branch-day-range';
import { PrismaService } from '../../prisma/prisma.service';
import { BranchesService } from '../branches/branches.service';
import { ReportsRedisCacheService } from './reports-redis-cache.service';

const LOW_STOCK_CAP = 20;
const TOP_CUSTOMERS = 10;
const TOP_DISCOUNT_REASONS = 8;

/** IANA zone names only; used only with values from persisted Branch.timezone. */
function assertSafeIanaTimeZone(tz: string): string {
  if (!/^[A-Za-z0-9_/+-]+$/.test(tz) || tz.length > 64) {
    throw new BadRequestException('Invalid branch timezone');
  }
  return tz;
}

type ReportFlag = {
  code: string;
  severity: 'info' | 'warn' | 'risk';
  message: string;
};

function addCalendarDaysYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10));
  const utc = Date.UTC(y, m - 1, d + deltaDays);
  return new Date(utc).toISOString().slice(0, 10);
}

function priorSameWeekdayDates(anchorYmd: string, weeksBack: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= weeksBack; i++) {
    out.push(addCalendarDaysYmd(anchorYmd, -7 * i));
  }
  return out;
}

function medianSorted(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

@Injectable()
export class ReportsService {
  /** In-process TTL cache to cut duplicate `daily()` DB fan-out under concurrent staff. */
  private readonly dailyReportCache = new Map<
    string,
    { expiresAt: number; value: unknown }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly branches: BranchLookupService,
    private readonly commerce: CommerceService,
    private readonly branchSetup: BranchesService,
    private readonly config: ConfigService,
    private readonly reportsRedis: ReportsRedisCacheService,
  ) {}

  private assertLocalMysqlReportSupport(feature: string): void {
    if (!this.prisma.isMysqlLocalMode()) {
      return;
    }
    throw new NotImplementedException(
      `${feature} is not available when running the local MySQL/XAMPP compatibility path. ` +
        'Core venue operations are supported, but advanced analytics/reporting still require PostgreSQL. ' +
        'See docs/database/COMPATIBILITY.md for the exact limits.',
    );
  }

  async daily(branchId: string, tenantId: string, dateInput?: string) {
    this.assertLocalMysqlReportSupport('Daily reports');
    const branch = await this.branches.findOrThrow(branchId, tenantId);
    const tzRaw = branch.timezone || 'UTC';
    const tz = assertSafeIanaTimeZone(tzRaw);
    const dayStr =
      dateInput !== undefined && dateInput !== ''
        ? normalizeCalendarDateInput(dateInput)
        : calendarDateInTimeZone(new Date(), tzRaw);
    if (!dayStr) {
      throw new BadRequestException('Invalid date; use YYYY-MM-DD or ISO-8601');
    }

    const dailyCacheKey = `daily:${branchId}:${tenantId}:${dayStr}`;
    const ttlRaw = this.config.get<string>('REPORTS_DAILY_CACHE_TTL_MS');
    const ttlMsParsed = ttlRaw ? parseInt(ttlRaw, 10) : 90_000;
    const ttlMs =
      Number.isFinite(ttlMsParsed) && ttlMsParsed >= 0 && ttlMsParsed <= 600_000
        ? ttlMsParsed
        : 90_000;
    if (ttlMs > 0) {
      const hit = this.dailyReportCache.get(dailyCacheKey);
      if (hit && hit.expiresAt > Date.now()) {
        return hit.value as never;
      }
      const redisHit = await this.reportsRedis.getDailyJson(dailyCacheKey);
      if (redisHit != null) {
        this.dailyReportCache.set(dailyCacheKey, {
          value: redisHit,
          expiresAt: Date.now() + ttlMs,
        });
        return redisHit as never;
      }
    }

    const { start, end } = zonedDayBoundsUtc(dayStr, tzRaw);
    const now = new Date();
    const windowEnd =
      dayStr === calendarDateInTimeZone(now, tzRaw)
        ? new Date(Math.min(end.getTime(), now.getTime()))
        : end;

    const [
      paidAgg,
      typeRows,
      topItemRows,
      payRows,
      hourlyRows,
      cancelRow,
      cancelReasonRows,
      discountRow,
      discountReasonRows,
      cashierRows,
      shiftRows,
      topCustomerRows,
      visitTotalRow,
      visitRepeatRow,
      categoryRows,
      sameWeekdayBench,
    ] = await Promise.all([
      this.paidDayAggregate(branchId, tenantId, start, windowEnd),
      this.prisma.$queryRaw<
        Array<{ type: string; total: bigint; cnt: bigint }>
      >`
        SELECT o.type::text AS type,
          SUM(o."totalMinor")::bigint AS total,
          COUNT(*)::bigint AS cnt
        FROM "Order" o
        WHERE o."branchId" = ${branchId}
          AND o."tenantId" = ${tenantId}
          AND o.status = ${OrderStatus.PAID}::"OrderStatus"
          AND o."paidAt" >= ${start}
          AND o."paidAt" <= ${windowEnd}
        GROUP BY o.type
      `,
      this.prisma.$queryRaw<
        Array<{
          menuItemId: string;
          name: string;
          qty: bigint;
          revenue: bigint;
        }>
      >`
        SELECT oi."menuItemId", mi.name, SUM(oi.quantity)::bigint AS qty, SUM(oi."lineTotalMinor")::bigint AS revenue
        FROM "OrderItem" oi
        INNER JOIN "Order" o ON o.id = oi."orderId"
        INNER JOIN "MenuItem" mi ON mi.id = oi."menuItemId"
        WHERE o."branchId" = ${branchId}
          AND o."tenantId" = ${tenantId}
          AND o.status = ${OrderStatus.PAID}::"OrderStatus"
          AND o."paidAt" >= ${start}
          AND o."paidAt" <= ${windowEnd}
        GROUP BY oi."menuItemId", mi.name
        ORDER BY revenue DESC
        LIMIT 10
      `,
      this.prisma.$queryRaw<Array<{ method: string; total: bigint }>>`
        SELECT p.method::text AS method, SUM(p."amountMinor")::bigint AS total
        FROM "Payment" p
        INNER JOIN "Order" o ON o.id = p."orderId"
        WHERE o."branchId" = ${branchId}
          AND o."tenantId" = ${tenantId}
          AND o.status = ${OrderStatus.PAID}::"OrderStatus"
          AND o."paidAt" >= ${start}
          AND o."paidAt" <= ${windowEnd}
          AND p.status = ${PaymentStatus.COMPLETED}::"PaymentStatus"
        GROUP BY p.method
      `,
      this.hourlySales(branchId, tenantId, start, windowEnd, tz),
      this.prisma.$queryRaw<[{ count: bigint; lost: bigint }]>`
        SELECT COUNT(*)::bigint AS count,
          COALESCE(SUM("subtotalMinor"), 0)::bigint AS lost
        FROM "Order"
        WHERE "branchId" = ${branchId}
          AND "tenantId" = ${tenantId}
          AND status = ${OrderStatus.CANCELLED}::"OrderStatus"
          AND "cancelledAt" IS NOT NULL
          AND "cancelledAt" >= ${start}
          AND "cancelledAt" <= ${end}
      `,
      this.prisma.$queryRaw<
        Array<{ reason: string; cnt: bigint; lost: bigint }>
      >`
        SELECT COALESCE(NULLIF(TRIM(o."cancellationReason"), ''), '(unspecified)') AS reason,
          COUNT(*)::bigint AS cnt,
          COALESCE(SUM(o."subtotalMinor"), 0)::bigint AS lost
        FROM "Order" o
        WHERE o."branchId" = ${branchId}
          AND o."tenantId" = ${tenantId}
          AND o.status = ${OrderStatus.CANCELLED}::"OrderStatus"
          AND o."cancelledAt" IS NOT NULL
          AND o."cancelledAt" >= ${start}
          AND o."cancelledAt" <= ${end}
        GROUP BY 1
        ORDER BY cnt DESC
        LIMIT 12
      `,
      this.prisma.$queryRaw<
        [{ withDisc: bigint; totalDisc: bigint; ordersPaid: bigint }]
      >`
        SELECT
          COUNT(*) FILTER (WHERE o."subtotalMinor" > o."totalMinor")::bigint AS "withDisc",
          COALESCE(SUM(GREATEST(o."subtotalMinor" - o."totalMinor", 0)), 0)::bigint AS "totalDisc",
          COUNT(*)::bigint AS "ordersPaid"
        FROM "Order" o
        WHERE o."branchId" = ${branchId}
          AND o."tenantId" = ${tenantId}
          AND o.status = ${OrderStatus.PAID}::"OrderStatus"
          AND o."paidAt" >= ${start}
          AND o."paidAt" <= ${windowEnd}
      `,
      this.prisma.$queryRaw<Array<{ reason: string; cnt: bigint }>>`
        SELECT TRIM(o."discountReason") AS reason, COUNT(*)::bigint AS cnt
        FROM "Order" o
        WHERE o."branchId" = ${branchId}
          AND o."tenantId" = ${tenantId}
          AND o.status = ${OrderStatus.PAID}::"OrderStatus"
          AND o."paidAt" >= ${start}
          AND o."paidAt" <= ${windowEnd}
          AND o."subtotalMinor" > o."totalMinor"
          AND o."discountReason" IS NOT NULL
          AND TRIM(o."discountReason") <> ''
        GROUP BY TRIM(o."discountReason")
        ORDER BY cnt DESC
        LIMIT ${TOP_DISCOUNT_REASONS}
      `,
      this.prisma.$queryRaw<
        Array<{
          uid: string | null;
          name: string | null;
          total: bigint;
          orders: bigint;
        }>
      >`
        SELECT p."recordedByUserId" AS uid,
          u."displayName" AS name,
          SUM(p."amountMinor")::bigint AS total,
          COUNT(DISTINCT p."orderId")::bigint AS orders
        FROM "Payment" p
        INNER JOIN "Order" o ON o.id = p."orderId"
        LEFT JOIN "User" u ON u.id = p."recordedByUserId"
        WHERE o."branchId" = ${branchId}
          AND o."tenantId" = ${tenantId}
          AND o.status = ${OrderStatus.PAID}::"OrderStatus"
          AND o."paidAt" >= ${start}
          AND o."paidAt" <= ${windowEnd}
          AND p.status = ${PaymentStatus.COMPLETED}::"PaymentStatus"
        GROUP BY p."recordedByUserId", u."displayName"
        ORDER BY total DESC
      `,
      this.shiftSales(branchId, tenantId, start, windowEnd, end),
      this.prisma.$queryRaw<
        Array<{
          id: string;
          phone: string;
          nm: string | null;
          revenue: bigint;
          oc: bigint;
        }>
      >`
        SELECT c.id, c.phone, c.name AS nm,
          SUM(o."totalMinor")::bigint AS revenue,
          COUNT(*)::bigint AS oc
        FROM "Order" o
        INNER JOIN "Customer" c ON c.id = o."customerId"
        WHERE o."branchId" = ${branchId}
          AND o."tenantId" = ${tenantId}
          AND o.status = ${OrderStatus.PAID}::"OrderStatus"
          AND o."paidAt" >= ${start}
          AND o."paidAt" <= ${windowEnd}
          AND o."customerId" IS NOT NULL
        GROUP BY c.id, c.phone, c.name
        ORDER BY revenue DESC
        LIMIT ${TOP_CUSTOMERS}
      `,
      this.prisma.$queryRaw<[{ n: bigint }]>`
        SELECT COUNT(*)::bigint AS n
        FROM "CustomerVisit" cv
        WHERE cv."branchId" = ${branchId}
          AND cv."visitedAt" >= ${start}
          AND cv."visitedAt" <= ${end}
      `,
      this.prisma.$queryRaw<[{ n: bigint }]>`
        SELECT COUNT(*)::bigint AS n
        FROM "CustomerVisit" cv
        WHERE cv."branchId" = ${branchId}
          AND cv."visitedAt" >= ${start}
          AND cv."visitedAt" <= ${end}
          AND EXISTS (
            SELECT 1 FROM "CustomerVisit" cv2
            WHERE cv2."customerId" = cv."customerId"
              AND cv2."branchId" = cv."branchId"
              AND cv2."visitedAt" < cv."visitedAt"
          )
      `,
      this.prisma.$queryRaw<
        Array<{ categoryName: string; revenue: bigint; qty: bigint }>
      >`
        SELECT mc.name AS "categoryName",
          COALESCE(SUM(oi."lineTotalMinor"), 0)::bigint AS revenue,
          COALESCE(SUM(oi.quantity), 0)::bigint AS qty
        FROM "OrderItem" oi
        INNER JOIN "Order" o ON o.id = oi."orderId"
        INNER JOIN "MenuItem" mi ON mi.id = oi."menuItemId"
        INNER JOIN "MenuCategory" mc ON mc.id = mi."categoryId"
        WHERE o."branchId" = ${branchId}
          AND o."tenantId" = ${tenantId}
          AND o.status = ${OrderStatus.PAID}::"OrderStatus"
          AND o."paidAt" >= ${start}
          AND o."paidAt" <= ${windowEnd}
        GROUP BY mc.id, mc.name
        ORDER BY revenue DESC
      `,
      this.sameWeekdayMedianBenchmark(branchId, tenantId, dayStr, tzRaw),
    ]);

    const lowStockRows = await this.lowStockItems(
      branchId,
      tenantId,
      topItemRows.map((r) => r.menuItemId),
    );

    const orderCount = Number(paidAgg.count);
    const totalSales = Number(paidAgg.total);
    const grossSales = Number(paidAgg.gross);
    const aov = orderCount ? Math.round(totalSales / orderCount) : 0;

    const byType: Record<string, number> = {};
    const orderCountByOrderType: Record<string, number> = {};
    for (const r of typeRows) {
      byType[r.type] = Number(r.total);
      orderCountByOrderType[r.type] = Number(r.cnt);
    }

    const topItems = topItemRows.map((r) => ({
      name: r.name,
      qty: Number(r.qty),
      revenue: Number(r.revenue),
    }));

    const payByMethod: Record<string, number> = {};
    for (const r of payRows) {
      payByMethod[r.method] = Number(r.total);
    }

    const hourlyMap = new Map<
      number,
      { orderCount: number; salesMinor: number }
    >();
    for (const h of hourlyRows) {
      const hr = Number(h.hour);
      if (hr >= 0 && hr <= 23) {
        hourlyMap.set(hr, {
          orderCount: Number(h.cnt),
          salesMinor: Number(h.total),
        });
      }
    }
    const hourlySales = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      orderCount: hourlyMap.get(hour)?.orderCount ?? 0,
      salesMinor: hourlyMap.get(hour)?.salesMinor ?? 0,
    }));

    const cancelCount = Number(cancelRow[0]?.count ?? 0);
    const lostSubtotal = Number(cancelRow[0]?.lost ?? 0);
    const cancellationByReason = cancelReasonRows.map((r) => ({
      reason: r.reason,
      count: Number(r.cnt),
      lostSubtotalMinor: Number(r.lost),
    }));

    const salesByCategory = categoryRows.map((r) => ({
      name: r.categoryName,
      revenueMinor: Number(r.revenue),
      qty: Number(r.qty),
    }));

    const ordersWithDiscountCount = Number(discountRow[0]?.withDisc ?? 0);
    const totalDiscountMinor = Number(discountRow[0]?.totalDisc ?? 0);
    const ordersPaidCount = Number(discountRow[0]?.ordersPaid ?? 0);

    const topDiscountReasons = discountReasonRows.map((r) => ({
      reason: r.reason,
      count: Number(r.cnt),
    }));

    const cashiers = cashierRows.map((r) => ({
      userId: r.uid,
      displayName: r.name?.trim() || 'Unassigned',
      paymentsTotalMinor: Number(r.total),
      orderCount: Number(r.orders),
    }));

    const shifts = shiftRows.map((r) => ({
      id: r.id,
      openedAt: r.openedAt.toISOString(),
      closedAt: r.closedAt ? r.closedAt.toISOString() : null,
      orderCount: Number(r.orderCount),
      salesMinor: Number(r.salesMinor),
    }));

    const topCustomers = topCustomerRows.map((r) => ({
      customerId: r.id,
      phone: r.phone,
      name: r.nm,
      ordersCount: Number(r.oc),
      revenueMinor: Number(r.revenue),
    }));

    const visitsRecorded = Number(visitTotalRow[0]?.n ?? 0);
    const repeatVisitsAtBranch = Number(visitRepeatRow[0]?.n ?? 0);
    const firstTimeVisitsAtBranch = Math.max(
      0,
      visitsRecorded - repeatVisitsAtBranch,
    );

    const flags = this.buildFlags({
      totalSales,
      orderCount,
      cancelCount,
      totalDiscountMinor,
      ordersWithDiscountCount,
      ordersPaidCount,
      hourlySales,
      lowStockCount: lowStockRows.length,
      cashiers,
    });

    const result = {
      branchId,
      date: dayStr,
      totalSalesMinor: totalSales,
      orderCount,
      averageOrderValueMinor: aov,
      salesByOrderType: byType,
      orderCountByOrderType,
      topItems,
      paymentsByMethod: payByMethod,
      summary: {
        grossSalesMinor: grossSales,
        netSalesMinor: totalSales,
        totalDiscountMinor,
      },
      hourlySales,
      sameWeekdayBenchmark: sameWeekdayBench,
      salesByCategory,
      cancellations: {
        count: cancelCount,
        lostSubtotalMinor: lostSubtotal,
        byReason: cancellationByReason,
      },
      discounts: {
        ordersWithDiscountCount,
        totalDiscountMinor,
        topReasons: topDiscountReasons,
      },
      cashiers,
      shifts,
      topCustomers,
      visits: {
        visitsRecorded,
        repeatVisitsAtBranch,
        firstTimeVisitsAtBranch,
      },
      stock: { lowStockItems: lowStockRows },
      flags,
    };

    if (ttlMs > 0) {
      this.dailyReportCache.set(dailyCacheKey, {
        value: result,
        expiresAt: Date.now() + ttlMs,
      });
      void this.reportsRedis.setDailyJson(dailyCacheKey, result, ttlMs);
    }

    return result;
  }

  /** Median net sales and order count on the same weekday for the prior N weeks (excludes `anchorDayStr`). */
  private async sameWeekdayMedianBenchmark(
    branchId: string,
    tenantId: string,
    anchorDayStr: string,
    tzRaw: string,
  ) {
    const dates = priorSameWeekdayDates(anchorDayStr, 8);
    const aggs = await Promise.all(
      dates.map((d) => {
        const { start, end } = zonedDayBoundsUtc(d, tzRaw);
        return this.paidDayAggregate(branchId, tenantId, start, end);
      }),
    );
    const nets = aggs.map((a) => Number(a.total));
    const counts = aggs.map((a) => Number(a.count));
    return {
      priorSameWeekdaysSampled: dates.length,
      medianNetSalesMinor: medianSorted(nets),
      medianOrderCount: medianSorted(counts),
    };
  }

  private async paidDayAggregate(
    branchId: string,
    tenantId: string,
    start: Date,
    end: Date,
  ) {
    const [row] = await this.prisma.$queryRaw<
      [{ count: bigint; total: bigint; gross: bigint }]
    >`
      SELECT COUNT(*)::bigint AS count,
        COALESCE(SUM("totalMinor"), 0)::bigint AS total,
        COALESCE(SUM("subtotalMinor"), 0)::bigint AS gross
      FROM "Order"
      WHERE "branchId" = ${branchId}
        AND "tenantId" = ${tenantId}
        AND status = ${OrderStatus.PAID}::"OrderStatus"
        AND "paidAt" >= ${start}
        AND "paidAt" <= ${end}
    `;
    return {
      count: row?.count ?? 0n,
      total: row?.total ?? 0n,
      gross: row?.gross ?? 0n,
    };
  }

  private async hourlySales(
    branchId: string,
    tenantId: string,
    start: Date,
    end: Date,
    tz: string,
  ) {
    return this.prisma.$queryRaw<
      Array<{ hour: number; cnt: bigint; total: bigint }>
    >`
      SELECT (EXTRACT(HOUR FROM (o."paidAt" AT TIME ZONE ${tz}::text)))::int AS hour,
        COUNT(*)::bigint AS cnt,
        COALESCE(SUM(o."totalMinor"), 0)::bigint AS total
      FROM "Order" o
      WHERE o."branchId" = ${branchId}
        AND o."tenantId" = ${tenantId}
        AND o.status = ${OrderStatus.PAID}::"OrderStatus"
        AND o."paidAt" >= ${start}
        AND o."paidAt" <= ${end}
      GROUP BY 1
      ORDER BY 1
    `;
  }

  private async shiftSales(
    branchId: string,
    tenantId: string,
    dayStart: Date,
    windowEnd: Date,
    dayEnd: Date,
  ) {
    return this.prisma.$queryRaw<
      Array<{
        id: string;
        openedAt: Date;
        closedAt: Date | null;
        orderCount: bigint;
        salesMinor: bigint;
      }>
    >`
      SELECT
        s.id,
        s."openedAt",
        s."closedAt",
        COUNT(o.id)::bigint AS "orderCount",
        COALESCE(SUM(o."totalMinor"), 0)::bigint AS "salesMinor"
      FROM "Shift" s
      LEFT JOIN "Order" o ON o."branchId" = s."branchId"
        AND o."tenantId" = ${tenantId}
        AND o.status = ${OrderStatus.PAID}::"OrderStatus"
        AND o."paidAt" >= GREATEST(s."openedAt", ${dayStart})
        AND o."paidAt" <= LEAST(${windowEnd}, COALESCE(s."closedAt", ${dayEnd}))
        AND o."paidAt" >= s."openedAt"
        AND (s."closedAt" IS NULL OR o."paidAt" <= s."closedAt")
      WHERE s."branchId" = ${branchId}
        AND s."openedAt" <= ${dayEnd}
        AND (s."closedAt" IS NULL OR s."closedAt" >= ${dayStart})
      GROUP BY s.id, s."openedAt", s."closedAt"
      ORDER BY s."openedAt"
    `;
  }

  private async lowStockItems(
    branchId: string,
    tenantId: string,
    topMenuItemIds: string[],
  ) {
    const linkedSql =
      topMenuItemIds.length > 0
        ? Prisma.sql`EXISTS (
            SELECT 1 FROM "ItemRecipe" ir
            WHERE ir."stockItemId" = si.id
              AND ir."menuItemId" IN (${Prisma.join(topMenuItemIds)})
          )`
        : Prisma.sql`false`;
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        quantity: string;
        lowThreshold: string;
        unit: string;
        severityRatio: number | null;
        linkedToTopSeller: boolean;
      }>
    >`
      SELECT si.id, si.name, si.quantity::text AS quantity,
        si."lowThreshold"::text AS "lowThreshold", si.unit,
        (si.quantity / NULLIF(si."lowThreshold", 0))::float8 AS "severityRatio",
        ${linkedSql} AS "linkedToTopSeller"
      FROM "StockItem" si
      INNER JOIN "Branch" b ON b.id = si."branchId"
      WHERE si."branchId" = ${branchId}
        AND b."tenantId" = ${tenantId}
        AND si.quantity <= si."lowThreshold"
      ORDER BY (si.quantity / NULLIF(si."lowThreshold", 0)) ASC NULLS LAST, si.name ASC
      LIMIT ${LOW_STOCK_CAP}
    `;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      quantity: r.quantity,
      lowThreshold: r.lowThreshold,
      unit: r.unit,
      severityRatio: r.severityRatio ?? 0,
      linkedToTopSeller: r.linkedToTopSeller,
    }));
  }

  private buildFlags(args: {
    totalSales: number;
    orderCount: number;
    cancelCount: number;
    totalDiscountMinor: number;
    ordersWithDiscountCount: number;
    ordersPaidCount: number;
    hourlySales: Array<{ hour: number; salesMinor: number }>;
    lowStockCount: number;
    cashiers: Array<{ paymentsTotalMinor: number }>;
  }): ReportFlag[] {
    const flags: ReportFlag[] = [];
    const {
      totalSales,
      orderCount,
      cancelCount,
      totalDiscountMinor,
      ordersWithDiscountCount,
      ordersPaidCount,
      hourlySales,
      lowStockCount,
      cashiers,
    } = args;

    const settled = orderCount + cancelCount;
    if (settled > 0 && cancelCount / settled > 0.15) {
      flags.push({
        code: 'high_cancellation_rate',
        severity: 'warn',
        message: `Cancellations are ${(100 * (cancelCount / settled)).toFixed(0)}% of settled orders (paid + cancelled).`,
      });
    }

    if (totalSales > 0 && totalDiscountMinor / totalSales > 0.1) {
      flags.push({
        code: 'heavy_discount_day',
        severity: 'warn',
        message: `Discounts are ${(100 * (totalDiscountMinor / totalSales)).toFixed(0)}% of net sales.`,
      });
    }

    if (
      ordersPaidCount > 0 &&
      ordersWithDiscountCount / ordersPaidCount > 0.25
    ) {
      flags.push({
        code: 'many_discounted_orders',
        severity: 'info',
        message: `Over 25% of paid orders included a discount (${ordersWithDiscountCount} orders).`,
      });
    }

    let maxHourShare = 0;
    for (const h of hourlySales) {
      if (totalSales <= 0) break;
      const share = h.salesMinor / totalSales;
      if (share > maxHourShare) maxHourShare = share;
    }
    if (maxHourShare > 0.35) {
      flags.push({
        code: 'hourly_sales_spike',
        severity: 'info',
        message:
          'A single hour accounts for over 35% of the day’s sales — check staffing vs peak.',
      });
    }

    if (lowStockCount > 0) {
      flags.push({
        code: 'low_stock',
        severity: 'risk',
        message: `${lowStockCount} stock item(s) at or below threshold.`,
      });
    }

    const payTotal = cashiers.reduce((s, c) => s + c.paymentsTotalMinor, 0);
    if (payTotal > 0 && cashiers.length > 0) {
      const top = Math.max(...cashiers.map((c) => c.paymentsTotalMinor));
      if (top / payTotal > 0.7) {
        flags.push({
          code: 'cashier_concentration',
          severity: 'info',
          message:
            'Most payments were recorded under one cashier — useful for cash handling review.',
        });
      }
    }

    return flags;
  }

  /** Flags for the branch-local `endDay` without running full `daily()` (lighter DB load). */
  private async digestLastDayFlags(
    branchId: string,
    tenantId: string,
    endDay: string,
    tzRaw: string,
  ): Promise<ReportFlag[]> {
    const tz = assertSafeIanaTimeZone(tzRaw);
    const { start, end } = zonedDayBoundsUtc(endDay, tzRaw);
    const now = new Date();
    const windowEnd =
      endDay === calendarDateInTimeZone(now, tzRaw)
        ? new Date(Math.min(end.getTime(), now.getTime()))
        : end;

    const [
      paidAgg,
      cancelRow,
      discountRow,
      hourlyRows,
      lowStockCountRow,
      cashierRows,
    ] = await Promise.all([
      this.paidDayAggregate(branchId, tenantId, start, windowEnd),
      this.prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*)::bigint AS count
          FROM "Order"
          WHERE "branchId" = ${branchId}
            AND "tenantId" = ${tenantId}
            AND status = ${OrderStatus.CANCELLED}::"OrderStatus"
            AND "cancelledAt" IS NOT NULL
            AND "cancelledAt" >= ${start}
            AND "cancelledAt" <= ${end}
        `,
      this.prisma.$queryRaw<
        [{ withDisc: bigint; totalDisc: bigint; ordersPaid: bigint }]
      >`
          SELECT
            COUNT(*) FILTER (WHERE o."subtotalMinor" > o."totalMinor")::bigint AS "withDisc",
            COALESCE(SUM(GREATEST(o."subtotalMinor" - o."totalMinor", 0)), 0)::bigint AS "totalDisc",
            COUNT(*)::bigint AS "ordersPaid"
          FROM "Order" o
          WHERE o."branchId" = ${branchId}
            AND o."tenantId" = ${tenantId}
            AND o.status = ${OrderStatus.PAID}::"OrderStatus"
            AND o."paidAt" >= ${start}
            AND o."paidAt" <= ${windowEnd}
        `,
      this.hourlySales(branchId, tenantId, start, windowEnd, tz),
      this.prisma.$queryRaw<[{ n: bigint }]>`
          SELECT COUNT(*)::bigint AS n
          FROM "StockItem" si
          INNER JOIN "Branch" b ON b.id = si."branchId"
          WHERE si."branchId" = ${branchId}
            AND b."tenantId" = ${tenantId}
            AND si.quantity <= si."lowThreshold"
        `,
      this.prisma.$queryRaw<
        Array<{
          uid: string | null;
          name: string | null;
          total: bigint;
          orders: bigint;
        }>
      >`
          SELECT p."recordedByUserId" AS uid,
            u."displayName" AS name,
            SUM(p."amountMinor")::bigint AS total,
            COUNT(DISTINCT p."orderId")::bigint AS orders
          FROM "Payment" p
          INNER JOIN "Order" o ON o.id = p."orderId"
          LEFT JOIN "User" u ON u.id = p."recordedByUserId"
          WHERE o."branchId" = ${branchId}
            AND o."tenantId" = ${tenantId}
            AND o.status = ${OrderStatus.PAID}::"OrderStatus"
            AND o."paidAt" >= ${start}
            AND o."paidAt" <= ${windowEnd}
            AND p.status = ${PaymentStatus.COMPLETED}::"PaymentStatus"
          GROUP BY p."recordedByUserId", u."displayName"
          ORDER BY total DESC
        `,
    ]);

    const hourlyMap = new Map<
      number,
      { orderCount: number; salesMinor: number }
    >();
    for (const h of hourlyRows) {
      const hr = Number(h.hour);
      if (hr >= 0 && hr <= 23) {
        hourlyMap.set(hr, {
          orderCount: Number(h.cnt),
          salesMinor: Number(h.total),
        });
      }
    }
    const hourlySales = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      orderCount: hourlyMap.get(hour)?.orderCount ?? 0,
      salesMinor: hourlyMap.get(hour)?.salesMinor ?? 0,
    }));

    return this.buildFlags({
      totalSales: Number(paidAgg.total),
      orderCount: Number(paidAgg.count),
      cancelCount: Number(cancelRow[0]?.count ?? 0),
      totalDiscountMinor: Number(discountRow[0]?.totalDisc ?? 0),
      ordersWithDiscountCount: Number(discountRow[0]?.withDisc ?? 0),
      ordersPaidCount: Number(discountRow[0]?.ordersPaid ?? 0),
      hourlySales,
      lowStockCount: Number(lowStockCountRow[0]?.n ?? 0),
      cashiers: cashierRows.map((r) => ({
        paymentsTotalMinor: Number(r.total),
        orderCount: Number(r.orders),
      })),
    });
  }

  private async salesByIsoDowInWindow(
    branchId: string,
    tenantId: string,
    start: Date,
    end: Date,
    tz: string,
  ) {
    const rows = await this.prisma.$queryRaw<
      Array<{ dow: number; total: bigint; cnt: bigint }>
    >`
      SELECT (EXTRACT(DOW FROM (o."paidAt" AT TIME ZONE ${tz}::text)))::int AS dow,
        COALESCE(SUM(o."totalMinor"), 0)::bigint AS total,
        COUNT(*)::bigint AS cnt
      FROM "Order" o
      WHERE o."branchId" = ${branchId}
        AND o."tenantId" = ${tenantId}
        AND o.status = ${OrderStatus.PAID}::"OrderStatus"
        AND o."paidAt" >= ${start}
        AND o."paidAt" <= ${end}
      GROUP BY 1
      ORDER BY 1
    `;
    const map = new Map<number, { net: number; cnt: number }>();
    for (let d = 0; d <= 6; d++) {
      map.set(d, { net: 0, cnt: 0 });
    }
    for (const r of rows) {
      map.set(Number(r.dow), {
        net: Number(r.total),
        cnt: Number(r.cnt),
      });
    }
    return Array.from({ length: 7 }, (_, dow) => ({
      dow,
      netSalesMinor: map.get(dow)!.net,
      orderCount: map.get(dow)!.cnt,
    }));
  }

  private async orderTypeMix(
    branchId: string,
    tenantId: string,
    start: Date,
    end: Date,
  ) {
    const typeRows = await this.prisma.$queryRaw<
      Array<{ type: string; total: bigint; cnt: bigint }>
    >`
      SELECT o.type::text AS type,
        SUM(o."totalMinor")::bigint AS total,
        COUNT(*)::bigint AS cnt
      FROM "Order" o
      WHERE o."branchId" = ${branchId}
        AND o."tenantId" = ${tenantId}
        AND o.status = ${OrderStatus.PAID}::"OrderStatus"
        AND o."paidAt" >= ${start}
        AND o."paidAt" <= ${end}
      GROUP BY o.type
    `;
    const salesByOrderType: Record<string, number> = {};
    const orderCountByOrderType: Record<string, number> = {};
    for (const r of typeRows) {
      salesByOrderType[r.type] = Number(r.total);
      orderCountByOrderType[r.type] = Number(r.cnt);
    }
    return { salesByOrderType, orderCountByOrderType };
  }

  private async discountTrendsByReason(
    branchId: string,
    tenantId: string,
    start: Date,
    end: Date,
  ) {
    const rows = await this.prisma.$queryRaw<
      Array<{ reason: string; cnt: bigint; disc: bigint }>
    >`
      SELECT TRIM(o."discountReason") AS reason,
        COUNT(*)::bigint AS cnt,
        COALESCE(SUM(GREATEST(o."subtotalMinor" - o."totalMinor", 0)), 0)::bigint AS disc
      FROM "Order" o
      WHERE o."branchId" = ${branchId}
        AND o."tenantId" = ${tenantId}
        AND o.status = ${OrderStatus.PAID}::"OrderStatus"
        AND o."paidAt" >= ${start}
        AND o."paidAt" <= ${end}
        AND o."subtotalMinor" > o."totalMinor"
        AND o."discountReason" IS NOT NULL
        AND TRIM(o."discountReason") <> ''
      GROUP BY TRIM(o."discountReason")
      ORDER BY disc DESC
      LIMIT ${TOP_DISCOUNT_REASONS}
    `;
    return rows.map((r) => ({
      reason: r.reason,
      count: Number(r.cnt),
      discountMinor: Number(r.disc),
    }));
  }

  /**
   * Last 7 calendar days in the branch timezone vs the prior 7 days, plus setup health
   * and a single operational highlight (habit-forming owner screen).
   */
  async weeklyBranchDigest(branchId: string, tenantId: string) {
    this.assertLocalMysqlReportSupport('Weekly digest');
    const branch = await this.branches.findOrThrow(branchId, tenantId);
    const tzRaw = branch.timezone || 'UTC';
    const tz = assertSafeIanaTimeZone(tzRaw);
    const now = new Date();
    const endDay = calendarDateInTimeZone(now, tzRaw);
    const startDay = addCalendarDaysYmd(endDay, -6);
    const priorEndDay = addCalendarDaysYmd(endDay, -7);
    const priorStartDay = addCalendarDaysYmd(endDay, -13);

    const { start: windowStart } = zonedDayBoundsUtc(startDay, tz);
    const { end: windowEndFull } = zonedDayBoundsUtc(endDay, tz);
    const windowEnd = new Date(
      Math.min(windowEndFull.getTime(), now.getTime()),
    );

    const { start: priorStart } = zonedDayBoundsUtc(priorStartDay, tz);
    const { end: priorEnd } = zonedDayBoundsUtc(priorEndDay, tz);

    const [
      curAgg,
      prevAgg,
      setup,
      dowCurrent,
      dowPrior,
      orderTypesCurrent,
      orderTypesPrior,
      discCurrent,
      discPrior,
    ] = await Promise.all([
      this.paidDayAggregate(branchId, tenantId, windowStart, windowEnd),
      this.paidDayAggregate(branchId, tenantId, priorStart, priorEnd),
      this.branchSetup.getSetupReadiness(tenantId, branchId),
      this.salesByIsoDowInWindow(
        branchId,
        tenantId,
        windowStart,
        windowEnd,
        tz,
      ),
      this.salesByIsoDowInWindow(branchId, tenantId, priorStart, priorEnd, tz),
      this.orderTypeMix(branchId, tenantId, windowStart, windowEnd),
      this.orderTypeMix(branchId, tenantId, priorStart, priorEnd),
      this.discountTrendsByReason(branchId, tenantId, windowStart, windowEnd),
      this.discountTrendsByReason(branchId, tenantId, priorStart, priorEnd),
    ]);

    const netPaidSalesMinor = Number(curAgg.total);
    const paidOrderCount = Number(curAgg.count);
    const prevNetPaidSalesMinor = Number(prevAgg.total);
    const prevPaidOrderCount = Number(prevAgg.count);

    let salesDeltaPct: number | null = null;
    if (prevNetPaidSalesMinor > 0) {
      salesDeltaPct = Math.round(
        ((netPaidSalesMinor - prevNetPaidSalesMinor) / prevNetPaidSalesMinor) *
          100,
      );
    }

    let topIssue: { kind: string; message: string } | null = null;
    if (setup.blockingIncompleteCount > 0) {
      topIssue = {
        kind: 'setup_incomplete',
        message: `${setup.blockingIncompleteCount} blocking setup item(s) — finish onboarding before relying on numbers.`,
      };
    } else {
      const lastDayFlags = await this.digestLastDayFlags(
        branchId,
        tenantId,
        endDay,
        tzRaw,
      );
      const risk = lastDayFlags.find((f) => f.severity === 'risk');
      const warn = lastDayFlags.find((f) => f.severity === 'warn');
      if (risk) {
        topIssue = { kind: risk.code, message: risk.message };
      } else if (warn) {
        topIssue = { kind: warn.code, message: warn.message };
      } else if (
        netPaidSalesMinor > 0 &&
        prevNetPaidSalesMinor > 0 &&
        netPaidSalesMinor / prevNetPaidSalesMinor < 0.85
      ) {
        topIssue = {
          kind: 'sales_vs_prior_week',
          message:
            'Net sales are materially below the prior 7-day window — review staffing, menu, and discount mix.',
        };
      }
    }

    return {
      semantics: 'branch_local_7_calendar_days_vs_prior_7' as const,
      branchId,
      branchName: branch.name,
      branchTimezone: tz,
      calendarWindow: {
        startDay,
        endDay,
        startUtc: windowStart.toISOString(),
        endUtc: windowEnd.toISOString(),
      },
      priorCalendarWindow: {
        startDay: priorStartDay,
        endDay: priorEndDay,
        startUtc: priorStart.toISOString(),
        endUtc: priorEnd.toISOString(),
      },
      netPaidSalesMinor,
      paidOrderCount,
      priorPeriod: {
        netPaidSalesMinor: prevNetPaidSalesMinor,
        paidOrderCount: prevPaidOrderCount,
        salesDeltaPct,
      },
      setup,
      topIssue,
      weekdayComparison: [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
        dow,
        netSalesMinor: dowCurrent[dow].netSalesMinor,
        priorNetSalesMinor: dowPrior[dow].netSalesMinor,
        orderCount: dowCurrent[dow].orderCount,
        priorOrderCount: dowPrior[dow].orderCount,
      })),
      orderTypeMix: {
        current: orderTypesCurrent,
        prior: orderTypesPrior,
      },
      discountTrends: {
        current: discCurrent,
        prior: discPrior,
      },
    };
  }

  /**
   * Deterministic shortlist for advisory AI: items with at least `minPriorRevenueMinor` in the
   * prior 7-day window, ranked by worst % revenue change vs the current 7-day window
   * (same calendar semantics as `weeklyBranchDigest`). Not a forecast — historical comparison only.
   */
  async underperformingMenuItemCandidates(
    branchId: string,
    tenantId: string,
    opts?: { minPriorRevenueMinor?: number; limit?: number },
  ) {
    this.assertLocalMysqlReportSupport('Underperforming menu item analysis');
    const minPrior = Math.max(0, opts?.minPriorRevenueMinor ?? 500);
    const limit = Math.min(25, Math.max(1, opts?.limit ?? 10));

    const branch = await this.branches.findOrThrow(branchId, tenantId);
    const tzRaw = branch.timezone || 'UTC';
    const tz = assertSafeIanaTimeZone(tzRaw);
    const now = new Date();
    const endDay = calendarDateInTimeZone(now, tzRaw);
    const startDay = addCalendarDaysYmd(endDay, -6);
    const priorEndDay = addCalendarDaysYmd(endDay, -7);
    const priorStartDay = addCalendarDaysYmd(endDay, -13);

    const { start: windowStart } = zonedDayBoundsUtc(startDay, tz);
    const { end: windowEndFull } = zonedDayBoundsUtc(endDay, tz);
    const windowEnd = new Date(
      Math.min(windowEndFull.getTime(), now.getTime()),
    );

    const { start: priorStart } = zonedDayBoundsUtc(priorStartDay, tz);
    const { end: priorEnd } = zonedDayBoundsUtc(priorEndDay, tz);

    const rows = await this.prisma.$queryRaw<
      Array<{
        name: string;
        cur_rev: bigint | null;
        prev_rev: bigint;
        cur_qty: bigint | null;
        prev_qty: bigint;
      }>
    >`
      WITH cur AS (
        SELECT oi."menuItemId",
          SUM(oi."lineTotalMinor")::bigint AS rev,
          SUM(oi.quantity)::bigint AS qty
        FROM "OrderItem" oi
        INNER JOIN "Order" o ON o.id = oi."orderId"
        WHERE o."branchId" = ${branchId}
          AND o."tenantId" = ${tenantId}
          AND o.status = ${OrderStatus.PAID}::"OrderStatus"
          AND o."paidAt" >= ${windowStart}
          AND o."paidAt" <= ${windowEnd}
        GROUP BY oi."menuItemId"
      ),
      prev AS (
        SELECT oi."menuItemId",
          SUM(oi."lineTotalMinor")::bigint AS rev,
          SUM(oi.quantity)::bigint AS qty
        FROM "OrderItem" oi
        INNER JOIN "Order" o ON o.id = oi."orderId"
        WHERE o."branchId" = ${branchId}
          AND o."tenantId" = ${tenantId}
          AND o.status = ${OrderStatus.PAID}::"OrderStatus"
          AND o."paidAt" >= ${priorStart}
          AND o."paidAt" <= ${priorEnd}
        GROUP BY oi."menuItemId"
      )
      SELECT mi.name AS name,
        c.rev AS cur_rev,
        p.rev AS prev_rev,
        c.qty AS cur_qty,
        p.qty AS prev_qty
      FROM prev p
      INNER JOIN "MenuItem" mi ON mi.id = p."menuItemId"
      LEFT JOIN cur c ON c."menuItemId" = p."menuItemId"
      WHERE p.rev >= ${BigInt(minPrior)}
      ORDER BY
        (COALESCE(c.rev, 0) - p.rev)::double precision
        / NULLIF(p.rev::double precision, 0) ASC
      LIMIT ${limit}
    `;

    const candidates = rows.map((r) => {
      const revenuePriorMinor = Number(r.prev_rev);
      const revenueCurrentMinor = r.cur_rev != null ? Number(r.cur_rev) : 0;
      const qtyPrior = Number(r.prev_qty);
      const qtyCurrent = r.cur_qty != null ? Number(r.cur_qty) : 0;
      let pctRevenueChangeVsPrior: number | null = null;
      if (revenuePriorMinor > 0) {
        pctRevenueChangeVsPrior = Math.round(
          ((revenueCurrentMinor - revenuePriorMinor) / revenuePriorMinor) * 100,
        );
      }
      return {
        name: r.name,
        revenuePriorMinor,
        revenueCurrentMinor,
        qtyPrior,
        qtyCurrent,
        pctRevenueChangeVsPrior,
      };
    });

    return {
      semantics: 'underperforming_items_week_vs_prior' as const,
      branchId,
      branchTimezone: tz,
      minPriorRevenueMinor: minPrior,
      currentWindow: {
        startDay,
        endDay,
        startUtc: windowStart.toISOString(),
        endUtc: windowEnd.toISOString(),
      },
      priorWindow: {
        startDay: priorStartDay,
        endDay: priorEndDay,
        startUtc: priorStart.toISOString(),
        endUtc: priorEnd.toISOString(),
      },
      candidates,
    };
  }

  /**
   * Rolling demand: hour-of-day totals over the last N branch-local calendar days (paid orders).
   * Use for staffing / prep peak band (contiguous hours with highest share of window sales).
   */
  async demandProfile(branchId: string, tenantId: string, daysInput?: number) {
    this.assertLocalMysqlReportSupport('Demand profile');
    const branch = await this.branches.findOrThrow(branchId, tenantId);
    const tzRaw = branch.timezone || 'UTC';
    const tz = assertSafeIanaTimeZone(tzRaw);
    const days = Math.min(Math.max(daysInput ?? 28, 7), 90);
    const endDay = calendarDateInTimeZone(new Date(), tzRaw);
    const startDay = addCalendarDaysYmd(endDay, -(days - 1));
    const { start } = zonedDayBoundsUtc(startDay, tzRaw);
    const { end: endFull } = zonedDayBoundsUtc(endDay, tzRaw);
    const windowEnd = new Date(Math.min(endFull.getTime(), Date.now()));

    const hourlyRows = await this.hourlySales(
      branchId,
      tenantId,
      start,
      windowEnd,
      tz,
    );
    const hourTotals = Array.from({ length: 24 }, (_, h) => {
      const found = hourlyRows.find((r) => Number(r.hour) === h);
      return found ? Number(found.total) : 0;
    });
    const orderTotals = Array.from({ length: 24 }, (_, h) => {
      const found = hourlyRows.find((r) => Number(r.hour) === h);
      return found ? Number(found.cnt) : 0;
    });
    const totalSales = hourTotals.reduce((a, b) => a + b, 0);
    const totalOrders = orderTotals.reduce((a, b) => a + b, 0);

    let bestSum = 0;
    let peakStartHour = 0;
    let peakLen = 1;
    for (let len = 1; len <= 8; len++) {
      for (let i = 0; i + len <= 24; i++) {
        const s = hourTotals.slice(i, i + len).reduce((a, b) => a + b, 0);
        if (s > bestSum) {
          bestSum = s;
          peakStartHour = i;
          peakLen = len;
        }
      }
    }
    const peakShare =
      totalSales > 0 ? Math.round((10000 * bestSum) / totalSales) / 100 : 0;

    const hourlySales = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      orderCount: orderTotals[hour] ?? 0,
      salesMinor: hourTotals[hour] ?? 0,
    }));

    return {
      semantics: 'rolling_branch_local_days_hour_of_day' as const,
      branchId,
      branchTimezone: tz,
      window: {
        startDay,
        endDay,
        days,
        startUtc: start.toISOString(),
        endUtc: windowEnd.toISOString(),
      },
      totalSalesMinor: totalSales,
      paidOrderCount: totalOrders,
      hourlySales,
      peakContiguousHours: {
        startHour: peakStartHour,
        endHourExclusive: peakStartHour + peakLen,
        salesMinor: bestSum,
        shareOfWindowSalesPct: peakShare,
      },
    };
  }

  /**
   * Net paid sales per branch for one **local** calendar date in each branch’s timezone.
   */
  async branchLocalDaySnapshot(tenantId: string, dateYmd: string) {
    this.assertLocalMysqlReportSupport('Branch local-day snapshot');
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    const normalized = normalizeCalendarDateInput(dateYmd);
    if (!normalized) {
      throw new BadRequestException('Invalid date; use YYYY-MM-DD');
    }

    const limits = this.commerce.getEffectiveLimits(tenant);
    const branchCap = Math.min(limits.maxBranches, 25);
    const branches = await this.prisma.branch.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, slug: true, timezone: true },
      take: branchCap,
    });

    const now = new Date();
    const rows = await Promise.all(
      branches.map(async (b) => {
        const tzRaw = b.timezone || 'UTC';
        const tz = assertSafeIanaTimeZone(tzRaw);
        const { start, end } = zonedDayBoundsUtc(normalized, tzRaw);
        const windowEnd =
          normalized === calendarDateInTimeZone(now, tzRaw)
            ? new Date(Math.min(end.getTime(), now.getTime()))
            : end;
        const agg = await this.paidDayAggregate(
          b.id,
          tenantId,
          start,
          windowEnd,
        );
        return {
          branchId: b.id,
          name: b.name,
          slug: b.slug,
          branchTimezone: tz,
          netPaidSalesMinor: Number(agg.total),
          paidOrderCount: Number(agg.count),
        };
      }),
    );

    return {
      semantics: 'each_branch_local_calendar_day' as const,
      date: normalized,
      branchLimit: branchCap,
      branches: rows,
    };
  }

  /**
   * Read-only tenant rollup — UTC `paidAt` window. Differs from per-branch daily reports
   * when branches use non-UTC timezones (see MULTIBRANCH_READ_PILOT.md).
   */
  async tenantRollup(tenantId: string, fromInput?: string, toInput?: string) {
    this.assertLocalMysqlReportSupport('Tenant rollup');
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const { from, to } = this.resolveRollupDateRange(fromInput, toInput);
    const { startUtc, endExclusiveUtc } = this.utcInclusiveRangeBounds(
      from,
      to,
    );
    const limits = this.commerce.getEffectiveLimits(tenant);
    const branchCap = Math.min(limits.maxBranches, 25);

    const branches = await this.prisma.branch.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, slug: true },
      take: branchCap,
    });
    const branchIds = branches.map((b) => b.id);

    if (branchIds.length === 0) {
      return {
        semantics: 'utc_inclusive_date_range' as const,
        fromUtc: from,
        toUtcInclusive: to,
        paidAtWindow: {
          start: startUtc.toISOString(),
          endExclusive: endExclusiveUtc.toISOString(),
        },
        branchLimit: branchCap,
        branchIdsIncluded: [] as string[],
        branchesInScope: [] as Array<{
          branchId: string;
          name: string;
          slug: string;
        }>,
        netPaidSalesMinor: 0,
        paidOrderCount: 0,
        averageTicketMinor: 0,
        salesByOrderType: {} as Record<string, number>,
        orderCountByOrderType: {} as Record<string, number>,
        topBranchesBySales: [] as Array<{
          branchId: string;
          name: string;
          netPaidSalesMinor: number;
          paidOrderCount: number;
        }>,
        discountPressure: {
          totalDiscountMinor: 0,
          ordersWithDiscountCount: 0,
        },
        priorPeriod: null,
      };
    }

    const branchSql = Prisma.join(branchIds);

    const durationMs = endExclusiveUtc.getTime() - startUtc.getTime();
    const prevEndExclusiveUtc = startUtc;
    const prevStartUtc = new Date(prevEndExclusiveUtc.getTime() - durationMs);

    const [totRow] = await this.prisma.$queryRaw<
      [{ sales: bigint | null; cnt: bigint | null }]
    >`
      SELECT COALESCE(SUM(o."totalMinor"), 0)::bigint AS sales,
        COUNT(*)::bigint AS cnt
      FROM "Order" o
      WHERE o."tenantId" = ${tenantId}
        AND o."branchId" IN (${branchSql})
        AND o.status = ${OrderStatus.PAID}::"OrderStatus"
        AND o."paidAt" >= ${startUtc}
        AND o."paidAt" < ${endExclusiveUtc}
    `;

    const [prevTotRow] = await this.prisma.$queryRaw<
      [{ sales: bigint | null; cnt: bigint | null }]
    >`
      SELECT COALESCE(SUM(o."totalMinor"), 0)::bigint AS sales,
        COUNT(*)::bigint AS cnt
      FROM "Order" o
      WHERE o."tenantId" = ${tenantId}
        AND o."branchId" IN (${branchSql})
        AND o.status = ${OrderStatus.PAID}::"OrderStatus"
        AND o."paidAt" >= ${prevStartUtc}
        AND o."paidAt" < ${prevEndExclusiveUtc}
    `;

    const typeRows = await this.prisma.$queryRaw<
      Array<{ type: string; total: bigint; cnt: bigint }>
    >`
      SELECT o.type::text AS type,
        COALESCE(SUM(o."totalMinor"), 0)::bigint AS total,
        COUNT(*)::bigint AS cnt
      FROM "Order" o
      WHERE o."tenantId" = ${tenantId}
        AND o."branchId" IN (${branchSql})
        AND o.status = ${OrderStatus.PAID}::"OrderStatus"
        AND o."paidAt" >= ${startUtc}
        AND o."paidAt" < ${endExclusiveUtc}
      GROUP BY o.type
    `;

    const [discRow] = await this.prisma.$queryRaw<
      [{ totalDisc: bigint | null; withDisc: bigint | null }]
    >`
      SELECT
        COALESCE(SUM(GREATEST(o."subtotalMinor" - o."totalMinor", 0)), 0)::bigint AS "totalDisc",
        COUNT(*) FILTER (WHERE o."subtotalMinor" > o."totalMinor")::bigint AS "withDisc"
      FROM "Order" o
      WHERE o."tenantId" = ${tenantId}
        AND o."branchId" IN (${branchSql})
        AND o.status = ${OrderStatus.PAID}::"OrderStatus"
        AND o."paidAt" >= ${startUtc}
        AND o."paidAt" < ${endExclusiveUtc}
    `;

    const topBranchRows = await this.prisma.$queryRaw<
      Array<{ branchId: string; name: string; sales: bigint; cnt: bigint }>
    >`
      SELECT o."branchId", b.name,
        COALESCE(SUM(o."totalMinor"), 0)::bigint AS sales,
        COUNT(*)::bigint AS cnt
      FROM "Order" o
      INNER JOIN "Branch" b ON b.id = o."branchId"
      WHERE o."tenantId" = ${tenantId}
        AND o."branchId" IN (${branchSql})
        AND o.status = ${OrderStatus.PAID}::"OrderStatus"
        AND o."paidAt" >= ${startUtc}
        AND o."paidAt" < ${endExclusiveUtc}
      GROUP BY o."branchId", b.name
      ORDER BY sales DESC
      LIMIT 10
    `;

    const netPaidSalesMinor = Number(totRow?.sales ?? 0n);
    const paidOrderCount = Number(totRow?.cnt ?? 0n);
    const prevNetPaidSalesMinor = Number(prevTotRow?.sales ?? 0n);
    const prevPaidOrderCount = Number(prevTotRow?.cnt ?? 0n);
    const averageTicketMinor = paidOrderCount
      ? Math.round(netPaidSalesMinor / paidOrderCount)
      : 0;

    const salesByOrderType: Record<string, number> = {};
    const orderCountByOrderType: Record<string, number> = {};
    for (const r of typeRows) {
      salesByOrderType[r.type] = Number(r.total);
      orderCountByOrderType[r.type] = Number(r.cnt);
    }

    return {
      semantics: 'utc_inclusive_date_range' as const,
      fromUtc: from,
      toUtcInclusive: to,
      paidAtWindow: {
        start: startUtc.toISOString(),
        endExclusive: endExclusiveUtc.toISOString(),
      },
      branchLimit: branchCap,
      branchIdsIncluded: branchIds,
      branchesInScope: branches.map((b) => ({
        branchId: b.id,
        name: b.name,
        slug: b.slug,
      })),
      netPaidSalesMinor,
      paidOrderCount,
      averageTicketMinor,
      salesByOrderType,
      orderCountByOrderType,
      topBranchesBySales: topBranchRows.map((r) => ({
        branchId: r.branchId,
        name: r.name,
        netPaidSalesMinor: Number(r.sales),
        paidOrderCount: Number(r.cnt),
      })),
      discountPressure: {
        totalDiscountMinor: Number(discRow?.totalDisc ?? 0n),
        ordersWithDiscountCount: Number(discRow?.withDisc ?? 0n),
      },
      priorPeriod: {
        semantics: 'same_duration_utc_immediately_before' as const,
        paidAtWindow: {
          start: prevStartUtc.toISOString(),
          endExclusive: prevEndExclusiveUtc.toISOString(),
        },
        netPaidSalesMinor: prevNetPaidSalesMinor,
        paidOrderCount: prevPaidOrderCount,
      },
    };
  }

  /**
   * Paid-order revenue by customer over a rolling window (tenant scope, plan branch cap).
   * For manager visibility into repeat spend — not a CRM export.
   */
  async repeatCustomersRollup(tenantId: string, daysInput?: number) {
    this.assertLocalMysqlReportSupport('Repeat-customer rollup');
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    const days = Math.min(Math.max(daysInput ?? 90, 7), 365);
    const since = new Date(Date.now() - days * 86_400_000);
    const limits = this.commerce.getEffectiveLimits(tenant);
    const branchCap = Math.min(limits.maxBranches, 25);
    const branches = await this.prisma.branch.findMany({
      where: { tenantId },
      select: { id: true },
      take: branchCap,
      orderBy: { createdAt: 'asc' },
    });
    const branchIds = branches.map((b) => b.id);
    if (branchIds.length === 0) {
      return {
        semantics: 'tenant_repeat_customers' as const,
        days,
        branchLimit: branchCap,
        sinceUtc: since.toISOString(),
        customers: [] as Array<{
          customerId: string;
          phone: string;
          name: string | null;
          paidOrderCount: number;
          netPaidSalesMinor: number;
        }>,
      };
    }
    const branchSql = Prisma.join(branchIds);
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        phone: string;
        name: string | null;
        paid_orders: bigint;
        net_minor: bigint;
      }>
    >`
      SELECT c.id, c.phone, c.name,
        COUNT(o.id)::bigint AS paid_orders,
        COALESCE(SUM(o."totalMinor"), 0)::bigint AS net_minor
      FROM "Customer" c
      INNER JOIN "Order" o ON o."customerId" = c.id
      WHERE c."tenantId" = ${tenantId}
        AND o."branchId" IN (${branchSql})
        AND o.status = ${OrderStatus.PAID}::"OrderStatus"
        AND o."paidAt" >= ${since}
      GROUP BY c.id, c.phone, c.name
      ORDER BY net_minor DESC
      LIMIT 40
    `;
    return {
      semantics: 'tenant_repeat_customers' as const,
      days,
      branchLimit: branchCap,
      sinceUtc: since.toISOString(),
      customers: rows.map((r) => ({
        customerId: r.id,
        phone: r.phone,
        name: r.name,
        paidOrderCount: Number(r.paid_orders),
        netPaidSalesMinor: Number(r.net_minor),
      })),
    };
  }

  /**
   * Removes `CustomerVisit` rows older than the retention window and recomputes denormalized
   * `visitCount` for all customers in the tenant. Intended as an occasional GDPR / housekeeping
   * action — not a scheduled job in this codebase.
   */
  async archiveStaleCustomerVisits(tenantId: string, yearsInput?: number) {
    this.assertLocalMysqlReportSupport('Visit archive');
    const years = Math.min(Math.max(yearsInput ?? 7, 1), 30);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    const cutoff = new Date();
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);

    const deleted = await this.prisma.customerVisit.deleteMany({
      where: {
        visitedAt: { lt: cutoff },
        customer: { tenantId },
      },
    });

    await this.prisma.$executeRaw`
      UPDATE "Customer" c
      SET "visitCount" = COALESCE(
        (SELECT COUNT(*)::int FROM "CustomerVisit" v WHERE v."customerId" = c.id),
        0
      )
      WHERE c."tenantId" = ${tenantId}
    `;

    return {
      semantics: 'archive_stale_customer_visits' as const,
      years,
      cutoffUtc: cutoff.toISOString(),
      deletedVisitRows: deleted.count,
    };
  }

  private resolveRollupDateRange(
    fromInput?: string,
    toInput?: string,
  ): { from: string; to: string } {
    const hasFrom = Boolean(fromInput?.trim());
    const hasTo = Boolean(toInput?.trim());
    if (!hasFrom && !hasTo) {
      const now = new Date();
      const toDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const fromDate = new Date(toDate);
      fromDate.setUTCDate(fromDate.getUTCDate() - 6);
      return {
        from: this.formatUtcYmd(fromDate),
        to: this.formatUtcYmd(toDate),
      };
    }
    if (!hasFrom || !hasTo) {
      throw new BadRequestException(
        'Provide both from and to (YYYY-MM-DD) or omit both for the default 7-day UTC range',
      );
    }
    const from = fromInput!.trim();
    const to = toInput!.trim();
    if (from > to) {
      throw new BadRequestException('from must be on or before to');
    }
    const startMs = Date.parse(`${from}T00:00:00.000Z`);
    const endMs = Date.parse(`${to}T00:00:00.000Z`);
    const daysInclusive = (endMs - startMs) / 86_400_000 + 1;
    if (daysInclusive > 31) {
      throw new BadRequestException(
        'Date range cannot exceed 31 calendar days (UTC)',
      );
    }
    return { from, to };
  }

  private formatUtcYmd(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private utcInclusiveRangeBounds(from: string, to: string) {
    const startUtc = new Date(`${from}T00:00:00.000Z`);
    const endExclusiveUtc = new Date(`${to}T00:00:00.000Z`);
    endExclusiveUtc.setUTCDate(endExclusiveUtc.getUTCDate() + 1);
    return { startUtc, endExclusiveUtc };
  }
}
