'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CurrentUser, PermissionModule, PermissionAction } from '../types/auth';
import { hasPermission as checkPermission, canAccessModule } from './permissions';

const ANONYMOUS_USER: CurrentUser = {
  id: '',
  email: '',
  name: '',
  role: 'MENTOR',
  roleName: '',
  assignedBranchIds: [],
  permissions: [],
};

interface AuthContextType {
  currentUser: CurrentUser;
  isAuthenticated: boolean;
  isLoading: boolean;
  switchUser: (userId: string) => void;
  login: (usernameOrEmail: string, password?: string) => Promise<{ success: boolean; user?: CurrentUser; error?: string }>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; message?: string; error?: string; resetUrl?: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  availableUsers: CurrentUser[];
  selectedBranch: string; // 'ALL' or branchId
  setSelectedBranch: (branchId: string) => void;
  hasPermission: (module: PermissionModule, action: PermissionAction, branchId?: string) => boolean;
  canAccess: (module: PermissionModule) => boolean;
  isAdmin: boolean;
  isOps: boolean;
  isMentor: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function readApiResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: unknown;

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      response.ok
        ? 'The authentication service returned an invalid response.'
        : `Authentication service unavailable (${response.status}). The server returned an HTML error page; check the deployment logs.`
    );
  }

  if (!response.ok) {
    const error =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : `Authentication failed (${response.status}).`;
    throw new Error(error);
  }

  return payload as T;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser>(ANONYMOUS_USER);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');

  // Check active session on mount
  const checkActiveSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await readApiResponse<{ success?: boolean; user?: CurrentUser }>(res);
      if (data.success && data.user) {
        setCurrentUser(data.user);
        setIsAuthenticated(true);
        localStorage.setItem('lumentor_user', JSON.stringify(data.user));
        setIsLoading(false);
        return;
      }
    } catch {
      // Offline or network error
    }

    localStorage.removeItem('lumentor_user');
    setIsAuthenticated(false);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Session validation is an external synchronization, not a render-derived update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkActiveSession();
  }, [checkActiveSession]);

  const login = async (
    usernameOrEmail: string,
    password?: string
  ): Promise<{ success: boolean; user?: CurrentUser; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: usernameOrEmail, password }),
      });
      const data = await readApiResponse<{ success?: boolean; user?: CurrentUser; error?: string }>(res);

      if (data.success && data.user) {
        setCurrentUser(data.user);
        setIsAuthenticated(true);
        localStorage.setItem('lumentor_user', JSON.stringify(data.user));
        return { success: true, user: data.user };
      }

      return {
        success: false,
        error: data.error || 'Authentication failed. Please check your credentials.',
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Network error during login.',
      };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('lumentor_user');
      localStorage.removeItem('classcard_mva_user_id');
      setIsAuthenticated(false);
      window.location.replace('/login');
    }
  };

  const requestPasswordReset = async (
    email: string
  ): Promise<{ success: boolean; message?: string; error?: string; resetUrl?: string }> => {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await readApiResponse<{ success?: boolean; message?: string; error?: string; resetUrl?: string }>(res);
      if (data.success) {
        return { success: true, message: data.message, resetUrl: data.resetUrl };
      }
      return { success: false, error: data.error || 'Failed to request password reset.' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error.' };
    }
  };

  const resetPassword = async (
    token: string,
    newPassword: string
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await readApiResponse<{ success?: boolean; message?: string; error?: string }>(res);
      if (data.success) {
        return { success: true, message: data.message };
      }
      return { success: false, error: data.error || 'Failed to reset password.' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error.' };
    }
  };

  const switchUser = (userId: string) => {
    void userId;
  };

  const hasPerm = (module: PermissionModule, action: PermissionAction, branchId?: string) => {
    return checkPermission(currentUser, module, action, branchId || (selectedBranch !== 'ALL' ? selectedBranch : undefined));
  };

  const canAccess = (module: PermissionModule) => {
    return canAccessModule(currentUser, module);
  };

  const isAdmin = currentUser.role === 'ADMINISTRATOR';
  const isOps = currentUser.role === 'OPERATIONS';
  const isMentor = currentUser.role === 'MENTOR';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        isLoading,
        switchUser,
        login,
        logout,
        requestPasswordReset,
        resetPassword,
        availableUsers: [],
        selectedBranch,
        setSelectedBranch,
        hasPermission: hasPerm,
        canAccess,
        isAdmin,
        isOps,
        isMentor,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
