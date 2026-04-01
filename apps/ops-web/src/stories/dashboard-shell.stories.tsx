import type { Meta, StoryObj } from "@storybook/react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SectionCard } from "@/components/ConsoleUi"
import { SidebarInset } from "@/components/ui/sidebar"

const meta: Meta = {
  title: "Shell/Dashboard",
}

export default meta

type Story = StoryObj

export const Default: Story = {
  render: () => (
    <div className="flex min-h-[80vh] w-full overflow-hidden rounded-2xl border border-border/60 bg-background text-foreground">
      <AppSidebar />
      <SidebarInset className="flex w-full flex-col">
        <SiteHeader />
        <main className="flex-1 space-y-4 px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            <SectionCard title="KPI pulse" description="Snapshot of current service and revenue.">
              <div className="text-sm text-muted-foreground">
                Average ticket time is 12m. Dine-in demand up 8%.
              </div>
            </SectionCard>
            <SectionCard title="Open tasks" description="Actions queued for shift lead.">
              <ul className="list-disc space-y-1 ps-4 text-sm text-muted-foreground">
                <li>Review stock variance on Milk</li>
                <li>Close open shift notes</li>
                <li>Approve discounted orders</li>
              </ul>
            </SectionCard>
          </div>
          <SectionCard title="Service notes" description="Latest operational context from the team.">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm">
                Lunch wave started early today.
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm">
                Espresso grinder cleaned at 08:20.
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm">
                Bar station prepped for happy hour.
              </div>
            </div>
          </SectionCard>
        </main>
      </SidebarInset>
    </div>
  ),
}
