import type { Preview } from "@storybook/react"
import { MemoryRouter } from "react-router-dom"

import "../src/index.css"
import { SidebarProvider } from "../src/components/ui/sidebar"
import { LanguageProvider } from "../src/i18n/context"

const preview: Preview = {
  globalTypes: {
    locale: {
      description: "Language",
      defaultValue: "en",
      toolbar: {
        title: "Locale",
        items: [
          { value: "en", title: "English" },
          { value: "ar", title: "Arabic" },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const locale = context.globals.locale === "ar" ? "ar" : "en"
      try {
        localStorage.setItem("restocafe-lang", locale)
      } catch {
        // ignore storage errors in isolated preview environments
      }

      return (
        <LanguageProvider key={locale}>
          <MemoryRouter initialEntries={["/floor"]}>
            <SidebarProvider>
              <div className="min-h-screen bg-background p-6 text-foreground">
                <Story />
              </div>
            </SidebarProvider>
          </MemoryRouter>
        </LanguageProvider>
      )
    },
  ],
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: { expanded: true },
    backgrounds: {
      default: "app",
      values: [
        { name: "app", value: "hsl(var(--background))" },
        { name: "muted", value: "hsl(var(--muted))" },
      ],
    },
  },
}

export default preview
