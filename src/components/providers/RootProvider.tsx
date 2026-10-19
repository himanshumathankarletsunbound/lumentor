'use client';

import React, { useRef } from 'react';
import { AuthProvider } from '../../lib/auth/AuthContext';
import { db, AppDatabase } from '../../lib/db/store';

export function RootProvider({
  children,
  initialSnapshot,
}: {
  children: React.ReactNode;
  initialSnapshot?: AppDatabase;
}) {
  const initialized = useRef(false);
  if (!initialized.current && initialSnapshot) {
    db.initClient(initialSnapshot);
    initialized.current = true;
  }

  return <AuthProvider>{children}</AuthProvider>;
}
