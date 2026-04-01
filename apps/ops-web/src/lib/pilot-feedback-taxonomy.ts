/** Mirrors Prisma enums on API — keep in sync with create-pilot-feedback DTO. */

export const PILOT_FEEDBACK_TYPES = [
  'bug',
  'onboarding_issue',
  'training_issue',
  'support_issue',
  'product_gap',
  'feature_request',
  'nice_to_have',
] as const;

export const PILOT_FEEDBACK_SEVERITIES = [
  'sev1',
  'sev2',
  'sev3',
  'sev4',
  'low',
] as const;

export const PILOT_EVIDENCE_QUALITY = [
  'logged_request_id',
  'screenshot',
  'verbal_only',
] as const;

export const PILOT_FEEDBACK_STATUS = [
  'open',
  'triaged',
  'resolved',
  'closed',
] as const;

export type PilotFeedbackType = (typeof PILOT_FEEDBACK_TYPES)[number];
export type PilotFeedbackSeverity = (typeof PILOT_FEEDBACK_SEVERITIES)[number];
export type PilotEvidenceQuality = (typeof PILOT_EVIDENCE_QUALITY)[number];
export type PilotFeedbackStatus = (typeof PILOT_FEEDBACK_STATUS)[number];
