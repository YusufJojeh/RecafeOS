import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "./index.css"
import { App } from "./App"
import { ThemeProvider } from "./components/theme-provider"
import { Toaster } from "./components/ui/sonner"
import { TooltipProvider } from "./components/ui/tooltip"
import { LanguageProvider } from "./i18n/context"
import { BranchRealtimeProvider } from "./lib/branch-realtime"
import { SessionNavBridge } from "./lib/session-nav-bridge"

const client = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      /** Reduces duplicate fetches when navigating between branch-scoped screens; override per-query where fresher data is required. */
      staleTime: 15_000,
    },
    mutations: {
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <LanguageProvider>
          <TooltipProvider delayDuration={200}>
            <BranchRealtimeProvider>
              <BrowserRouter>
                <SessionNavBridge />
                <App />
              </BrowserRouter>
            </BranchRealtimeProvider>
            <Toaster />
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
      {import.meta.env.DEV ? (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      ) : null}
    </QueryClientProvider>
  </StrictMode>,
);
