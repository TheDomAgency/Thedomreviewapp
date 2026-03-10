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

export interface QRCodeEntry {
  id: string;
  businessName: string;
  reviewLink: string;
  logoUrl?: string;
  brandColor?: string;
  websiteUrl?: string;
  // Print card customizable texts
  printHeaderTitle?: string;
  printCta?: string;
  printSubtitle?: string;
  printFooter?: string;
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
  qrCodes?: QRCodeEntry[];
  extraQrSlots?: number;
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
  forceRefreshToken: () => Promise<string>;
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
    balance: 0,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Stable token ref ──
  // Stores the last known good access token. Updated on every auth event.
  // This is the PRIMARY source of truth for API calls, avoiding getSession()
  // timing issues where it returns null during brief windows.
  const tokenRef = useRef<string | null>(null);

  // Prevents onAuthStateChange from doing duplicate work during init / signIn / signUp
  const suppressListenerRef = useRef(true);

  // ── Single refresh mutex ──
  // ALL refresh calls go through this to prevent multiple concurrent
  // refreshSession() calls from consuming the same refresh token.
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const doRefreshOnce = useCallback(async (): Promise<string | null> => {
    if (refreshPromiseRef.current) {
      console.log("[refresh] Already in progress, waiting...");
      return refreshPromiseRef.current;
    }

    const promise = (async () => {
      console.log("[refresh] Starting token refresh...");
      try {
        const { data, error } = await getSupabase().auth.refreshSession();
        if (error) {
          console.log("[refresh] Failed:", error.message);
          return null;
        }
        const freshToken = data?.session?.access_token || null;
        if (freshToken) {
          console.log("[refresh] Success, token length:", freshToken.length);
          tokenRef.current = freshToken;
        } else {
          console.log("[refresh] No session returned");
        }
        return freshToken;
      } catch (err: any) {
        console.log("[refresh] Exception:", err?.message || err);
        return null;
      }
    })();

    refreshPromiseRef.current = promise;
    try {
      return await promise;
    } finally {
      refreshPromiseRef.current = null;
    }
  }, []);

  // Fetch profile — single attempt, returns profile or null
  const doFetchProfile = useCallback(async (token: string): Promise<UserProfile | null> => {
    try {
      const res = await fetch(`${API_BASE}/profile`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`,
          "X-User-Token": token,
        },
      });
      if (res.ok) {
        const data = await res.json();
        return data.profile as UserProfile;
      }
      try {
        const errBody = await res.json();
        console.log("doFetchProfile: failed", res.status, errBody.error || errBody.msg || "");
      } catch {
        console.log("doFetchProfile: failed", res.status);
      }
      return null;
    } catch (err) {
      console.log("doFetchProfile: network error:", err);
      return null;
    }
  }, []);

  // ── Get current token ──
  // Priority: tokenRef → getSession → doRefreshOnce → publicAnonKey
  const getToken = useCallback(async (): Promise<string> => {
    // 1. Use the stored token if we have one and it's not near expiry
    if (tokenRef.current && tokenRef.current !== publicAnonKey) {
      // Quick check: is it a JWT we can decode to check expiry?
      try {
        const parts = tokenRef.current.split(".");
        if (parts.length === 3) {
          // JWT uses base64url encoding — convert to standard base64 for atob
          const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
          const payload = JSON.parse(atob(b64));
          const now = Math.floor(Date.now() / 1000);
          if (payload.exp && payload.exp - now > 30) {
            // Token is valid for >30s, use it
            return tokenRef.current;
          }
          // Token is near/past expiry — fall through to refresh
          console.log("[getToken] Stored token near expiry, will refresh");
        }
      } catch {
        // Can't decode — just use it and let the server decide
        return tokenRef.current;
      }
    }

    // 2. Try getSession
    try {
      const { data } = await getSupabase().auth.getSession();
      if (data?.session?.access_token) {
        tokenRef.current = data.session.access_token;

        // Check if near expiry
        const expiresAt = (data.session as any).expires_at as number | undefined;
        const now = Math.floor(Date.now() / 1000);
        if (expiresAt && expiresAt - now < 90) {
          console.log("[getToken] Session near expiry, refreshing...");
          const fresh = await doRefreshOnce();
          if (fresh) return fresh;
          // Fall through to use the near-expiry token — server may still accept it
        }

        return data.session.access_token;
      }
    } catch (err) {
      console.log("[getToken] getSession error:", err);
    }

    // 3. Try refreshing
    console.log("[getToken] No session found, attempting refresh...");
    const fresh = await doRefreshOnce();
    if (fresh) return fresh;

    // 4. No valid token available
    console.log("[getToken] No valid token — returning anon key");
    return publicAnonKey;
  }, [doRefreshOnce]);

  // ── Authenticated fetch with 401 retry ──
  // Uses dual-header pattern:
  //   Authorization: Bearer <anon_key>  → satisfies Supabase Edge Function gateway
  //   X-User-Token: <user_jwt>          → our server reads this for actual auth
  // This prevents the gateway from rejecting user JWTs with "Invalid JWT".
  const apiCall = useCallback(async (path: string, options: RequestInit = {}): Promise<Response> => {
    const token = await getToken();
    const isAnon = token === publicAnonKey;
    console.log(`[apiCall] ${path} — token: ${isAnon ? "anon" : "auth"} (${token.length} chars)`);

    const doFetch = (t: string) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${publicAnonKey}`,
        ...(t !== publicAnonKey ? { "X-User-Token": t } : {}),
        ...((options.headers as Record<string, string>) || {}),
      };
      return fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      });
    };

