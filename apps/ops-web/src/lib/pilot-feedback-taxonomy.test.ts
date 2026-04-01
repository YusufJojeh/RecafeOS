import { describe, expect, it } from 'vitest';
import {
  PILOT_EVIDENCE_QUALITY,
  PILOT_FEEDBACK_SEVERITIES,
  PILOT_FEEDBACK_STATUS,
  PILOT_FEEDBACK_TYPES,
} from './pilot-feedback-taxonomy';

describe('pilot-feedback-taxonomy', () => {
  it('contains expected canonical values for types and statuses', () => {
    expect(PILOT_FEEDBACK_TYPES).toContain('bug');
    expect(PILOT_FEEDBACK_TYPES).toContain('feature_request');
    expect(PILOT_FEEDBACK_STATUS).toEqual(['open', 'triaged', 'resolved', 'closed']);
  });

  it('contains severity and evidence enums used by support triage', () => {
    expect(PILOT_FEEDBACK_SEVERITIES).toContain('sev1');
    expect(PILOT_FEEDBACK_SEVERITIES).toContain('low');
    expect(PILOT_EVIDENCE_QUALITY).toContain('screenshot');
  });
});
