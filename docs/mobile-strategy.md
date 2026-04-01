# Mobile Strategy

Date: 2026-03-30

## Executive recommendation

Do not start a full native mobile app yet.

The best current mobile strategy for this repository is:

1. Keep improving `apps/ops-web` as the primary cross-platform operational surface.
2. Treat it as a tablet-first PWA for shared venue devices and limited manager-on-phone access.
3. Defer a native app until product and API prerequisites are fixed.
4. If native becomes justified later, prefer a narrow React Native / Expo companion app rather than a full operational rewrite.

## Why this is the current recommendation

### Confirmed codebase facts

- `apps/ops-web` is already the operational product surface and already includes `vite-plugin-pwa`.
- `apps/ops-web` has English/Arabic and RTL support foundations, though not complete across every route.
- The backend is branch-scoped and expects `X-Branch-Id` on many operational routes.
- Session refresh exists in the API; `apps/ops-web` implements access rotation via `/auth/refresh` and proactive refresh.
- Offline support is primitive and explicitly limited to retry-safe actions.
- Critical dine-in E2E can be exercised through **UI** helpers; keep verifying against real deployments.
- Product docs explicitly say native customer mobile apps are out of scope for the current growth phase.

Those facts point to "finish the browser-first product and contract layer first", not "start a second full client now".

## Mobile-readiness summary

### Backend readiness for mobile

Good enough:

- JWT access and refresh endpoints exist.
- Realtime websocket contract exists.
- Order, kitchen, bar, reporting, inventory, customer, and public-menu APIs exist.
- Billing/access restrictions are enforced centrally.

Not ready enough:

- Typed client rollout is partial (hand-pinned `contract/*`, optional OpenAPI TS); run `pnpm run contract:openapi:export` for an offline spec.
- Native secure session storage and refresh UX are not validated outside the PWA.
- Branch selection is a required client concern and branch isolation is still tenant-wide.
- Pagination/search consistency is uneven across endpoints.
- Offline-safe mutation policy is narrow.
- Push is **partial**: device registration + **Postgres outbox** + in-process worker + swappable **provider port** (default noop) — **no FCM/APNs/Web Push** ([`notifications-readiness.md`](./operations/notifications-readiness.md)).
- No mobile-specific native session SDK or app-store distribution layer.

### Frontend and product readiness for mobile

Good enough:

- One operational web app already exists.
- Realtime invalidation and polling fallback exist.
- Tablet-style dashboard UX exists for kitchen/bar/floor/orders.

Not ready enough:

- Core order/session capture is productized for dine-in (`ops-web` floor flow); native would still re-validate all edge cases.
- Phone-first UX is not the current design center.
- Public/internal bilingual consistency is incomplete.
- Native apps would still need their own token storage and refresh scheduling (web PWA already renews access tokens).
- Offline queue is too primitive for a native staff app promise.

## Option comparison

| Option | Fit with repo today | Strengths | Weaknesses | Risk now | Verdict |
|---|---|---|---|---|---|
| React Native / Expo | Moderate later, weak now | TypeScript and React mental model reuse, good RTL support, push options, reasonable speed | Very little real code sharing today beyond domain knowledge; contract cleanup still required; dense ops UI still needs native redesign | Medium-high | Best native option later, not now |
| Flutter | Low | Excellent UI control, strong RTL support, solid cross-platform performance | Almost zero reuse from current frontend; separate team/tooling burden; contract layer still missing | High | Weaker than RN/Expo for this repo |
| Kotlin Multiplatform | Very low | Could share domain/network logic with native apps if a native team existed | No Kotlin foundation in repo, no shared domain package ready, still requires separate UIs, slowest path to value | Very high | Not justified |
| PWA-first | High right now | Existing product surface, fastest path, easiest rollout on tablets/shared devices, lowest implementation cost | Weak iOS/background/push story, limited offline capability, not ideal for a polished phone-native experience | Lowest | Best immediate path |
| Hybrid staged strategy | Highest overall | Lets the product ship value now through PWA while preserving the option of a later native companion app | Requires discipline to avoid premature native work | Low now, medium later | Best overall strategy |

