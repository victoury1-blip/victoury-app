# Victoury — Order Management System

## Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + TailwindCSS |
| Auth & DB | Supabase (PostgreSQL) |
| Hosting | Netlify (auto-deploy from `main` branch) |
| External APIs | WooCommerce REST API, Ozon Express API |

---

## Architecture

### Supabase as Source of Truth
- All orders are stored in the `orders` table in Supabase.
- On app load, orders are fetched once via `supabase.from('orders').select('*')`.
- Soft delete: orders are never hard-deleted — `is_deleted = true` hides them from all queries.
- A `deleted_order_ids` blacklist is synced to `localStorage` to prevent re-appearing after WooCommerce sync.

### Local State + Sync
- After the initial load, orders live in React state (`useState`).
- Edits (status change, livreur assignment, etc.) update state immediately and persist to Supabase asynchronously.
- WooCommerce orders are pulled via the WooCommerce REST API and upserted into Supabase on demand.

### Per-Order Error Handling
- WooCommerce sync processes orders in a `for...of` loop.
- Each order is wrapped in its own `try/catch` so one bad order never blocks the rest.

### Cloud Settings (key-value store)
- Non-order data (livreurs, frais, WooCommerce config, factures) is stored in `localStorage` AND backed up to a `settings` table in Supabase under a `key/value` schema.
- Helper: `cloudGet(key)` / `cloudSet(key, value)` in `src/lib/cloudSettings.js`.

---

## Key Features

### Orders (`OrdersPage`)
- Tabs: À confirmer / En suivi / Reporter / Confirmé
- Advanced filter: livreur, ville, produit, date range
- Soft delete with bulk delete support
- Send to Ozon Express (OzoneModal) with searchable city autocomplete

### Liste des Colis (`ListeColisPage`)
- Tracks orders in the delivery pipeline
- Status picker, facture toggle, bulk actions
- Google Sheets import for external status updates
- Advanced filter panel (white theme)

### Factures (`FacturesPage`)
- Auto-generates invoices grouped by livreur
- **Dynamic delivery fees**: fetched from `localStorage` key `frais_{livreur.id}` per city + status
- Fee matching: exact city name first, then partial match fallback
- Fees loaded from Supabase cloud on modal open (no need to visit Livraison page first)

### Livraison (`LivraisonPage`)
- Manage livreurs and their per-city delivery fees
- Fees stored under `frais_{livreur.id}` in both localStorage and Supabase
- FraisPage: add/edit cities with Livré / Refusé / Annulé / Changé rates

### Stock (`StockPage`)
- Product inventory with WooCommerce sync
- Variations by size/color with stock quantities

---

## localStorage Keys Reference
| Key | Content |
|-----|---------|
| `livreurs` | Array of livreur objects `{ id, nom, telephone, statut }` |
| `frais_{id}` | Array of `{ ville, livre, refuse, annule, change }` per livreur |
| `deleted_order_ids` | Array of soft-deleted order IDs (blacklist) |
| `auzone_config` | Ozon Express API credentials `{ customerId, apiKey }` |
| `woo_config` | WooCommerce API config |
| `victoury_factures` | Saved factures array |

---

## Deployment
- Push to `main` → Netlify auto-builds and deploys.
- Environment variables set in Netlify dashboard (Supabase URL + anon key).

## Stable Checkpoint
- Git tag: `v1-stable-sync-engine` — marks the last known stable state.
