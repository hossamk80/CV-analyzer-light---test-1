export type UserRole = 'admin' | 'manager' | 'recruiter';

export type Capability = 
  | 'view_dashboard'
  | 'manage_jobs'
  | 'upload_cvs'
  | 'change_status'
  | 'delete_data'
  | 'manage_settings'
  | 'toggle_gdpr';

const RBAC_MATRIX: Record<UserRole, Record<Capability, boolean>> = {
  admin: {
    view_dashboard: true,
    manage_jobs: true,
    upload_cvs: true,
    change_status: true,
    delete_data: true,
    manage_settings: true,
    toggle_gdpr: true,
  },
  manager: {
    view_dashboard: true,
    manage_jobs: false,
    upload_cvs: false,
    change_status: true,
    delete_data: false,
    manage_settings: false,
    toggle_gdpr: true,
  },
  recruiter: {
    view_dashboard: true,
    manage_jobs: true,
    upload_cvs: true,
    change_status: false,
    delete_data: false,
    manage_settings: false,
    toggle_gdpr: false,
  }
};

export function hasPermission(role: UserRole, capability: Capability): boolean {
  return RBAC_MATRIX[role]?.[capability] || false;
}
