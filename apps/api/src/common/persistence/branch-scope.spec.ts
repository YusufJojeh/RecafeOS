import {
  whereBranchInTenant,
  whereMenuItemOrderable,
  whereModifierOptionInBranch,
  whereUnderBranchTenant,
} from './branch-scope';

describe('AC: branch scope where-clauses include tenant', () => {
  it('whereBranchInTenant binds id and tenantId', () => {
    expect(whereBranchInTenant('b1', 't1')).toEqual({
      id: 'b1',
      tenantId: 't1',
    });
  });

  it('whereUnderBranchTenant binds branch relation', () => {
    expect(whereUnderBranchTenant('b1', 't1')).toEqual({
      branchId: 'b1',
      branch: { tenantId: 't1' },
    });
  });

  it('whereMenuItemOrderable scopes item to branch tenant', () => {
    expect(whereMenuItemOrderable('mi', 'b1', 't1')).toMatchObject({
      id: 'mi',
      available: true,
      branchId: 'b1',
      branch: { tenantId: 't1' },
    });
  });

  it('whereModifierOptionInBranch scopes via group', () => {
    expect(whereModifierOptionInBranch('opt', 'b1', 't1')).toMatchObject({
      id: 'opt',
      group: { branchId: 'b1', branch: { tenantId: 't1' } },
    });
  });
});
