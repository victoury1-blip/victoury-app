import { useState, useEffect } from 'react';
import { loadProducts, loadProductsRemote } from '../data/products';

/**
 * Loads products from local storage immediately, then refreshes from Supabase.
 * @param {function} [filter] - optional filter applied to both local and remote results
 * @returns {{ products: Array, loading: boolean, refresh: function }}
 */
export default function useProducts(filter) {
  const applyFilter = (list) => (filter ? list.filter(filter) : list);

  const [products, setProducts] = useState(() => applyFilter(loadProducts()));
  const [loading, setLoading] = useState(true);

  function refresh() {
    setLoading(true);
    const local = applyFilter(loadProducts());
    setProducts(local);
    loadProductsRemote()
      .then(remote => {
        const filtered = applyFilter(remote || []);
        setProducts(filtered.length >= local.length ? filtered : local);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const local = applyFilter(loadProducts());
    setProducts(local);
    loadProductsRemote()
      .then(remote => {
        if (cancelled) return;
        const filtered = applyFilter(remote || []);
        setProducts(filtered.length >= local.length ? filtered : local);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { products, loading, refresh };
}
