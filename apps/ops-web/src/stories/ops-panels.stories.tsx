import type { Meta, StoryObj } from "@storybook/react"

import { CloseOfDayPanel } from "@/components/CloseOfDayPanel"
import { OperationalStrip } from "@/components/OperationalStrip"

const meta: Meta = {
  title: "Console/Panels",
}

export default meta

type Story = StoryObj

export const OperationalSignals: Story = {
  render: () => (
    <OperationalStrip
      data={{
        readyForGoLive: false,
        blockingIncompleteCount: 2,
        lowStockCount: 4,
        openShiftPresent: true,
      }}
    />
  ),
}

export const CloseOfDay: Story = {
  render: () => (
    <CloseOfDayPanel
      report={{
        totalSalesMinor: 245000,
        orderCount: 120,
        shifts: [
          {
            id: "s1",
            openedAt: "2026-03-28T08:00:00Z",
            closedAt: null,
            orderCount: 52,
            salesMinor: 125000,
          },
        ],
        flags: [
          {
            code: "DISC_HIGH",
            severity: "warn",
            message: "Discount share exceeded target threshold.",
          },
          {
            code: "CASH_OUT",
            severity: "risk",
            message: "Cash drawer variance detected.",
          },
        ],
      }}
    />
  ),
}
