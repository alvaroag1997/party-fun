import { supabase } from '@/lib/supabaseClient';

// Contador anónimo de partidas: solo inserta, nunca lee.
// No guarda nombres, ni identificadores del móvil, ni nada personal.
export function trackEvent(event, data = {}) {
  if (!supabase) return;
  try {
    supabase
      .from('game_events')
      .insert({ event, ...data })
      .then(() => {})
      .catch?.(() => {});
  } catch (_) {
    /* las estadísticas nunca deben romper el juego */
  }
}
