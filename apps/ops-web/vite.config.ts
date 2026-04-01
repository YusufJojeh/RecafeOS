import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isModule = (id: string, name: string) =>
    new RegExp(`[\\\\/]${name}[\\\\/]`).test(id);
  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@restocafe/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        includeAssets: [
          'icon.svg',
          'icon-192.png',
          'icon-512.png',
          'icon-maskable-512.png',
          'apple-touch-icon.png',
        ],
        registerType: 'autoUpdate',
        workbox: {
          cleanupOutdatedCaches: true,
          navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//],
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'ops-shell',
                networkTimeoutSeconds: 3,
              },
            },
            {
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'ops-images',
              },
            },
          ],
        },
        manifest: {
          name: 'RestoCafe OS',
          short_name: 'RestoCafe',
          description:
            'Tablet-first restaurant operations PWA for floor, kitchen, bar, reports, and setup.',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          /** Kitchen/bar and mounted tablets often use landscape; portrait-only was a tablet-readiness blocker. */
          orientation: 'any',
          start_url: '/floor',
          scope: '/',
          lang: 'en',
          dir: 'ltr',
          categories: ['business', 'productivity', 'food'],
          icons: [
            {
              src: 'icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          shortcuts: [
            {
              name: 'Floor',
              short_name: 'Floor',
              url: '/floor',
            },
            {
              name: 'Kitchen',
              short_name: 'Kitchen',
              url: '/kitchen',
            },
            {
              name: 'Open orders',
              short_name: 'Orders',
              url: '/orders',
            },
          ],
        },
      }),
    ],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_PROXY_API ?? 'http://localhost:3000',
          changeOrigin: true,
        },
        /** Socket.IO (Nest `OpsGateway`); keep in sync with `socket.io-client` path `/socket.io`. */
        '/socket.io': {
          target: env.VITE_PROXY_API ?? 'http://localhost:3000',
          changeOrigin: true,
          ws: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return;
            }
            if (id.includes('recharts')) {
              return 'charts-vendor';
            }
            if (id.includes('socket.io-client') || id.includes('dexie')) {
              return 'ops-runtime-vendor';
            }
            if (id.includes('@tanstack/')) {
              return 'tanstack-vendor';
            }
            if (
              id.includes('radix-ui') ||
              id.includes('@dnd-kit') ||
              id.includes('lucide-react') ||
              id.includes('sonner') ||
              id.includes('vaul') ||
              id.includes('react-hook-form') ||
              id.includes('@hookform/resolvers') ||
              id.includes('zod')
            ) {
              return 'ui-vendor';
            }
            if (
              isModule(id, 'react') ||
              isModule(id, 'react-dom') ||
              id.includes('react-router') ||
              id.includes('zustand')
            ) {
              return 'react-vendor';
            }
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.ts',
      exclude: ['**/node_modules/**', '**/e2e/**'],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/test/**',
          'src/**/*.test.{ts,tsx}',
          'src/main.tsx',
          'src/vite-env.d.ts',
        ],
        thresholds: {
          lines: 80,
          functions: 55,
          branches: 75,
          statements: 80,
        },
        reporter: ['text', 'lcov'],
      },
    },
  };
});
