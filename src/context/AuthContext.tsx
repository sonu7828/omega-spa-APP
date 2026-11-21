/**
 * AuthContext for OMEGA SPA Mobile
 * Connects directly to backend (/api/v1/auth) with SecureStore token persistence
 * Production verified credentials for Omega Spa Douala
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, usersApi, setUnauthorizedHandler } from '../services/api';
import storage from '../services/storage';

export interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: 'manager' | 'reception' | 'technician' | 'cleaner' | 'marketer';
  specialties: string[];
  active: boolean;
  phone?: string;
  salaryContract?: any;
  staffProfile?: any;
}

export const DEMO_USERS = [
  { id: 'mgr-1', role: 'manager', email: 'akabandolo@gmail.com', password: 'password', name: 'Arnold Njikam (Manager)', specialties: [] },
  { id: 'rec-01', role: 'reception', email: 'receptionist@gmail.com', password: '123456', name: 'Chebou Kemle (Reception)', specialties: [] },
  { id: 'tech-01', role: 'technician', email: 'tech01@gmail.com', password: '123456', name: 'Justice B (Technician)', specialties: ['Nails', 'Facial'] },
  { id: 'mkt-01', role: 'marketer', email: 'test@gmail.com', password: '123456', name: 'Marketer Test', specialties: ['Marketer'] },
  { id: 'cln-01', role: 'cleaner', email: 'cleaner@gmail.com', password: '123456', name: 'Cleaner Staff', specialties: [] },
];

export function isMarketerUser(user: User | null | undefined): boolean {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  if (role === 'marketer') return true;
  const specs = Array.isArray(user.specialties)
    ? user.specialties
    : Array.isArray(user.staffProfile?.specialties)
    ? user.staffProfile.specialties
    : [];
  return specs.some((s: any) => String(s).toLowerCase() === 'marketer');
}

function normalizeUser(rawUser: any): User | null {
  if (!rawUser) return null;
  const rawRole = String(rawUser.role?.name || rawUser.role || 'technician').toLowerCase();

  let rawSpecs = rawUser.specialties;
  if (!rawSpecs && rawUser.staffProfile?.specialties) {
    rawSpecs = rawUser.staffProfile.specialties;
  }
  let specialties: string[] = [];
  if (Array.isArray(rawSpecs)) {
    specialties = rawSpecs.map(String);
  } else if (typeof rawSpecs === 'string') {
    try {
      const parsed = JSON.parse(rawSpecs);
      specialties = Array.isArray(parsed) ? parsed.map(String) : [rawSpecs];
    } catch {
      specialties = [rawSpecs];
    }
  }

  const role = (['manager', 'reception', 'technician', 'cleaner', 'marketer'].includes(rawRole)
    ? rawRole
    : 'technician') as User['role'];

  return {
    id: String(rawUser.id || rawUser.userId || ''),
    name: rawUser.staffProfile?.name || rawUser.name || rawUser.email?.split('@')[0] || 'User',
    email: rawUser.email || '',
    username: rawUser.username || rawUser.email?.split('@')[0] || '',
    role,
    specialties,
    active: rawUser.isActive !== false && rawUser.active !== false,
    phone: rawUser.staffProfile?.phone || rawUser.phone || '',
    staffProfile: rawUser.staffProfile,
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  allUsers: User[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  reloadUser: () => Promise<void>;
  refreshUsers: () => Promise<User[]>;
  isManager: boolean;
  isReception: boolean;
  isTechnician: boolean;
  isMarketer: boolean;
  isCleaner: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUsers = useCallback(async (): Promise<User[]> => {
    if (user?.role === 'cleaner') {
      setAllUsers([]);
      return [];
    }
    try {
      const res = await usersApi.getAll();
      const rawList = res?.data?.users || res?.data || (Array.isArray(res) ? res : []);
      const normalizedList: User[] = rawList.map((u: any) => normalizeUser(u)).filter(Boolean) as User[];
      setAllUsers(normalizedList);
      return normalizedList;
    } catch (e) {
      console.warn('Failed to fetch staff users from backend:', e);
      return [];
    }
  }, [user?.role]);

  const logout = useCallback(async () => {
    await storage.clear();
    setTokenState(null);
    setUser(null);
    setAllUsers([]);
    setError(null);
  }, []);

  // Listen for unauthorized 401 events from api.ts
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
    });
    return () => {
      setUnauthorizedHandler(null);
    };
  }, [logout]);

  // Initialize session on mount
  useEffect(() => {
    async function initAuth() {
      try {
        const savedToken = await storage.getToken();

        // Discard any legacy demo tokens or non-JWT tokens immediately
        if (!savedToken || savedToken.startsWith('demo-') || !savedToken.includes('.')) {
          await storage.clear();
          setTokenState(null);
          setUser(null);
          setIsLoading(false);
          return;
        }

        // Validate token with live Railway backend
        try {
          const meRes = await authApi.getMe();
          const meUser = meRes?.data || meRes?.user || meRes;
          if (meUser && (meUser.id || meUser.email)) {
            const normalized = normalizeUser(meUser);
            setTokenState(savedToken);
            setUser(normalized);
            await storage.setUser(normalized);
            if (normalized?.role !== 'cleaner') {
              refreshUsers().catch(() => {});
            }
          } else {
            throw new Error('Invalid user payload');
          }
        } catch (backendErr: any) {
          console.warn('Session expired or invalid, resetting auth:', backendErr?.message || backendErr);
          await storage.clear();
          setTokenState(null);
          setUser(null);
        }
      } catch (err) {
        console.warn('Init auth failed', err);
        await storage.clear();
        setTokenState(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    initAuth();
  }, []);

  const login = async (email: string, password: string = 'password'): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authApi.login(email.trim(), password);
      const resToken = res?.token || res?.data?.token || res?.accessToken;
      const resUser = res?.user || res?.data?.user;

      if (!resToken) {
        throw new Error(res?.message || 'Authentication failed: No token returned');
      }

      const normalized = normalizeUser(resUser || { email: email.trim(), role: 'manager' });
      await storage.setToken(resToken);
      await storage.setUser(normalized);

      setTokenState(resToken);
      setUser(normalized);
      setIsLoading(false);
      if (normalized?.role !== 'cleaner') {
        refreshUsers().catch(() => {});
      }
      return true;
    } catch (err: any) {
      console.warn('Login failed:', err);
      setError(err?.message || 'Invalid credentials. Please verify your email & password.');
      setIsLoading(false);
      return false;
    }
  };

  const reloadUser = useCallback(async () => {
    try {
      const meRes = await authApi.getMe();
      const meUser = meRes?.data || meRes?.user || meRes;
      if (meUser && meUser.id) {
        const normalized = normalizeUser(meUser);
        setUser(normalized);
        await storage.setUser(normalized);
      }
    } catch (e) {
      console.warn('Reload user failed', e);
    }
  }, []);

  const isManager = user?.role === 'manager';
  const isReception = user?.role === 'reception';
  const isTechnician = user?.role === 'technician' && !isMarketerUser(user);
  const isMarketer = isMarketerUser(user);
  const isCleaner = user?.role === 'cleaner';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        allUsers,
        isAuthenticated: Boolean(token && user),
        isLoading,
        error,
        login,
        logout,
        reloadUser,
        refreshUsers,
        isManager,
        isReception,
        isTechnician,
        isMarketer,
        isCleaner,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
