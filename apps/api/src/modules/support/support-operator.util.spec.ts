import type { Request } from 'express';
import {
  mergeSupportAuditMetadata,
  parseSupportOperatorHeader,
} from './support-operator.util';

describe('parseSupportOperatorHeader', () => {
  it('returns undefined for missing header', () => {
    expect(
      parseSupportOperatorHeader({ headers: {} } as Request),
    ).toBeUndefined();
  });

  it('trims and strips control characters', () => {
    const req = {
      headers: { 'x-support-operator': '  alice\t  ' },
    } as unknown as Request;
    expect(parseSupportOperatorHeader(req)).toBe('alice');
  });

  it('returns undefined when too long', () => {
    const req = {
      headers: { 'x-support-operator': 'a'.repeat(129) },
    } as unknown as Request;
    expect(parseSupportOperatorHeader(req)).toBeUndefined();
  });
});

describe('mergeSupportAuditMetadata', () => {
  it('adds supportOperator when present', () => {
    expect(mergeSupportAuditMetadata({ a: 1 }, 'bob')).toEqual({
      a: 1,
      supportOperator: 'bob',
    });
  });

  it('leaves metadata unchanged when operator absent', () => {
    expect(mergeSupportAuditMetadata({ a: 1 }, undefined)).toEqual({ a: 1 });
  });
});
