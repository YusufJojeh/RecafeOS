const supportEmail =
  import.meta.env.VITE_SUPPORT_EMAIL?.trim() || "support@restocafe.com"
const supportWhatsApp =
  import.meta.env.VITE_SUPPORT_WHATSAPP?.trim() || "966500000000"

export const supportEmailHref = `mailto:${supportEmail}`
export const supportWhatsAppHref = `https://wa.me/${supportWhatsApp}`
