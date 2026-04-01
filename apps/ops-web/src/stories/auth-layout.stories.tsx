import type { Meta, StoryObj } from "@storybook/react"

import { AuthLayout } from "@/layouts/AuthLayout"
import { Button } from "@/components/ui/button"

const meta: Meta = {
  title: "Shell/Auth Layout",
}

export default meta

type Story = StoryObj

export const AuthShell: Story = {
  render: () => (
    <div className="min-h-[80vh] border border-border/60">
      <AuthLayout />
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div className="w-full max-w-md rounded-xl border border-border/60 bg-card/80 p-6 shadow-lg">
          <h2 className="text-2xl font-semibold">Staff access</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Secure sign in to live operations, kitchen, reports, and setup.
          </p>
          <div className="mt-4 grid gap-3">
            <div className="h-10 rounded-md border border-border/60 bg-muted/40" />
            <div className="h-10 rounded-md border border-border/60 bg-muted/40" />
            <Button size="sm">Sign in</Button>
          </div>
        </div>
      </div>
    </div>
  ),
}
