# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start dev server (Vite)
npm run build      # production build
npm run preview    # preview production build locally
npm run test       # run tests once (Vitest)
npm run test:watch # run tests in watch mode
```

Run a single test file:
```bash
npx vitest run src/test/orders.test.js
```

## Git Workflow

Feature branch: `claude/cool-tesla-rktpuc` → fast-forward merge to `main` → Vercel auto-deploys.

```bash
git checkout claude/cool-tesla-rktpuc
# ... make changes, commit ...
git checkout main && git merge --ff-only claude/cool-tesla-rktpuc && git push origin main
```

## Architecture

### Data Flow

Orders are the core entity. They live in Supabase (`orders` table) and are loaded once on app start into React state in `App.jsx`. All pages receive `orders` and `setOrders` as props from `App.jsx` — there is no global state library (no Redux, no Zustand).

Soft delete only: never hard-delete orders. Set `is_deleted = true` and add the ID to the `deleted_order_ids` blacklist in localStorage.

### Two-Layer Persistence Pattern

Almost all mutable data (livreurs, products, fees, factures, statuses) follows the same pattern:
1. **localStorage** — immediate read/write, works offline
2. **Supabase `settings` table** — cloud backup via `cloudGet(key)` / `cloudSet(key, value)` in `src/lib/cloudSettings.js`

`cloudSet` writes to localStorage first, then Supabase asynchronously. `cloudGet` tries Supabase first and falls back to localStorage.

Products specifically use `loadProducts()` (localStorage) + `loadProductsRemote()` (Supabase) from `src/data/products.js`. Use the `useProducts(optionalFilter)` hook instead of calling these directly.

### Cross-Device Sync

`App.jsx` subscribes to Supabase Realtime (`orders-realtime` channel) for live order updates across devices — INSERT, UPDATE, DELETE all propagate instantly. Settings (livreurs, products, etc.) are re-fetched from Supabase on `visibilitychange` (when the user returns to the tab/app).

The `mapRow(o)` helper in `App.jsx` converts a raw Supabase row to the app's order shape — use it instead of manually mapping fields.

### Offline Support

`src/lib/offlineStore.js` (IndexedDB via `idb`) queues mutations when offline. `useAutoSync` in `src/hooks/useAutoSync.js` flushes the queue when the connection returns.

### Key Files

| File | Role |
|------|------|
| `src/App.jsx` | Root: auth, order loading, routing, Realtime sync, offline/PWA banners |
| `src/lib/cloudSettings.js` | `cloudGet` / `cloudSet` — the two-layer persistence helpers |
| `src/data/products.js` | `loadProducts`, `saveProducts`, `loadProductsRemote` |
| `src/data/statuses.js` | Order status definitions |
| `src/contexts/StatusContext.jsx` | Status list with Supabase realtime sync |
| `src/lib/permissions.jsx` | `PermissionsProvider` + `usePermissions` hook |
| `src/lib/scanUtils.ts` | Shared scan business rules (`findOrderByCode`, `checkRamassageScan`, `checkRetourScan`) — TypeScript, unit-tested |
| `src/hooks/useBarcodeScanner.js` | Shared continuous camera scanner (BarcodeDetector + jsQR fallback) used by Ramassage, Retour and colis ScanModal |
| `src/components/colis/` | Pieces split out of ListeColisPage: SheetImportSection, DeliveryStatusModal, ScanModal |

### Custom Hooks

| Hook | Purpose |
|------|---------|
| `useProducts(filter?)` | Local-first product load with remote refresh |
| `useCountUp(target, duration?)` | Animated number count-up (rAF, cubic ease-out) |
| `useSearchShortcut(inputRef)` | Focus input on `/` keypress |
| `useDebounce(value, delay)` | Debounce for search inputs |
| `useAutoSync()` | Flush offline mutation queue on reconnect |
| `useNotifications()` | In-app notification state |
| `useOrderNotifications()` | Browser Push Notification API — `notifyNewOrder(order)` |
| `useBarcodeScanner(active, videoId, onCode, onError)` | Continuous barcode scanning on a `<video>` element |

### Order History

`OrdersPage.jsx` has `recordHistory(orderId, status, user, fromStatus?, note?)` which logs status changes and livreur changes to:
- `localStorage` key `order_history_{orderId}` (per device cache)
- Supabase `order_history` table (`order_id`, `status`, `user_name`, `timestamp`)

`HistoryModal` reads both sources and shows "from → to" transitions. Call `recordHistory` whenever a meaningful field changes on an order.

### UI Conventions

- **Toasts** — use `useToast()` from `src/components/Toast.jsx` (`toast.success`, `toast.error`, etc.). Never use `alert()`.
- **Skeletons** — show `animate-pulse` placeholder rows while loading, not spinners.
- **Tables** — wrap in `<div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">` with alternating `bg-white` / `bg-gray-50` rows.
- **Animations** — `page-enter` class (defined in `src/index.css`) for route transitions; `animate-fade-in` and `animate-slide-in` via Tailwind config (`src/tailwind.config.js`).
- **Search inputs** — attach `ref={searchRef}` and `useSearchShortcut(searchRef)`, set placeholder to `"Rechercher... (/)"`.
- **Keyboard navigation** — OrdersPage tabs support `←` / `→` arrow keys.
- **Memoization** — wrap stable sub-components with `React.memo`; use `useMemo`/`useCallback` for expensive derivations passed as props.

