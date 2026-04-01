import type { Meta, StoryObj } from "@storybook/react"

import {
  MetricCard,
  PageHeader,
  SectionCard,
  StatePanel,
} from "@/components/ConsoleUi"
import { Button } from "@/components/ui/button"

const meta: Meta<typeof PageHeader> = {
  title: "Console/UI",
  component: PageHeader,
  tags: ["autodocs"],
}

export default meta

type Story = StoryObj<typeof PageHeader>

export const PageChrome: Story = {
  render: () => (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title="Today at a glance"
        description="Core ops KPIs and alerts for the active branch."
        actions={<Button size="sm">New note</Button>}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Net sales" value="$12,450" detail="+6% vs prior week" tone="emerald" />
        <MetricCard label="Open checks" value="8" detail="2 late" tone="amber" />
        <MetricCard label="Low stock" value="3" detail="At risk items" tone="danger" />
      </div>
      <SectionCard
        title="Operational highlight"
        description="Status rollup for the last 2 hours."
        actions={<Button variant="outline" size="sm">Review</Button>}
      >
        <div className="text-sm text-muted-foreground">
          Delivery backlog is shrinking and ticket times are within SLA.
        </div>
      </SectionCard>
      <StatePanel
        variant="info"
        title="All stations stable"
        description="No blocking signals detected across floor, kitchen, and bar."
      />
    </div>
  ),
}
