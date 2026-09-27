'use client';

import { createContext, useContext, type ReactNode } from 'react';

export interface ViewerInfo {
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

interface AuthState {
  /** Sign-in is configured on this deployment. */
  enabled: boolean;
  viewer: ViewerInfo | null;
  /** GitHub page where people choose which repos grepless may read. */
  installUrl: string | null;
}

const AuthContext = createContext<AuthState>({ enabled: false, viewer: null, installUrl: null });

export function AuthProvider({ value, children }: { value: AuthState; children: ReactNode }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