### All pages are lazy-loaded

`App.jsx` uses `React.lazy` for every page component. Stale chunk errors after a Vercel deploy are expected — the `PWAUpdateBanner` detects SW controller changes and prompts a reload.

### Analytics Page (`/analytics`)

`src/components/AnalyticsPage.jsx` receives `orders` as a prop and computes all stats client-side with `useMemo`. Shows: KPI cards, daily bar chart (7/30/90 days), status pie chart, top cities, top products, livreur performance table. Uses `recharts` (already in dependencies).

Has an **Excel export** button (green, top-right) that generates a `.xlsx` file via `xlsx` library with two sheets: full orders list + summary stats. Filename is auto-generated with period and date.

### Liste des Colis PDF Export

`ListeColisPage` has a `printColisParLivreur(data)` function that opens a print window with orders grouped by livreur. Triggered by the 🖨️ button in the toolbar. If rows are selected, exports only selected; otherwise exports all colis. Uses `window.open` + `window.print()` — same pattern as `printFacture` in `FacturesPage.jsx`.

### Table Row Styling

Orders and Colis tables use `border-separate border-spacing-y-1` on the body `<table>` with `border border-gray-200 rounded-xl bg-white` on each `<tr>` — giving a card-per-row look. The sticky header uses a separate `<table>` with `border-collapse`.

### App Badge

`App.jsx` calls `navigator.setAppBadge(count)` whenever orders change to show the count of `nouveau` status orders on the PWA app icon. Works on Android Chrome/Edge with the app installed. Clears automatically when no pending orders.

## TypeScript & CI

TypeScript is enabled incrementally (`tsconfig.json`, `allowJs`). New logic modules should be `.ts`. `npm run typecheck` runs `tsc --noEmit`; GitHub Actions CI (`.github/workflows/ci.yml`) runs typecheck + tests + build on every push to main.

## Reçu flag

`orders.recu` (boolean column) is the source of truth for "colis reçu" (set by the Retour scanner and the Liste des Colis badge). The legacy `victoury_recu_ids` localStorage/cloud list is kept as fallback for old data.

## Environment Variables

Required in `.env.local` (and in Vercel dashboard):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## localStorage Keys Reference

| Key | Content |
|-----|---------|
| `livreurs` | `[{ id, nom, telephone, statut }]` |
| `frais_{id}` | `[{ ville, livre, refuse, annule, change }]` per livreur |
| `deleted_order_ids` | Soft-delete blacklist |
| `auzone_config` | `{ customerId, apiKey }` for Ozon Express |
| `woo_config` | WooCommerce API config |
| `victoury_factures` | Saved factures array |
| `victoury_products` | Products array |
| `victoury_statuses` | Order status definitions |
| `order_history_{id}` | Per-order status change log (cache of Supabase `order_history`) |
