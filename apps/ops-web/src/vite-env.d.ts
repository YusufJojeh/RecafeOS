/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  /** When `"true"`, exposes `/internal/support`, `/internal/pilots`, `/internal/pilots/:tenantId`. */
  readonly VITE_SUPPORT_CONSOLE?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
  readonly VITE_SUPPORT_WHATSAPP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
