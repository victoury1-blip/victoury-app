import { createClient } from '@supabase/supabase-js';

/* La boutique parle à la MÊME base que l'application : la commande passée sur
   le site doit apparaître dans « À Confirmer », sans intermédiaire. Elle n'en
   utilise que la clé publique, et les règles d'accès de la base la cantonnent
   au catalogue et à la création d'une commande. */
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
});
