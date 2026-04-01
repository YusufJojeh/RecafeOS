import {
  IconCamera,
  IconChartBar,
  IconDashboard,
  IconDatabase,
  IconFileDescription,
  IconFileWord,
  IconFolder,
  IconHelp,
  IconListDetails,
  IconReport,
  IconPalette,
  IconSettings,
  IconUsers,
  type Icon,
} from "@tabler/icons-react"

export type NavItem = {
  titleKey: keyof typeof import("../i18n/en").en.nav
  to: string
  icon: Icon
  end?: boolean
  internal?: boolean
}

export type NavGroup = {
  id: string
  titleKey: keyof typeof import("../i18n/en").en.nav
  items: NavItem[]
  internal?: boolean
}

export const navGroups: NavGroup[] = [
  {
    id: "overview",
    titleKey: "overview",
    items: [
      { titleKey: "floor", to: "/floor", icon: IconDashboard, end: true },
      { titleKey: "orders", to: "/orders", icon: IconListDetails },
    ],
  },
  {
    id: "service",
    titleKey: "service",
    items: [
      { titleKey: "menu", to: "/menu", icon: IconFileDescription },
      { titleKey: "customers", to: "/customers", icon: IconUsers },
    ],
  },
  {
    id: "stations",
    titleKey: "stations",
    items: [
      { titleKey: "kitchen", to: "/kitchen", icon: IconCamera },
      { titleKey: "bar", to: "/bar", icon: IconFolder },
    ],
  },
  {
    id: "intelligence",
    titleKey: "intelligence",
    items: [
      { titleKey: "reports", to: "/reports", icon: IconChartBar },
      { titleKey: "shiftHandoff", to: "/reports/shift-handoff", icon: IconReport },
      { titleKey: "weeklyDigest", to: "/weekly-digest", icon: IconFileWord },
    ],
  },
  {
    id: "operations",
    titleKey: "operations",
    items: [
      { titleKey: "stock", to: "/stock", icon: IconDatabase },
      { titleKey: "menuBranding", to: "/branding/menu", icon: IconPalette },
      { titleKey: "setup", to: "/setup", icon: IconSettings },
    ],
  },
  {
    id: "internal",
    titleKey: "internal",
    internal: true,
    items: [
      { titleKey: "supportConsole", to: "/internal/support", icon: IconHelp, internal: true },
      { titleKey: "pilotPortfolio", to: "/internal/pilots", icon: IconListDetails, internal: true },
      { titleKey: "pilotWeekly", to: "/internal/pilots/weekly", icon: IconReport, internal: true },
    ],
  },
]

export const navBrand = {
  name: "RestoCafe OS",
  icon: IconDashboard,
}
