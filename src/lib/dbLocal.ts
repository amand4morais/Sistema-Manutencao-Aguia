import Dexie, { Table } from 'dexie';

export interface OfflineAction {
  id?: number;
  table: string;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  tempId?: string;
  dependsOnTempId?: string;
  status: 'pending' | 'syncing' | 'error' | 'failed';
  retryCount: number;
  error?: string;
  timestamp: number;
}

export interface ChecklistTemplate {
  id?: string;
  equipment_id: string;
  description: string;
}

export class AppDatabase extends Dexie {
  offlineActions!: Table<OfflineAction>;
  checklistTemplates!: Table<ChecklistTemplate>;

  constructor() {
    super('AguiaFlorestalDB');
    this.version(4).stores({
      offlineActions: '++id, table, status, tempId, dependsOnTempId, retryCount',
      checklistTemplates: '++id, equipment_id',
      maintenance_orders: '++id, equipment_id, number, status',
      notifications: '++id, user_id, read, created_at'
    });
  }
}

export const dbLocal = new AppDatabase();