## Final stack recommendation

### Choose now

Choose a hybrid staged approach with PWA-first delivery now.

That means:

- Do not start Flutter.
- Do not start Kotlin Multiplatform.
- Do not start a full React Native operational rewrite now.
- Continue with `ops-web` as the cross-platform product surface for staff tablets and browser access.

### Choose later if native becomes justified

If a native app becomes justified after the prerequisites below are complete, choose React Native / Expo.

Why React Native / Expo is the best later-native option for this repo:

- The current product team is already living in React + TypeScript.
- The product already has a bilingual/RTL web implementation that can inform mobile.
- A future native app would still need custom UI, but React mental-model reuse is real.
- Expo reduces release complexity for notifications, device integration, and store distribution compared with a raw native stack.

Why the other native options are weaker:

- Flutter would require the most UI and platform reinvention with minimal code reuse.
- Kotlin Multiplatform is architecturally clean only if there is already a native-first strategy and a shared Kotlin domain layer, which this repo does not have.

## What must be fixed before native mobile starts

1. Finish the staff critical path in the web product.
   - Specifically, table/session opening and order capture must be fully productized in UI.
2. Implement a real client token-refresh flow.
   - The API already supports refresh; the client must use it.
3. Tighten branch access semantics.
   - Per-branch membership cannot remain deferred if mobile use is expanded.
4. Extract or generate a typed contract layer.
   - Swagger is present, but the clients still hand-roll request and response shapes.
5. Define mutation safety by endpoint.
   - Which requests are safe to retry, queue, or replay must be explicit.
6. Decide the actual notification model.
   - Push, polling, or both.
7. Finish bilingual and RTL coverage across all product surfaces that mobile would expose.

## Recommended mobile v1 scope

If mobile work starts after the prerequisites, the first release should be a companion app, not a full operations replacement.

### Personas to serve first

- Owner
- Manager

### Personas to keep on web/tablet first

- Cashier
- Kitchen staff
- Bar staff
- Support/admin

Reason:

- Current cashier, prep, and floor workflows are dense, branch-scoped, and better suited to shared tablets or browser surfaces until the core product is more mature.

### Mobile v1 should include

- Branch switcher with clear tenant and branch context
- Today summary
- Open orders count and aging summary
- Kitchen/bar queue counts
- Revenue and paid-order snapshot
- Key alerts when billing/access or setup blocks operations
- Customer lookup read-only or light note-taking if it proves useful

### Mobile v1 should not include

- Full cashier close-bill flow
- Full dine-in order creation workflow
- Setup/onboarding administration
- Menu import and heavy admin configuration
- Internal support console
- Pilot portfolio management

## Tablet-first vs phone-first

Tablet-first is the better fit for current operations.

Why:

- Floor, kitchen, bar, and open-orders screens are dense and operational.
- Shared venue devices are already consistent with the browser/PWA model.
- The current product language and layout are closer to dashboard/tablet work than to phone-native task design.

## Recommended execution roadmap

### Phase 0: Prerequisites

- Complete the missing web operational flows.
- Add client-side refresh and retry discipline.
- Tighten branch access semantics.
- Normalize i18n/RTL coverage.
- Extract typed contracts.

### Phase 1: Mobile-through-web

- Harden `ops-web` as tablet-first PWA.
- Add stronger session recovery, installability guidance, and explicit degraded-connectivity UX.
- Restrict mobile claims to what the product really supports.

### Phase 2: Validate demand

- Prove that owners/managers actually need a phone-native experience that the PWA cannot satisfy.
- Prove the need for push notifications, app-store install, or device-native features.

### Phase 3: Native companion app

- Build a narrow React Native / Expo manager companion app.
- Keep core venue operations on web/tablet until the product is truly ready to migrate them.

## Bottom line

The best decision grounded in this repository is not "pick Flutter or React Native and start coding".

The best decision is:

- mobile later, not now
- PWA/tablet-first now
- React Native / Expo only after product and API maturity justify a native companion app

