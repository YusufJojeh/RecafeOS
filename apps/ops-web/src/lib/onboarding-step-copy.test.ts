import { describe, expect, it } from "vitest"
import { ar } from "@/i18n/ar"
import { en } from "@/i18n/en"
import {
  buildOnboardingChecklistCsv,
  KNOWN_ONBOARDING_STEP_IDS,
  onboardingDoneForCsv,
  onboardingTierForCsv,
  resolveOnboardingStepCopy,
} from "./onboarding-step-copy"

const apiEnglishMenuStep = {
  id: "menu",
  label: "SERVER_EN_LABEL_SHOULD_BE_REPLACED",
  why: "SERVER_EN_WHY_SHOULD_BE_REPLACED",
}

const unknownStep = {
  id: "futureStepFromApi",
  label: "Only fallback visible",
  why: "Rationale from server",
}

describe("onboarding-step-copy", () => {
  it("exposes one entry per known API step id", () => {
    for (const id of KNOWN_ONBOARDING_STEP_IDS) {
      expect(en.setupPage.onboardingSteps).toHaveProperty(id)
      expect(ar.setupPage.onboardingSteps).toHaveProperty(id)
    }
  })

  it("resolveOnboardingStepCopy uses locale bundle for known ids (EN)", () => {
    const r = resolveOnboardingStepCopy(apiEnglishMenuStep, en.setupPage.onboardingSteps)
    expect(r.label).toBe(en.setupPage.onboardingSteps.menu.label)
    expect(r.why).toBe(en.setupPage.onboardingSteps.menu.why)
    expect(r.label).not.toContain("SERVER_EN")
  })

  it("resolveOnboardingStepCopy uses locale bundle for known ids (AR)", () => {
    const r = resolveOnboardingStepCopy(apiEnglishMenuStep, ar.setupPage.onboardingSteps)
    expect(r.label).toBe(ar.setupPage.onboardingSteps.menu.label)
    expect(r.why).toBe(ar.setupPage.onboardingSteps.menu.why)
    expect(r.label).not.toContain(apiEnglishMenuStep.label)
  })

  it("falls back to API strings for unknown step ids", () => {
    const r = resolveOnboardingStepCopy(unknownStep, en.setupPage.onboardingSteps)
    expect(r).toEqual({ label: unknownStep.label, why: unknownStep.why })
  })

  it("buildOnboardingChecklistCsv uses localized headers and cells (AR)", () => {
    const csv = buildOnboardingChecklistCsv(
      [
        {
          ...apiEnglishMenuStep,
          done: false,
          tier: "blocking",
        },
      ],
      ar.setupPage,
    )
    expect(csv.split("\n")[0]).toContain(ar.setupPage.onboardingCsv.colLabel)
    expect(csv).toContain(ar.setupPage.onboardingSteps.menu.label)
    expect(csv).not.toContain(apiEnglishMenuStep.label)
    expect(csv).toContain(
      onboardingTierForCsv("blocking", ar.setupPage.onboardingCsv),
    )
    expect(csv).toContain(onboardingDoneForCsv(false, ar.setupPage.onboardingCsv))
  })
})
