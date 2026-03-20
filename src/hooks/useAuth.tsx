import React, { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isReady: boolean; // true quando a sessão foi verificada e está autenticado
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROFILE_CACHE_KEY = 'AGUIA_PROFILE_CACHE';

function getCachedProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setCachedProfile(p: Profile) {
  try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(p)); }
  catch { /* localStorage cheio */ }
}

function clearCachedProfile() {
  localStorage.removeItem(PROFILE_CACHE_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(getCachedProfile);
  const [loading, setLoading] = useState(true);
  // isReady = sessão verificada E usuário autenticado
  // Queries só disparam quando isReady === true
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Timeout de segurança — nunca travar a tela
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        console.warn('useAuth: safety timeout ativado');
        setLoading(false);
        // Não setar isReady aqui — se chegou no timeout sem sessão,
        // o usuário não está autenticado
      }
    }, 5000);

    async function init() {
      try {
        // getSession() lê localStorage — funciona offline
        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id, mounted);
          // Só marca isReady APÓS ter o perfil disponível
          if (mounted) setIsReady(true);
        } else {
          setUser(null);
          setProfile(null);
          clearCachedProfile();
        }
      } catch (err) {
        console.error('useAuth init error:', err);
        const cached = getCachedProfile();
        if (mounted && cached) {
          setProfile(cached);
          setIsReady(true);
        }
      } finally {
        if (mounted) {
          clearTimeout(safetyTimer);
          setLoading(false);
        }
      }
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id, mounted);
          if (mounted) setIsReady(true);
        } else {
          setUser(null);
          setProfile(null);
          setIsReady(false);
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
    if (!navigator.onLine) {
      const cached = getCachedProfile();
      if (cached?.id === userId && mounted) {
        setProfile(cached);
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
      const cached = getCachedProfile();
      if (cached?.id === userId && mounted) setProfile(cached);
    }
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const signOut = async () => {
    setIsReady(false);
    clearCachedProfile();
    localStorage.removeItem('AGUIA_QUERY_CACHE');
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isReady, signOut, refreshProfile }}>
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
