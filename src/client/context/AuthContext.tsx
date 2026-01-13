import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface Session {
  type: "owner" | "guest" | null;
}

interface AuthContextType {
  session: Session;
  loading: boolean;
  login: (code: string) => Promise<{ success: boolean; type?: string; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>({ type: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check existing session
    fetch("/api/session")
      .then((res) => res.json())
      .then((data) => {
        setSession({ type: data.type });
      })
      .catch(() => {
        setSession({ type: null });
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = useCallback(async (code: string) => {
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (res.ok) {
        setSession({ type: data.type });
        return { success: true, type: data.type };
      } else {
        return { success: false, error: data.error || "Invalid passcode" };
      }
    } catch (err) {
      return { success: false, error: "Connection error" };
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/logout", { method: "POST" });
    setSession({ type: null });
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
