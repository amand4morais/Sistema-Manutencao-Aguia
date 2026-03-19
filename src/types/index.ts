export type UserRole = 'admin' | 'employee';

export interface Profile {
  id: string;
  cpf: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  must_change_password: boolean;
  created_at: string;
}

export interface Equipment {
  id: string;
  name: string;
  description: string | null;
  model: string | null;
  serial_number: string | null;
  preventive_interval_days: number;
  manual_url?: string | null;
  version: number;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  equipment_id: string;
  position: string;
  system: string;
  description: string;
  order_index: number;
  created_at: string;
}

export interface ChecklistResponse {
  id: string;
  maintenance_id: string;
  item_id: string;
  conformance: 'sim' | 'nao' | 'na';
  observation: string | null;
  created_at: string;
}

export interface Manual {
  id: string;
  equipment_id: string;
  title: string;
  file_url: string;
  created_at: string;
}

export interface MaintenanceStatus {
  status: 'pending' | 'in_progress' | 'completed';
}

export interface PreventiveMaintenance extends MaintenanceStatus {
  id: string;
  equipment_id: string;
  responsible_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  general_observation: string | null;
  horimeter_km: string | null;
  version: number;
  created_at: string;
}

export interface MaintenanceOrder {
  id: string;
  number: string;
  requester_name: string;
  establishment: 'Matriz' | 'Itaiacoca' | 'Distrito';
  cost_center_code: string;
  cost_center_name: string;
  equipment_id: string;
  linked_asset_number: string | null;
  problem_description: string;
  cause_description: string;
  stop_date: string | null;
  stop_hour: string | null;
  service_by: string;
  time_entries: {
    date: string;
    morning: string;
    afternoon: string;
    night: string;
  }[];
  services_performed: string;
  observations: string;
  technician_id: string;
  status: 'open' | 'closed';
  corrective_id?: string | null;
  created_at: string;
}

export interface CorrectiveMaintenance extends MaintenanceStatus {
  id: string;
  equipment_id: string;
  responsible_id: string | null;
  problem_description: string;
  started_at: string | null;
  finished_at: string | null;
  observations: string | null;
  version: number;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  link?: string;
  created_at: string;
}
