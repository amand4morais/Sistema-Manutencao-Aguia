import { useState, useEffect, useCallback } from 'react';
import { dbLocal, OfflineAction } from '../lib/dbLocal';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';
import { syncOfflineQueue } from '../lib/syncService';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Expõe as ações que falharam permanentemente para a UI
  const failedActions = useLiveQuery(
    () => dbLocal.offlineActions.where('status').equals('failed').toArray()
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const processQueue = useCallback(async () => {
    if (isOnline) {
      await syncOfflineQueue();
    }
  }, [isOnline]);

  useEffect(() => {
    if (isOnline) processQueue();
  }, [isOnline, processQueue]);

  const addAction = useCallback(async (
    table: string, 
    type: 'INSERT' | 'UPDATE' | 'DELETE', 
    payload: any,
    tempId?: string,
    dependsOnTempId?: string
  ) => {
    const action: OfflineAction = {
      table,
      type,
      payload,
      tempId,
      dependsOnTempId,
      status: 'pending',
      retryCount: 0,
      timestamp: Date.now()
    };

    await dbLocal.offlineActions.add(action);

    if (isOnline) {
      processQueue();
    } else {
      toast.success('Salvo offline (IndexedDB)');
    }
  }, [isOnline, processQueue]);

  const removeAction = async (id: number) => {
    await dbLocal.offlineActions.delete(id);
  };

  return { isOnline, addAction, processQueue, failedActions, removeAction };
}
