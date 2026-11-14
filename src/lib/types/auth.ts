export type SystemRole =
  | "ADMINISTRATOR"
  | "OPERATIONS"
  | "AUDIT"
  | "MENTOR"
  | "EMPLOYEE"
  | "CUSTOM";

export type UserStatus =
  | "ACTIVE"
  | "SENT_PASSWORD_VERIFICATION"
  | "PASSWORD_SETUP_DELIVERY_FAILED"
  | "SUSPENDED"
  | "DISABLED";

export type PermissionModule =
  | "overview"
  | "calendar"
  | "classes"
  | "attendance"
  | "exceptions"
  | "mentors"
  | "students"
  | "branches"
  | "subjects"
  | "packages"
  | "payroll_dashboard"
  | "payroll_rules"
  | "payroll_processing"
  | "penalties"
  | "payslips"
  | "reports"
  | "analytics"
  | "users_roles"
  | "classcard_integration"
  | "audit_logs"
  | "mentor_reviews"
  | "settings"
  | "employee_records"
  | "leave_management"
  | "employee_settings";

export type PermissionAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "approve"
  | "export"
  | "manage_settings"
  | "view_sensitive_payroll";

export interface RolePermission {
  module: PermissionModule;
  actions: PermissionAction[];
  branchIds?: string[]; // Empty/undefined means all branches permitted
}

export interface UserRole {
  id: string;
  name: string;
  systemRole: SystemRole;
  description: string;
  permissions: RolePermission[];
  createdAt: string;
  updatedAt: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: SystemRole;
  roleName: string;
  mentorId?: string; // Link to mentor profile if role === 'MENTOR'
  employeeId?: string; // Present when the same platform account is linked to an employee record
  assignedBranchIds: string[]; // empty = all branches
  avatarUrl?: string;
  permissions: RolePermission[];
  passwordHash?: string;
  salt?: string;
  mustChangePassword?: boolean;
  resetToken?: string;
  resetTokenExpiry?: string;
  sessionToken?: string;
  sessionExpiry?: string;
  status?: UserStatus;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}
