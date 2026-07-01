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
# develop on feature branch
git checkout claude/cool-tesla-rktpuc

# merge to main when done
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

### Offline Support

`src/lib/offlineStore.js` (IndexedDB via `idb`) queues mutations when offline. `useAutoSync` in `src/hooks/useAutoSync.js` flushes the queue when the connection returns.

### Key Files

| File | Role |
|------|------|
| `src/App.jsx` | Root: auth, order loading, routing, offline/PWA banners |
| `src/lib/cloudSettings.js` | `cloudGet` / `cloudSet` — the two-layer persistence helpers |
| `src/data/products.js` | `loadProducts`, `saveProducts`, `loadProductsRemote` |
| `src/data/statuses.js` | Order status definitions |
| `src/contexts/StatusContext.jsx` | Status list with Supabase realtime sync |
| `src/lib/permissions.jsx` | `PermissionsProvider` + `usePermissions` hook |

### Custom Hooks

| Hook | Purpose |
|------|---------|
| `useProducts(filter?)` | Local-first product load with remote refresh |
| `useCountUp(target, duration?)` | Animated number count-up (rAF, cubic ease-out) |
| `useSearchShortcut(inputRef)` | Focus input on `/` keypress |
| `useDebounce(value, delay)` | Debounce for search inputs |
| `useAutoSync()` | Flush offline mutation queue on reconnect |
| `useNotifications()` | In-app notification state |

### UI Conventions

- **Toasts** — use `useToast()` from `src/components/Toast.jsx` (`toast.success`, `toast.error`, etc.). Never use `alert()`.
- **Skeletons** — show `animate-pulse` placeholder rows while loading, not spinners.
- **Tables** — wrap in `<div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">` with alternating `bg-white` / `bg-gray-50` rows.
- **Animations** — `page-enter` class (defined in `src/index.css`) for route transitions; `animate-fade-in` and `animate-slide-in` via Tailwind config (`src/tailwind.config.js`).
- **Search inputs** — attach `ref={searchRef}` and `useSearchShortcut(searchRef)`, set placeholder to `"Rechercher... (/)"`.
- **Memoization** — wrap stable sub-components with `React.memo`; use `useMemo`/`useCallback` for expensive derivations passed as props.

### All pages are lazy-loaded

`App.jsx` uses `React.lazy` for every page component. Stale chunk errors after a Vercel deploy are expected — the `PWAUpdateBanner` detects SW controller changes and prompts a reload. Users can also Ctrl+Shift+R to force a fresh load.

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
