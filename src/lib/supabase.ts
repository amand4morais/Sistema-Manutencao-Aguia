import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession:    true,
    detectSessionInUrl: true,
    // Desabilita auto-refresh quando offline para não gerar erros de rede
    autoRefreshToken:  navigator.onLine,
  },
});

// Gerenciar auto-refresh conforme conectividade
window.addEventListener('online',  () => supabase.auth.startAutoRefresh());
window.addEventListener('offline', () => supabase.auth.stopAutoRefresh());