    const res = await doFetch(token);

    if (res.status === 401) {
      // Log the error body for debugging (clone so caller can still read it)
      try {
        const clone = res.clone();
        const body = await clone.text();
        console.log(`[apiCall] ${path} 401 response body:`, body);
      } catch {}

      console.log(`[apiCall] ${path} got 401, attempting refresh...`);
      const freshToken = await doRefreshOnce();
      if (freshToken) {
        console.log(`[apiCall] ${path} retrying with refreshed token`);
        return doFetch(freshToken);
      }
      console.log(`[apiCall] ${path} refresh failed, returning 401`);
    }
    return res;
  }, [getToken, doRefreshOnce]);

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
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) {
          console.log("init: no cached session");
          setLoading(false);
          suppressListenerRef.current = false;
          return;
        }

        const session = sessionData.session;
        const token = session.access_token;
        tokenRef.current = token;
        if (isMounted) setUser(session.user);

        // Check if the token is near/past expiry; if so, refresh it.
        // Otherwise, use it directly — no need to eagerly refresh a valid token.
        const expiresAt = (session as any).expires_at as number | undefined;
        const now = Math.floor(Date.now() / 1000);
        let activeToken = token;

        if (expiresAt && expiresAt - now < 120) {
          console.log("init: token near expiry, refreshing...");
          const fresh = await doRefreshOnce();
          if (fresh) {
            activeToken = fresh;
          } else {
            // Refresh failed — token is probably dead. Clean up.
            console.log("init: refresh failed, signing out");
            await supabase.auth.signOut().catch(() => {});
            if (isMounted) {
              setUser(null);
              setProfile(null);
            }
            setLoading(false);
            suppressListenerRef.current = false;
            return;
          }
        }

        // Fetch profile with the active token
        const p = await doFetchProfile(activeToken);
        if (p) {
          console.log("init: profile loaded OK");
          if (isMounted) setProfile(p);
        } else {
          console.log("init: profile fetch failed — using fallback");
          if (isMounted) {
            setProfile(makeDefaultProfile(
              session.user.email || "",
              session.user.user_metadata?.name || ""
            ));
          }
        }
      } catch (err) {
        console.log("init: unexpected error:", err);
      }

      console.log("init: done, setting loading=false");
      setLoading(false);
      suppressListenerRef.current = false;
    };

    // Safety timeout
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
        tokenRef.current = null;
        setUser(null);
        setProfile(null);
        return;
      }

      // Always update the token ref when we get a new session
      if (session?.access_token) {
        tokenRef.current = session.access_token;
      }

      if (suppressListenerRef.current) {
        console.log("onAuthStateChange: suppressed, event:", event);
        return;
      }

      if (session && event === "SIGNED_IN") {
        setUser(session.user);
        const p = await doFetchProfile(session.access_token);
        if (p) setProfile(p);
      } else if (session && event === "TOKEN_REFRESHED") {
        // Token refresh only — don't re-fetch profile (avoids race condition
        // where a stale profile overwrites a fresh update).
        console.log("onAuthStateChange: TOKEN_REFRESHED, updated tokenRef");
        setUser(session.user);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [doFetchProfile, doRefreshOnce]);

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

      // Store the token immediately
      tokenRef.current = data.session.access_token;
      setUser(data.session.user);

      const p = await doFetchProfile(data.session.access_token);
      if (p) {
        setProfile(p);
      } else {
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
        tokenRef.current = data.session.access_token;
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
    tokenRef.current = null;
    await getSupabase().auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      console.log("updateProfile: Starting update with:", updates);
      const res = await apiCall("/profile", { method: "PUT", body: JSON.stringify(updates) });

      // Handle non-JSON responses gracefully
      let data: any;
      try {
        data = await res.json();
      } catch {
        console.log("updateProfile: Non-JSON response, status:", res.status);
        return { error: `Update failed (${res.status}) — server returned non-JSON response` };
      }

      console.log("updateProfile: Server response status:", res.status, "data:", data);
      if (!res.ok) {
        const errMsg = data.error || data.msg || data.message || `Update failed (${res.status})`;
        console.log("updateProfile: Update failed:", errMsg);
        return { error: errMsg };
      }

      if (data.profile?.setupComplete) {
        console.log("updateProfile: Marking setup complete via override flag");
        markSetupComplete();
      }
      console.log("updateProfile: Setting profile to:", data.profile);
      setProfile(data.profile);
      return {};
    } catch (err: any) {
      console.log("updateProfile: Exception:", err);
      return { error: err.message || "Update failed" };
    }
  };

  // forceRefreshToken — routes through the shared mutex
  const forceRefreshToken = useCallback(async (): Promise<string> => {
    const fresh = await doRefreshOnce();
    if (fresh) return fresh;
    // If refresh fails, return whatever we have in tokenRef
    if (tokenRef.current && tokenRef.current !== publicAnonKey) {
      console.log("forceRefreshToken: refresh failed, using stored token");
      return tokenRef.current;
    }
    console.log("forceRefreshToken: no valid token available");
    return publicAnonKey;
  }, [doRefreshOnce]);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signUp, signIn, signOut: signOutFn, refreshProfile, updateProfile, apiCall, forceRefreshToken }}
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
      forceRefreshToken: async () => publicAnonKey,
    } as AuthContextType;
  }
  return ctx;
}