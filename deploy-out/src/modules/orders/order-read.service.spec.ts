import { OrderReadService } from './order-read.service';

describe('OrderReadService', () => {
  it('loads cashier detail with menu item names and floor table label', async () => {
    const findForBranchOrThrow = jest
      .fn<
        Promise<{
          id: string;
          customerId: string;
          items: [];
          tableSession: null;
        }>,
        [string, string, string, unknown?]
      >()
      .mockResolvedValue({
        id: 'ord_1',
        customerId: 'cust_1',
        items: [],
        tableSession: null,
      });
    const customerVisit = {
      count: jest.fn().mockResolvedValue(2),
    };
    const service = new OrderReadService(
      { findForBranchOrThrow } as never,
      { customerVisit } as never,
    );

    const result = await service.getOne('branch_1', 'tenant_1', 'ord_1');
    const include = findForBranchOrThrow.mock.calls[0]?.[3] as {
      items?: {
        include?: {
          menuItem?: {
            select?: Record<string, boolean>;
          };
        };
      };
      tableSession?: {
        include?: {
          floorTable?: {
            select?: Record<string, boolean>;
          };
        };
      };
    };

    expect(findForBranchOrThrow).toHaveBeenCalledWith(
      'ord_1',
      'branch_1',
      'tenant_1',
      expect.any(Object),
    );
    expect(include.items?.include?.menuItem?.select).toEqual({
      id: true,
      name: true,
    });
    expect(include.tableSession?.include?.floorTable?.select).toEqual({
      id: true,
      label: true,
    });
    expect(customerVisit.count).toHaveBeenCalledWith({
      where: { customerId: 'cust_1', branchId: 'branch_1' },
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'ord_1',
        returningGuest: true,
      }),
    );
  });
});
