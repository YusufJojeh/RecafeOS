import type { ContentMap as BaseContentMap } from "./en"

type DeepStringify<T> = T extends string
  ? string
  : T extends Record<string, unknown>
    ? { [K in keyof T]: DeepStringify<T[K]> }
    : T

export type Locale = "en" | "ar"
export type Dir = "ltr" | "rtl"
export type ContentMap = DeepStringify<BaseContentMap>
