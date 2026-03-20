import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useAuth } from './useAuth';

/**
 * Wrapper do useQuery que só dispara quando a sessão está autenticada.
 * Evita que queries disparem sem token e o RLS bloqueie retornando vazio.
 *
 * Uso: idêntico ao useQuery, mas com garantia de autenticação.
 *
 * Exemplo:
 *   const { data } = useAuthQuery({
 *     queryKey: ['equipments'],
 *     queryFn: () => supabase.from('equipments').select('*')
 *   });
 */
export function useAuthQuery<T>(options: UseQueryOptions<T>) {
  const { isReady } = useAuth();

  return useQuery<T>({
    ...options,
    // Só habilita a query quando a sessão está pronta
    enabled: isReady && (options.enabled !== false),
  });
}
