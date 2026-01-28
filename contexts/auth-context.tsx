"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface User {
  id: number;
  username: string;
  first_name: string;
  email: string;
  telefone: string;
  cpf: string;
  tipo_usuario: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

interface RegisterData {
  username: string;
  password: string;
  first_name: string;
  email: string;
  telefone: string;
  cpf: string;
  tipo_usuario?: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedRefresh = localStorage.getItem("refresh_token");
    
    if (storedToken) {
      setToken(storedToken);
      fetchUser(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUser = async (accessToken: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/usuario/me/`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.Usuario);
      } else {
        logout();
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/api/token/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      throw new Error("Credenciais invalidas");
    }

    const data = await response.json();
    const accessToken = data.access;
    const refreshToken = data.refresh;

    localStorage.setItem("token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    setToken(accessToken);
    
    await fetchUser(accessToken);
  };

  const register = async (data: RegisterData) => {
    const response = await fetch(`${API_BASE_URL}/usuario/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error("Erro ao registrar usuario");
    }

    await login(data.username, data.password);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
