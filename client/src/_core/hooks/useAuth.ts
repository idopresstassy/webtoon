import { useEffect } from "react";
import { useLocation } from "wouter";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

type UseAuthOptions = { redirectOnUnauthenticated?: boolean; redirectPath?: string };

export function useAuth(options?: UseAuthOptions) {
  const auth = useSupabaseAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!options?.redirectOnUnauthenticated || auth.loading || auth.isAuthenticated) return;
    const next = options.redirectPath ? `?next=${encodeURIComponent(options.redirectPath)}` : "";
    setLocation(`/login${next}`);
  }, [auth.isAuthenticated, auth.loading, options?.redirectOnUnauthenticated, options?.redirectPath, setLocation]);

  return auth;
}

