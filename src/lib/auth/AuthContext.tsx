'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { CurrentUser, PermissionModule, PermissionAction } from '../types/auth';
import { SEED_USERS } from '../db/seedData';
import { hasPermission as checkPermission, canAccessModule } from './permissions';

interface AuthContextType {
  currentUser: CurrentUser;
  switchUser: (userId: string) => void;
  login: (email: string, password?: string) => Promise<{ success: boolean; user?: CurrentUser; error?: string }>;
  logout: () => void;
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

  const login = async (email: string, _password?: string): Promise<{ success: boolean; user?: CurrentUser; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    
    // Quick role aliases
    if (cleanEmail === 'admin' || cleanEmail === 'admin@academyapex.com') {
      const adminUser = SEED_USERS.find((u) => u.role === 'ADMINISTRATOR') || SEED_USERS[0];
      setCurrentUser(adminUser);
      localStorage.setItem('classcard_mva_user_id', adminUser.id);
      return { success: true, user: adminUser };
    }

    if (cleanEmail === 'ops' || cleanEmail === 'operations' || cleanEmail === 'operations@academyapex.com') {
      const opsUser = SEED_USERS.find((u) => u.role === 'OPERATIONS') || SEED_USERS[1];
      setCurrentUser(opsUser);
      localStorage.setItem('classcard_mva_user_id', opsUser.id);
      return { success: true, user: opsUser };
    }

    if (cleanEmail === 'mentor' || cleanEmail === 'elena.rostova@academyapex.com') {
      const mentorUser = SEED_USERS.find((u) => u.role === 'MENTOR') || SEED_USERS[2];
      setCurrentUser(mentorUser);
      localStorage.setItem('classcard_mva_user_id', mentorUser.id);
      return { success: true, user: mentorUser };
    }

    const matched = SEED_USERS.find(
      (u) => u.email.toLowerCase() === cleanEmail || u.name.toLowerCase().includes(cleanEmail)
    );

    if (matched) {
      setCurrentUser(matched);
      localStorage.setItem('classcard_mva_user_id', matched.id);
      return { success: true, user: matched };
    }

    return {
      success: false,
      error: 'Invalid credentials. Please select one of the demonstration personas or use a valid email.',
    };
  };

  const logout = () => {
    localStorage.removeItem('classcard_mva_user_id');
    setCurrentUser(SEED_USERS[0]);
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
        login,
        logout,
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
