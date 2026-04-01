import type { StringValue } from 'ms';

const DURATION_PATTERN = /^(\d+)(ms|s|m|h|d)?$/i;

const UNIT_TO_MS = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

export type ParsedDuration = {
  raw: string;
  milliseconds: number;
  seconds: number;
  jwtExpiresIn: StringValue | number;
};

export function parseDurationSpec(
  value: string,
  label = 'duration',
): ParsedDuration {
  const raw = value.trim();
  const match = DURATION_PATTERN.exec(raw);
  if (!match) {
    throw new Error(
      `${label} must be an integer with optional unit (ms, s, m, h, d). Received "${value}".`,
    );
  }

  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase() as keyof typeof UNIT_TO_MS | undefined;
  const milliseconds = unit ? amount * UNIT_TO_MS[unit] : amount * UNIT_TO_MS.s;

  return {
    raw,
    milliseconds,
    seconds: Math.ceil(milliseconds / 1_000),
    jwtExpiresIn: unit ? (raw as StringValue) : amount,
  };
}

export function isValidDurationSpec(value: string): boolean {
  return DURATION_PATTERN.test(value.trim());
}

export function addDuration(
  date: Date,
  value: string,
  label = 'duration',
): Date {
  return new Date(
    date.getTime() + parseDurationSpec(value, label).milliseconds,
  );
}
