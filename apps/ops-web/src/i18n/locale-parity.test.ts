import { describe, expect, it } from "vitest"
import { ar } from "./ar"
import { en } from "./en"

function leafPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  let out: string[] = []
  for (const k of Object.keys(obj).sort()) {
    const path = prefix ? `${prefix}.${k}` : k
    const v = obj[k]
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out = out.concat(leafPaths(v as Record<string, unknown>, path))
    } else {
      out.push(path)
    }
  }
  return out
}

describe("Locale parity (en vs ar)", () => {
  it("has identical leaf key paths for full content trees", () => {
    const ek = leafPaths(en as unknown as Record<string, unknown>)
    const ak = leafPaths(ar as unknown as Record<string, unknown>)
    expect(ak).toEqual(ek)
  })
})
