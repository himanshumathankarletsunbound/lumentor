'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { CurrentUser, PermissionModule, PermissionAction } from '../types/auth';
import { SEED_USERS } from '../db/seedData';
import { hasPermission as checkPermission, canAccessModule } from './permissions';

interface AuthContextType {
  currentUser: CurrentUser;
  switchUser: (userId: string) => void;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser>(SEED_USERS[0]); // Default to Administrator
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');

  useEffect(() => {
    const savedUserId = localStorage.getItem('classcard_mva_user_id');
    if (savedUserId) {
      const found = SEED_USERS.find((u) => u.id === savedUserId);
      if (found) setCurrentUser(found);
    }
  }, []);

  const switchUser = (userId: string) => {
    const found = SEED_USERS.find((u) => u.id === userId);
    if (found) {
      setCurrentUser(found);
      localStorage.setItem('classcard_mva_user_id', found.id);
    }
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
        switchUser,
        availableUsers: SEED_USERS,
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
