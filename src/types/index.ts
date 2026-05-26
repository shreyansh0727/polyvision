export type UserRole = 'employee' | 'admin';
export type PlanStatus = 'pending_payment' | 'active' | 'suspended';

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;

  // ── new multi-tenant / payment model ───────────────────────────
  tenant_id?: string;          // admin's tenant id; for admin can be same as own uid/id
  plan?: PlanStatus;           // mainly used for admin payment gate
  company_name?: string;
  payment_ref?: string | null;
  activated_at?: string | null;
  created_at?: string;
}

export interface LocationEvent {
  lat: number;
  lng: number;
  accuracy?: number | null;
  battery?: number | null;
  timestamp?: string;          // generic client-side timestamp
  recorded_at?: string;        // backend/live tracking timestamp
}

export interface LiveEmployee extends LocationEvent {
  employee_id: string;
  name: string;
  email?: string;
  role?: UserRole | string;

  lat: number;
  lng: number;
  recorded_at: string;

  is_tracking: boolean;
  is_online: boolean;

  accuracy?: number | null;
  battery?: number | null;

  tenant_id?: string;
  is_active?: boolean;
}

export interface VisitPhoto {
  id: string;
  employee_id?: string;
  employee_name?: string;

  photo_url: string;
  caption: string;
  lat: number;
  lng: number;

  uploaded_at: string;
  visited_at?: string;         // keep optional because AdminScreen already checks both
  tenant_id?: string;
}

export interface AuthState {
  token: string | null;
  employee: Employee | null;
  isAuthenticated: boolean;

  // optional UI/auth helpers for payment-gated flow
  loading?: boolean;
  error?: string | null;
}