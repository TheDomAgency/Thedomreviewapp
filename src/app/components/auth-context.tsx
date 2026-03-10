import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const SUPABASE_URL = `https://${projectId}.supabase.co`;
const API_BASE = `${SUPABASE_URL}/functions/v1/make-server-6cea9865`;

// ── Module-level setup-complete override ──
// Set synchronously in updateProfile() so SetupGuard has an instant fallback
// that doesn't depend on React state batch timing. Cleared on sign-out.
let _setupCompleteOverride = false;
export function markSetupComplete() { _setupCompleteOverride = true; }
export function clearSetupComplete() { _setupCompleteOverride = false; }
export function isSetupCompleteOverride() { return _setupCompleteOverride; }

const SUPABASE_SINGLETON_KEY = "__dom_review_supabase__";
function getSupabase(): SupabaseClient {
  if (!(globalThis as any)[SUPABASE_SINGLETON_KEY]) {
    (globalThis as any)[SUPABASE_SINGLETON_KEY] = createClient(SUPABASE_URL, publicAnonKey);
  }
  return (globalThis as any)[SUPABASE_SINGLETON_KEY];
}

export interface UserProfile {
  email: string;
  name: string;
  businessName: string;
  reviewLink: string;
  plan: string;
  createdAt: string;
  trialStartDate: string;
  setupComplete: boolean;
  balance: number;
}

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error?: string }>;
  apiCall: (path: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function makeDefaultProfile(email: string, name: string): UserProfile {
  return {
    email,
    name,
    businessName: "",
    reviewLink: "",
    plan: "trial",
    createdAt: new Date().toISOString(),
    trialStartDate: new Date().toISOString(),
    setupComplete: false,
    balance: 10.0,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Prevents onAuthStateChange from doing duplicate work during init / signIn / signUp
  const suppressListenerRef = useRef(true);

  // Fetch profile — single attempt, returns profile or null
  const doFetchProfile = useCallback(async (token: string): Promise<UserProfile | null> => {
    try {
      const res = await fetch(`${API_BASE}/profile`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        return data.profile as UserProfile;
      }
      try {
        const errBody = await res.json();
        console.log("doFetchProfile: failed", res.status, errBody.error || "");
      } catch {
        console.log("doFetchProfile: failed", res.status);
      }
      return null;
    } catch (err) {
      console.log("doFetchProfile: network error:", err);
      return null;
    }
  }, []);

  // Current session token
  const getToken = useCallback(async (): Promise<string> => {
    const { data } = await getSupabase().auth.getSession();
    return data?.session?.access_token || publicAnonKey;
  }, []);

  // Authenticated fetch with one retry on 401
  const apiCall = useCallback(async (path: string, options: RequestInit = {}): Promise<Response> => {
    const token = await getToken();
    const doFetch = (t: string) =>
      fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}`, ...(options.headers || {}) },
      });

    const res = await doFetch(token);
    if (res.status === 401 && token !== publicAnonKey) {
      const { data } = await getSupabase().auth.refreshSession();
      const freshToken = data?.session?.access_token;
      if (freshToken) return doFetch(freshToken);
    }
    return res;
  }, [getToken]);

  const refreshProfile = useCallback(async () => {
    const token = await getToken();
    if (token !== publicAnonKey) {
      const p = await doFetchProfile(token);
      if (p) setProfile(p);
    }
  }, [doFetchProfile, getToken]);

  // ── Init session on mount ──
  useEffect(() => {
    const supabase = getSupabase();
    let isMounted = true;

    const init = async () => {
      console.log("init: starting...");
      try {
        const { data: cached } = await supabase.auth.getSession();
        if (!cached?.session) {
          console.log("init: no session found");
          // No session — user is anonymous, nothing to do.
          setLoading(false);
          suppressListenerRef.current = false;
          return;
        }

        console.log("init: found cached session, refreshing...");
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();

        if (!refreshed?.session) {
          console.log("init: refresh failed:", refreshError?.message || "no session");
          // Dead refresh token — clean up
          await supabase.auth.signOut().catch(() => {});
          setUser(null);
          setProfile(null);
          setLoading(false);
          suppressListenerRef.current = false;
          return;
        }

        // Got a fresh session
        const token = refreshed.session.access_token;
        if (isMounted) setUser(refreshed.session.user);

        const p = await doFetchProfile(token);

        if (p) {
          console.log("init: profile loaded OK");
          if (isMounted) setProfile(p);
        } else {
          // Auth succeeded but profile endpoint rejected the token.
          // Create a fallback profile so the user isn't stuck.
          console.log("init: profile fetch failed — using fallback profile");
          if (isMounted) {
            setProfile(makeDefaultProfile(
              refreshed.session.user.email || "",
              refreshed.session.user.user_metadata?.name || ""
            ));
          }
        }
      } catch (err) {
        console.log("init: unexpected error:", err);
        // Don't sign out on network errors — just let the user proceed
      }

      // ALWAYS set loading to false — this is the critical line
      console.log("init: done, setting loading=false");
      setLoading(false);
      suppressListenerRef.current = false;
    };

    // Safety timeout: if init takes >8s, force loading=false
    const timeout = setTimeout(() => {
      console.log("init: TIMEOUT — forcing loading=false after 8s");
      setLoading(false);
      suppressListenerRef.current = false;
    }, 8000);

    init().finally(() => clearTimeout(timeout));

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        clearSetupComplete();
        setUser(null);
        setProfile(null);
        return;
      }

      if (suppressListenerRef.current) {
        console.log("onAuthStateChange: suppressed, event:", event);
        return;
      }

      if (session && event === "SIGNED_IN") {
        // New sign-in — update user AND re-fetch the profile.
        setUser(session.user);
        const p = await doFetchProfile(session.access_token);
        if (p) setProfile(p);
      } else if (session && event === "TOKEN_REFRESHED") {
        // Token refresh only — the profile hasn't changed, so DON'T re-fetch it.
        // Re-fetching here causes a race condition: if the GET returns a stale
        // profile (setupComplete: false) AFTER updateProfile() has already set
        // setupComplete: true in state, the profile gets silently downgraded and
        // the dashboard redirects back to the setup wizard.
        setUser(session.user);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [doFetchProfile]);

  // ── Auth methods ──
  const signIn = async (email: string, password: string) => {
    suppressListenerRef.current = true;
    try {
      const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error) {
        suppressListenerRef.current = false;
        return { error: error.message };
      }
      if (!data.session) {
        suppressListenerRef.current = false;
        return { error: "No session returned" };
      }

      setUser(data.session.user);

      const p = await doFetchProfile(data.session.access_token);
      if (p) {
        setProfile(p);
      } else {
        // Profile fetch failed — create fallback so user isn't stuck
        console.log("signIn: profile fetch failed, using fallback");
        setProfile(makeDefaultProfile(
          data.session.user.email || email,
          data.session.user.user_metadata?.name || ""
        ));
      }

      suppressListenerRef.current = false;
      return {};
    } catch (err: any) {
      suppressListenerRef.current = false;
      return { error: err.message || "Sign in failed" };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    suppressListenerRef.current = true;
    try {
      const res = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ email, password, name }),
      });
      const body = await res.json();
      if (!res.ok) {
        suppressListenerRef.current = false;
        return { error: body.error || "Signup failed" };
      }

      // Auto sign-in
      const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error) {
        suppressListenerRef.current = false;
        return { error: error.message };
      }
      if (data.session) {
        setUser(data.session.user);
        const p = await doFetchProfile(data.session.access_token);
        if (p) {
          setProfile(p);
        } else {
          setProfile(makeDefaultProfile(email, name));
        }
      }

      suppressListenerRef.current = false;
      return {};
    } catch (err: any) {
      suppressListenerRef.current = false;
      return { error: err.message || "Signup failed" };
    }
  };

  const signOutFn = async () => {
    clearSetupComplete();
    await getSupabase().auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      const res = await apiCall("/profile", { method: "PUT", body: JSON.stringify(updates) });
      const data = await res.json();
      if (!res.ok) return { error: data.error || `Update failed (${res.status})` };
      // If setup is being marked complete, set the synchronous override flag
      // BEFORE setProfile so SetupGuard always sees it, even before React
      // commits the new state (avoids batching/timing edge cases).
      if (data.profile?.setupComplete) markSetupComplete();
      setProfile(data.profile);
      return {};
    } catch (err: any) {
      return { error: err.message || "Update failed" };
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signUp, signIn, signOut: signOutFn, refreshProfile, updateProfile, apiCall }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: null,
      profile: null,
      loading: true,
      signUp: async () => ({ error: "Not initialized" }),
      signIn: async () => ({ error: "Not initialized" }),
      signOut: async () => {},
      refreshProfile: async () => {},
      updateProfile: async () => ({ error: "Not initialized" }),
      apiCall: async () => new Response(null, { status: 503 }),
    } as AuthContextType;
  }
  return ctx;
}