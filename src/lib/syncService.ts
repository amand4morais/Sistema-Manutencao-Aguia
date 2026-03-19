import { supabase } from './supabase';
import { dbLocal } from './dbLocal';
import toast from 'react-hot-toast';

const MAX_RETRIES = 3;

export async function syncOfflineQueue() {
  // Busca ações pendentes ou que deram erro mas ainda podem ser tentadas
  const actions = await dbLocal.offlineActions
    .where('status')
    .anyOf(['pending', 'error'])
    .sortBy('timestamp');

  if (actions.length === 0) return;

  toast.loading(`Sincronizando ${actions.length} ações...`, { id: 'sync' });
  
  const idMap = new Map<string, string>();

  for (const action of actions) {
    try {
      await dbLocal.offlineActions.update(action.id!, { status: 'syncing' });

      let finalPayload = { ...action.payload };

      // Dependency tracking: substitui IDs temporários pelos reais gerados no banco
      if (action.dependsOnTempId && idMap.has(action.dependsOnTempId)) {
        const realId = idMap.get(action.dependsOnTempId);
        for (const key in finalPayload) {
          if (finalPayload[key] === action.dependsOnTempId) {
            finalPayload[key] = realId;
          }
        }
      }

      let result;
      if (action.type === 'INSERT') {
        result = await supabase.from(action.table).insert(finalPayload).select().single();
        if (action.tempId && result.data) {
          idMap.set(action.tempId, result.data.id);
        }
      } else if (action.type === 'UPDATE') {
        const { version, id, ...updateData } = finalPayload;
        
        if (version !== undefined) {
          const { data, error: updateError } = await supabase
            .from(action.table)
            .update({ ...updateData, version: version + 1 })
            .eq('id', id)
            .eq('version', version)
            .select();
          
          if (!updateError && data?.length === 0) {
            throw new Error('CONFLITO_VERSAO');
          }
          result = { error: updateError };
        } else {
          result = await supabase.from(action.table).update(updateData).eq('id', id);
        }
      } else if (action.type === 'DELETE') {
        result = await supabase.from(action.table).delete().eq('id', finalPayload.id);
      }

      if (result?.error) throw result.error;

      await dbLocal.offlineActions.delete(action.id!);
    } catch (e: any) {
      console.error('Erro na sincronização:', e);
      
      const newRetryCount = (action.retryCount || 0) + 1;
      const newStatus = newRetryCount >= MAX_RETRIES ? 'failed' : 'error';

      await dbLocal.offlineActions.update(action.id!, { 
        status: newStatus,
        retryCount: newRetryCount,
        error: e.message 
      });
      
      if (e.message === 'CONFLITO_VERSAO') {
        toast.error('Conflito detectado. Resolva manualmente.', { id: 'sync' });
        break;
      }
    }
  }

  const remaining = await dbLocal.offlineActions.where('status').anyOf(['pending', 'error']).count();
  if (remaining === 0) {
    toast.success('Sincronização concluída!', { id: 'sync' });
  }
}
