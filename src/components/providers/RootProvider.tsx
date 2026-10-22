'use client';

import React, { useRef } from 'react';
import { AuthProvider } from '../../lib/auth/AuthContext';
import { db, AppDatabase } from '../../lib/db/store';
import { setSystemCurrency } from '../../lib/utils/formatters';

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
    if (initialSnapshot.orgSettings?.currency) {
      setSystemCurrency(initialSnapshot.orgSettings.currency);
    }
    initialized.current = true;
  }

  return <AuthProvider>{children}</AuthProvider>;
}
