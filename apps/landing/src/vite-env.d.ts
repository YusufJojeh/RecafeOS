/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LANDING_CONTACT_EMAIL?: string;
  readonly VITE_LANDING_DEMO_URL?: string;
  readonly VITE_LANDING_WHATSAPP_NUMBER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
