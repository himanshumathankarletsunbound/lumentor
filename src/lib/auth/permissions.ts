import { CurrentUser, PermissionModule, PermissionAction } from '../types/auth';

export function hasPermission(
  user: CurrentUser | null | undefined,
  module: PermissionModule,
  action: PermissionAction,
  branchId?: string
): boolean {
  if (!user) return false;

  // Administrators have full permission across all modules
  if (user.role === 'ADMINISTRATOR') return true;

  // Mentors can only access personal modules
  if (user.role === 'MENTOR') {
    const mentorPermittedModules: PermissionModule[] = [
      'overview',
      'calendar',
      'classes',
      'attendance',
      'penalties',
      'payslips',
    ];
    if (!mentorPermittedModules.includes(module)) return false;
    // Mentors can view and export their own items, but cannot edit payroll or approve
    if (action === 'approve' || action === 'manage_settings' || action === 'delete') return false;
    return true;
  }

  if (user.role === 'AUDIT') {
    if (module !== 'mentor_reviews' && module !== 'overview') return false;
    if (module === 'overview') return action === 'view' || action === 'export';
    return action === 'view' || action === 'edit' || action === 'export';
  }

  if (user.role === 'OPERATIONS' && module === 'mentor_reviews') {
    return action === 'view' || action === 'edit' || action === 'export';
  }

  // Branch restriction check
  if (branchId && user.assignedBranchIds && user.assignedBranchIds.length > 0) {
    if (!user.assignedBranchIds.includes(branchId)) {
      return false;
    }
  }

  // Check explicit permission entries
  const perm = user.permissions.find((p) => p.module === module);
  if (!perm) return false;

  return perm.actions.includes(action);
}

export function canAccessModule(user: CurrentUser | null | undefined, module: PermissionModule): boolean {
  return hasPermission(user, module, 'view');
}
