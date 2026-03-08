'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authApi, setToken, clearToken } from '@/lib/api';

// ---- Types ----

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  avatarUrl?: string;
}

interface Company {
  id: string;
  name: string;
  slug: string;
  plan?: string;
}

interface CandidateUser {
  id: string;
  email: string;
  name: string | null;
  company: string;
}

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  userType: 'company' | 'candidate' | null;
  user: User | null;
  company: Company | null;
  candidate: CandidateUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (companyName: string, email: string, password: string, name: string) => Promise<void>;
  candidateLogin: (loginId: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

// ---- Provider ----

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [userType, setUserType] = useState<'company' | 'candidate' | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [candidate, setCandidate] = useState<CandidateUser | null>(null);

  // Check existing token on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await authApi.me();
        if (res.data) {
          setUserType(res.data.userType as 'company' | 'candidate');
          if (res.data.userType === 'company') {
            setUser(res.data.user as unknown as User);
            setCompany(res.data.company as unknown as Company);
          } else {
            setCandidate(res.data.candidate as unknown as CandidateUser);
          }
        }
      } catch {
        clearToken();
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    if (res.data) {
      setToken(res.data.token as string);
      setUser(res.data.user as unknown as User);
      setCompany(res.data.company as unknown as Company);
      setUserType('company');
    }
  }, []);

  const register = useCallback(async (companyName: string, email: string, password: string, name: string) => {
    const res = await authApi.register({ companyName, email, password, name });
    if (res.data) {
      setToken(res.data.token as string);
      setUser(res.data.user as unknown as User);
      setCompany(res.data.company as unknown as Company);
      setUserType('company');
    }
  }, []);

  const candidateLogin = useCallback(async (loginId: string, password: string) => {
    const res = await authApi.candidateLogin({ loginId, password });
    if (res.data) {
      setToken(res.data.token);
      setCandidate(res.data.candidate as unknown as CandidateUser);
      setUserType('candidate');
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setCompany(null);
    setCandidate(null);
    setUserType(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isAuthenticated: !!userType,
        userType,
        user,
        company,
        candidate,
        login,
        register,
        candidateLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
