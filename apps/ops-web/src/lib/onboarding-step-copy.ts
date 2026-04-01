import type { ContentMap } from "@/i18n/types"

type OnboardingStepLike = { id: string; label: string; why: string }

type SetupOnboarding = ContentMap["setupPage"]["onboardingSteps"]
type OnboardingCsv = ContentMap["setupPage"]["onboardingCsv"]

/** Known IDs from `apps/api/src/modules/branches/branches.service.ts` `baseSteps`. */
export const KNOWN_ONBOARDING_STEP_IDS = [
  "appPublicUrl",
  "menu",
  "tables",
  "qrSettings",
  "session",
  "smokeOrder",
] as const

export type KnownOnboardingStepId = (typeof KNOWN_ONBOARDING_STEP_IDS)[number]

export function resolveOnboardingStepCopy(
  step: OnboardingStepLike,
  onboardingSteps: SetupOnboarding,
): { label: string; why: string } {
  const row = (onboardingSteps as Record<string, { label: string; why: string }>)[
    step.id
  ]
  if (row?.label && row?.why) {
    return { label: row.label, why: row.why }
  }
  return { label: step.label, why: step.why }
}

export function onboardingTierForCsv(
  tier: "blocking" | "recommended",
  csv: OnboardingCsv,
): string {
  return tier === "blocking" ? csv.tierValueBlocking : csv.tierValueRecommended
}

export function onboardingDoneForCsv(done: boolean, csv: OnboardingCsv): string {
  return done ? csv.doneValueTrue : csv.doneValueFalse
}

export function buildOnboardingChecklistCsv(
  steps: Array<
    OnboardingStepLike & { done: boolean; tier: "blocking" | "recommended" }
  >,
  setupPage: ContentMap["setupPage"],
): string {
  const csv = setupPage.onboardingCsv
  const header = [csv.colId, csv.colTier, csv.colDone, csv.colLabel].join(",")
  const body = steps.map((s) => {
    const { label } = resolveOnboardingStepCopy(s, setupPage.onboardingSteps)
    return [
      s.id,
      onboardingTierForCsv(s.tier, csv),
      onboardingDoneForCsv(s.done, csv),
      `"${label.replace(/"/g, '""')}"`,
    ].join(",")
  })
  return [header, ...body].join("\n")
}
