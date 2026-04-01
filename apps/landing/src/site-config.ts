const DEFAULT_WHATSAPP_NUMBER = '966500000000';
const DEFAULT_CONTACT_EMAIL = 'hello@restocafe.io';

export const siteConfig = {
  brandName: 'RestoCafe OS',
  demoHref: import.meta.env.VITE_LANDING_DEMO_URL || '#contact',
  contactEmail: import.meta.env.VITE_LANDING_CONTACT_EMAIL || DEFAULT_CONTACT_EMAIL,
  whatsappNumber:
    import.meta.env.VITE_LANDING_WHATSAPP_NUMBER || DEFAULT_WHATSAPP_NUMBER,
} as const;

export function createWhatsAppHref(message: string) {
  return `https://wa.me/${siteConfig.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
