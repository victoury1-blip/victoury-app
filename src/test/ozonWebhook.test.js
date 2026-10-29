import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../../api/ozon-webhook.js';

function res() {
  const r = { code: 0, json: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (j) => { r.body = j; return r; };
  return r;
}

describe('webhook Ozon', () => {
  beforeEach(() => {
    process.env.OZON_WEBHOOK_SECRET = 'sekret';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
    process.env.VITE_SUPABASE_URL = 'https://db.example';
  });

  it('refuse sans le bon jeton', async () => {
    const r = res();
    await handler({ method: 'POST', query: { token: 'faux' }, body: {} }, r);
    expect(r.code).toBe(401);
  });

  it('enregistre le statut du colis (libellé de la liste Ozon)', async () => {
    const appels = [];
    global.fetch = vi.fn(async (url, opt = {}) => {
      appels.push({ url: String(url), opt });
      if (String(url).includes('/orders?select=')) return { ok: true, json: async () => [{ id: 'VS-1', recipient: { phone: '0612345678' }, ozone_last_status: 'Expédié' }] };
      if (String(url).includes('/settings?')) return { ok: true, json: async () => [] };
      return { ok: true, json: async () => ({}) };
    });
    const r = res();
    await handler({ method: 'POST', query: { token: 'sekret' }, body: { orderId: 'VI00555', orderStatus: 'WAITING_PICKUP' } }, r);
    expect(r.body).toEqual({ ok: true, statut: 'Attente De Ramassage' });
    const patch = appels.find(a => a.opt.method === 'PATCH');
    expect(patch.url).toContain('id=eq.VS-1');
    expect(JSON.parse(patch.opt.body)).toEqual({ ozone_last_status: 'Attente De Ramassage' });
  });

  it('ne touche à rien si le code est ambigu ou douteux', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => [{ id: 'A' }, { id: 'B' }] }));
    const r = res();
    await handler({ method: 'POST', query: { token: 'sekret' }, body: { orderId: 'VI00555', orderStatus: 'DELIVERED' } }, r);
    expect(r.body.ok).toBe(false);
    const r2 = res();
    await handler({ method: 'POST', query: { token: 'sekret' }, body: { orderId: 'x),id.neq.(', orderStatus: 'DELIVERED' } }, r2);
    expect(r2.body.raison).toBe('code invalide');
  });
});
