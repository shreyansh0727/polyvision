export interface Employee {
  id: string;
  name: string;
  email: string;
  role: 'employee' | 'admin';
  is_active: boolean;
}

export interface LocationEvent {
  lat: number;
  lng: number;
  accuracy?: number;
  battery?: number;
  timestamp: string;
}

export interface LiveEmployee extends LocationEvent {
  employee_id:  string;
  name:         string;
  role?:        string;
  lat:          number;
  lng:          number;
  recorded_at:  string;       // ISO timestamp string from backend
  is_tracking:  boolean;
  is_online:    boolean; 
}

export interface VisitPhoto {
  id: string;
  employee_id?: string;
  employee_name?: string;
  photo_url:   string;
  caption: string;
  lat: number;
  lng: number;
  uploaded_at: string;
}

export interface AuthState {
  token: string | null;
  employee: Employee | null;
  isAuthenticated: boolean;
}
