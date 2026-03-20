import React, { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROFILE_CACHE_KEY = 'AGUIA_PROFILE_CACHE';

function getCachedProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedProfile(p: Profile) {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(p));
  } catch { /* localStorage cheio */ }
}

function clearCachedProfile() {
  localStorage.removeItem(PROFILE_CACHE_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(getCachedProfile);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // ── Timeout de segurança ──────────────────────────────────
    // Se após 4 segundos o loading ainda for true, forçar false.
    // Isso evita tela branca infinita em qualquer cenário de falha.
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        console.warn('useAuth: timeout de segurança ativado');
        setLoading(false);
      }
    }, 4000);

    async function init() {
      try {
        // getSession() lê do localStorage — funciona offline sem requisição de rede
        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          // Carregar perfil (com fallback para cache se offline)
          await fetchProfile(session.user.id, mounted);
        } else {
          // Sem sessão — limpar estado
          setUser(null);
          setProfile(null);
          clearCachedProfile();
        }
      } catch (err) {
        console.error('useAuth init error:', err);
        // Em qualquer erro, tentar usar cache
        const cached = getCachedProfile();
        if (mounted && cached) setProfile(cached);
      } finally {
        if (mounted) {
          clearTimeout(safetyTimer);
          setLoading(false);
        }
      }
    }

    init();

    // Escutar mudanças de auth (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          fetchProfile(session.user.id, mounted);
        } else {
          setUser(null);
          setProfile(null);
          clearCachedProfile();
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(userId: string, mounted = true) {
    // Offline: usar cache direto sem tentativa de rede
    if (!navigator.onLine) {
      const cached = getCachedProfile();
      if (cached?.id === userId) {
        if (mounted) setProfile(cached);
        return;
      }
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      setCachedProfile(data);
      if (mounted) setProfile(data);
    } catch {
      // Falha de rede — usar cache
      const cached = getCachedProfile();
      if (cached?.id === userId && mounted) setProfile(cached);
    }
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const signOut = async () => {
    clearCachedProfile();
    localStorage.removeItem('AGUIA_QUERY_CACHE');
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
