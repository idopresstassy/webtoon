import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type SupabaseAppUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: "reader" | "admin";
};

type AuthContextValue = {
  user: SupabaseAppUser | null;
  loading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ confirmationRequired: boolean }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function readUser(session: Session | null): Promise<SupabaseAppUser | null> {
  if (!session?.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", session.user.id)
    .maybeSingle();
  if (error) throw error;
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: data?.display_name ?? session.user.user_metadata?.name ?? null,
    role: data?.role === "admin" ? "admin" : "reader",
  };
}

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseAppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      setUser(await readUser(data.session));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error("인증 정보를 불러오지 못했습니다."));
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => subscription.subscription.unsubscribe();
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    await refresh();
  }, [refresh]);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) throw signUpError;
    await refresh();
    return { confirmationRequired: !data.session };
  }, [refresh]);

  const logout = useCallback(async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw signOutError;
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, error, isAuthenticated: Boolean(user), signIn, signUp, logout, refresh }), [user, loading, error, signIn, signUp, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSupabaseAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("SupabaseAuthProvider 내부에서 useSupabaseAuth를 사용해야 합니다.");
  return context;
}

