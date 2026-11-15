import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Si faltan las variables no lanzamos error: así el build de Vercel nunca falla
// y la app muestra un aviso en pantalla en lugar de romperse.
export const supabase =
  url && anonKey
    ? createClient(url, anonKey, { auth: { persistSession: false } })
    : null;

export const isSupabaseConfigured = Boolean(supabase);
