import { recalcOrderTotals } from './order-pricing';

describe('AC: order totals recalc', () => {
  it('computes subtotal and applies percent discount', async () => {
    const updates: {
      id: string;
      data: { subtotalMinor: number; totalMinor: number };
    }[] = [];
    const tx = {
      orderItem: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { lineTotalMinor: 500 },
            { lineTotalMinor: 300 },
          ]),
      },
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'o1',
          discountMinor: 0,
          discountPercent: 10,
        }),
        update: jest
          .fn()
          .mockImplementation(
            (_args: { where: { id: string }; data: object }) => {
              updates.push({
                id: 'o1',
                data: _args.data as {
                  subtotalMinor: number;
                  totalMinor: number;
                },
              });
            },
          ),
      },
    };
    await recalcOrderTotals(tx as never, 'o1');
    expect(tx.orderItem.findMany).toHaveBeenCalledWith({
      where: { orderId: 'o1' },
    });
    const last = updates[0]?.data;
    expect(last?.subtotalMinor).toBe(800);
    expect(last?.totalMinor).toBe(720);
  });
});
