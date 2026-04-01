import * as React from "react"
import { IconInnerShadowTop } from "@tabler/icons-react"
import { NavLink, useLocation } from "react-router-dom"

import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { navBrand, navGroups } from "@/lib/nav"
import { canSeeNavPath } from "@/lib/nav-permissions"
import { useStaffPermissions } from "@/lib/staff-permissions"
import { useLanguage } from "@/i18n/context"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t } = useLanguage()
  const location = useLocation()
  const { permissions, isLoading } = useStaffPermissions()

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <NavLink to="/floor">
                <IconInnerShadowTop className="size-5!" />
                <span className="text-base font-semibold">
                  {navBrand.name}
                </span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {navGroups
          .filter((group) => !group.internal || import.meta.env.VITE_SUPPORT_CONSOLE === "true" || import.meta.env.VITE_SUPPORT_CONSOLE === "1")
          .map((group) => (
            <SidebarGroup key={group.id}>
              <SidebarGroupLabel>{t.nav[group.titleKey]}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items
                  .filter((item) => !item.internal || import.meta.env.VITE_SUPPORT_CONSOLE === "true" || import.meta.env.VITE_SUPPORT_CONSOLE === "1")
                  .filter(
                    (item) =>
                      item.internal ||
                      isLoading ||
                      canSeeNavPath(item.to, permissions),
                  )
                  .map((item) => {
                    const isActive =
                      item.to === "/floor"
                        ? location.pathname === "/floor"
                        : location.pathname === item.to ||
                          location.pathname.startsWith(`${item.to}/`)

                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={t.nav[item.titleKey]}
                        >
                          <NavLink to={item.to} end={item.end}>
                            <item.icon />
                            <span>{t.nav[item.titleKey]}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
              </SidebarMenu>
            </SidebarGroup>
          ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
