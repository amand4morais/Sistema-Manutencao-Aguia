import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            1000 * 60 * 5,         // 5 min — não rebusca se dado recente
      gcTime:               1000 * 60 * 60 * 24,   // 24h na memória enquanto a aba estiver aberta
      retry:                1,
      refetchOnWindowFocus: false,
      // Usa cache existente mesmo offline, sem tentar o servidor
      networkMode:          'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);

// Service Worker — cache de assets e dados Supabase
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registrado:', reg.scope))
      .catch(err => console.log('SW não registrado:', err));
  });
}
