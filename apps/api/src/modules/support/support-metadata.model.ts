/** Acknowledged limitation row in Tenant.metadata — see docs/operations/PILOT_METADATA_SCHEMA.md */
export type PilotLimitationAck = {
  id?: string;
  description: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  venueSignoff?: boolean | string;
};

function parseLimitationsAck(raw: unknown): PilotLimitationAck[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const out: PilotLimitationAck[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const o = item as Record<string, unknown>;
    const description =
      typeof o.description === 'string' ? o.description.trim() : '';
    if (!description) {
      continue;
    }
    out.push({
      id: typeof o.id === 'string' ? o.id : undefined,
      description,
      acknowledgedAt:
        typeof o.acknowledgedAt === 'string' ? o.acknowledgedAt : undefined,
      acknowledgedBy:
        typeof o.acknowledgedBy === 'string' ? o.acknowledgedBy : undefined,
      venueSignoff:
        typeof o.venueSignoff === 'boolean'
          ? o.venueSignoff
          : typeof o.venueSignoff === 'string'
            ? o.venueSignoff
            : undefined,
    });
  }
  return out.length ? out : undefined;
}

function parseStringArray(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const out = raw.filter(
    (x): x is string => typeof x === 'string' && x.length > 0,
  );
  return out.length ? out : undefined;
}

/** `Tenant.metadata.branchRollouts` — see docs/growth/BRANCH_ROLLOUT_MODEL.md */
export type BranchRolloutEntry = {
  branchId: string;
  stage: string;
  updatedAt: string;
  owner?: string;
  notes?: string;
};

export function parseBranchRolloutsFromMetadata(
  metadata: unknown,
): BranchRolloutEntry[] | undefined {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }
  const raw = (metadata as Record<string, unknown>).branchRollouts;
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const out: BranchRolloutEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const o = item as Record<string, unknown>;
    const branchId = typeof o.branchId === 'string' ? o.branchId.trim() : '';
    const stage = typeof o.stage === 'string' ? o.stage.trim() : '';
    const updatedAt = typeof o.updatedAt === 'string' ? o.updatedAt.trim() : '';
    if (!branchId || !stage || !updatedAt) {
      continue;
    }
    out.push({
      branchId,
      stage,
      updatedAt,
      owner: typeof o.owner === 'string' ? o.owner : undefined,
      notes: typeof o.notes === 'string' ? o.notes : undefined,
    });
  }
  return out.length ? out : undefined;
}

function parseEnabledModulesSnapshot(
  raw: unknown,
): Record<string, boolean> | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  const entries = Object.entries(o).filter(
    (e): e is [string, boolean] => typeof e[1] === 'boolean',
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/** Keys in Tenant.metadata used for pilots / demos — see docs/operations/PILOT_METADATA_SCHEMA.md */
export function extractPilotFromMetadata(metadata: unknown): {
  demo: boolean;
  commercialEngagement?: string;
  pilotPhase?: string;
  csOwner?: string;
  goLiveDate?: string;
  pilotNotes?: string;
  venueStatus?: string;
  goLiveDateActual?: string;
  engineeringLiaison?: string;
  pilotHealth?: string;
  limitationsAcknowledged?: PilotLimitationAck[];
  externalIncidentIds?: string[];
  enabledModulesSnapshot?: Record<string, boolean>;
  branchCountSnapshot?: number;
} {
  const m = (
    metadata && typeof metadata === 'object' ? metadata : {}
  ) as Record<string, unknown>;
  const branchSnap = m.branchCountSnapshot;
  return {
    demo: m.demo === true,
    commercialEngagement:
      typeof m.commercialEngagement === 'string'
        ? m.commercialEngagement
        : undefined,
    pilotPhase: typeof m.pilotPhase === 'string' ? m.pilotPhase : undefined,
    csOwner: typeof m.csOwner === 'string' ? m.csOwner : undefined,
    goLiveDate: typeof m.goLiveDate === 'string' ? m.goLiveDate : undefined,
    pilotNotes: typeof m.pilotNotes === 'string' ? m.pilotNotes : undefined,
    venueStatus: typeof m.venueStatus === 'string' ? m.venueStatus : undefined,
    goLiveDateActual:
      typeof m.goLiveDateActual === 'string' ? m.goLiveDateActual : undefined,
    engineeringLiaison:
      typeof m.engineeringLiaison === 'string'
        ? m.engineeringLiaison
        : undefined,
    pilotHealth: typeof m.pilotHealth === 'string' ? m.pilotHealth : undefined,
    limitationsAcknowledged: parseLimitationsAck(m.limitationsAcknowledged),
    externalIncidentIds: parseStringArray(m.externalIncidentIds),
    enabledModulesSnapshot: parseEnabledModulesSnapshot(
      m.enabledModulesSnapshot,
    ),
    branchCountSnapshot:
      typeof branchSnap === 'number' && Number.isFinite(branchSnap)
        ? branchSnap
        : undefined,
  };
}

/** Commercial / block context from metadata — see docs/operations/PILOT_METADATA_SCHEMA.md */
export function extractCommercialFromMetadata(metadata: unknown): {
  commercialEngagement?: string;
  blockReasonCode?: string;
  blockDetail?: string;
  trialExpiredAt?: string;
  suspensionReasonCode?: string;
  suspensionNote?: string;
  suspendedAt?: string;
  previousBillingStatus?: string;
} {
  const m = (
    metadata && typeof metadata === 'object' ? metadata : {}
  ) as Record<string, unknown>;
  const str = (k: string) => (typeof m[k] === 'string' ? m[k] : undefined);
  return {
    commercialEngagement: str('commercialEngagement'),
    blockReasonCode: str('blockReasonCode'),
    blockDetail: str('blockDetail'),
    trialExpiredAt: str('trialExpiredAt'),
    suspensionReasonCode: str('suspensionReasonCode'),
    suspensionNote: str('suspensionNote'),
    suspendedAt: str('suspendedAt'),
    previousBillingStatus: str('previousBillingStatus'),
  };
}
