import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import {
  Users,
  ScanLine,
  MessageCircle,
  Loader2,
  ShieldCheck,
  ArrowLeft,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Wallet,
  AlertTriangle,
  LogOut,
  ExternalLink,
  Trash2,
  Sparkles,
  Pencil,
  ArrowUpDown,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { useAuth } from "./auth-context";
import { publicAnonKey, projectId } from "/utils/supabase/info";

const ADMIN_EMAIL = "sabbyzaman29@gmail.com";
const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-6cea9865`;

// ── Types ──

interface AdminStats {
  totalUsers: number;
  setupComplete: number;
  trialUsers: number;
  starterUsers: number;
  proUsers: number;
  totalBalance: string;
  totalScans: number;
  totalWaMessages: number;
  pendingTeamReqs: number;
  signupChart: { date: string; signups: number }[];
  scanChart: { date: string; scans: number }[];
}

interface AdminUser {
  userId: string;
  email: string;
  name: string;
  businessName: string;
  plan: string;
  balance: number;
  setupComplete: boolean;
  createdAt: string;
  reviewLink: string;
}

interface TeamRequest {
  email: string;
  businessName: string;
  contactCount: number;
  estimatedCost: string;
  status: string;
  createdAt: string;
  notes: string;
}

// Simple state machine — only one state at a time, no ambiguity
type PageState =
  | { kind: "checking_auth" }
  | { kind: "not_admin" }
  | { kind: "loading_data" }
  | { kind: "ready"; stats: AdminStats; users: AdminUser[]; requests: TeamRequest[] }
  | { kind: "error"; message: string; canRetry: boolean };

// ── Component ──

export function AdminDashboard() {
  const { user, profile, signOut, loading: authLoading, forceRefreshToken } = useAuth();
  const navigate = useNavigate();

  const [pageState, setPageState] = useState<PageState>({ kind: "checking_auth" });
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "requests">("overview");
  const [refreshing, setRefreshing] = useState(false);

  // Balance editing
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState("");
  const [balanceSaving, setBalanceSaving] = useState(false);
  const [balanceError, setBalanceError] = useState("");

  // Plan editing
  const [editingPlanUserId, setEditingPlanUserId] = useState<string | null>(null);
  const [editPlan, setEditPlan] = useState("");
  const [planSaving, setPlanSaving] = useState(false);

  // Delete / cleanup state
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);

  // Track if we've already started loading to prevent double-fetches
  const didStartLoad = useRef(false);

  // Determine admin status from whichever is available
  const adminEmail = profile?.email || user?.email || null;
  const isAdmin = adminEmail === ADMIN_EMAIL;

  // ── Data fetching ──

  const fetchData = useCallback(async () => {
    try {
      console.log("[Admin] Fetching data...");

      // Force a token refresh to get a FRESH JWT.
      // We use this token DIRECTLY in fetch calls (bypassing apiCall/getToken)
      // to eliminate any stale-token race conditions.
      console.log("[Admin] Force-refreshing token before admin API calls...");
      const freshToken = await forceRefreshToken();
      if (freshToken === publicAnonKey) {
        console.error("[Admin] Force-refresh returned anon key — no valid session");
        setPageState({
          kind: "error",
          message: "No valid session found. Please sign out and sign back in.",
          canRetry: true,
        });
        return;
      }
      console.log("[Admin] Got fresh token, length:", freshToken.length);

      // Direct fetch helper — uses the fresh token we JUST obtained,
      // NOT apiCall (which would call getToken() and potentially return a stale token).
      // Uses dual-header pattern: anon key in Authorization (for gateway),
      // user token in X-User-Token (for our server).
      const adminFetch = async (path: string): Promise<Response> => {
        console.log(`[Admin] Fetching ${path}...`);
        return fetch(`${API_BASE}${path}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${publicAnonKey}`,
            "X-User-Token": freshToken,
          },
        });
      };

      // Helper: extract error message from any response format
      // Supabase gateway returns { msg: "..." }, our server returns { error: "..." }
      const extractError = async (res: Response, label: string): Promise<string> => {
        try {
          const text = await res.text();
          try {
            const body = JSON.parse(text);
            const msg =
              body.error ||
              body.msg ||
              body.message ||
              body.error_description ||
              "";
            console.error(`[Admin] ${label} error:`, res.status, msg, body);
            return msg || `${label} failed (${res.status})`;
          } catch {
            console.error(`[Admin] ${label} error (non-JSON):`, res.status, text.substring(0, 200));
            return `${label} failed (${res.status})${
              text ? `: ${text.substring(0, 100)}` : ""
            }`;
          }
        } catch {
          return `${label} failed (${res.status})`;
        }
      };

      // Fetch stats first — if it fails with 401, skip the rest
      const statsRes = await adminFetch("/admin/stats");

      if (statsRes.status === 401) {
        const errMsg = await extractError(statsRes, "Admin stats");
        console.error("[Admin] Stats got 401 even with fresh token! Error:", errMsg);
        setPageState({
          kind: "error",
          message: `Authentication failed: ${errMsg}. Try signing out and back in.`,
          canRetry: true,
        });
        return;
      }

      // Stats passed auth — fetch the rest sequentially with the same token
      const usersRes = await adminFetch("/admin/users");
      const reqsRes = await adminFetch("/admin/team-requests");

      // Parse responses — fail gracefully on individual endpoints
      let stats: AdminStats | null = null;
      let users: AdminUser[] = [];
      let requests: TeamRequest[] = [];
      const errors: string[] = [];

      if (statsRes.ok) {
        stats = await statsRes.json();
      } else {
        const msg = await extractError(statsRes, "Stats");
        errors.push(msg);
      }

      if (usersRes.ok) {
        const d = await usersRes.json();
        users = d.users || [];
      } else {
        const msg = await extractError(usersRes, "Users");
        errors.push(msg);
      }

      if (reqsRes.ok) {
        const d = await reqsRes.json();
        requests = d.requests || [];
      } else {
        const msg = await extractError(reqsRes, "Requests");
        console.error("[Admin] Requests error (non-critical):", msg);
      }

      // If we got stats, show the dashboard (even if users/requests failed)
      if (stats) {
        setPageState({ kind: "ready", stats, users, requests });
        console.log("[Admin] Data loaded — users:", users.length, "requests:", requests.length);
        return;
      }

      // Stats failed — show error with the actual server message
      setPageState({
        kind: "error",
        message: errors.length > 0
          ? errors.join(" · ")
          : "Failed to load admin stats. Check the server logs.",
        canRetry: true,
      });
    } catch (err: any) {
      console.error("[Admin] fetchData exception:", err);
      setPageState({
        kind: "error",
        message: err.message || "Network error loading admin data.",
        canRetry: true,
      });
    }
  }, [forceRefreshToken]);

  // ── State machine transitions ──

  useEffect(() => {
    // Still waiting for auth context to finish initializing
    if (authLoading) {
      setPageState({ kind: "checking_auth" });
      return;
    }

    // Auth is done — do we have a user?
    if (!user) {
      // Not logged in at all — shouldn't happen (ProtectedRoute guards this)
      // but handle gracefully
      setPageState({ kind: "not_admin" });
      return;
    }

    // Check admin access from user.email (always set after auth) or profile.email
    const email = user.email || profile?.email;
    if (email !== ADMIN_EMAIL) {
      setPageState({ kind: "not_admin" });
      return;
    }

    // We're the admin — load data (but only once per auth cycle)
    if (!didStartLoad.current) {
      didStartLoad.current = true;
      setPageState({ kind: "loading_data" });
      fetchData();
    }
  }, [authLoading, user, profile, fetchData]);

  // Reset the guard if user changes (e.g. sign out then back in)
  useEffect(() => {
    return () => {
      didStartLoad.current = false;
    };
  }, [user?.id]);

  // ── Handlers ──

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleRetry = () => {
    didStartLoad.current = false;
    setPageState({ kind: "loading_data" });
    fetchData();
  };

  const handleBalanceUpdate = async (email: string) => {
    setBalanceSaving(true);
    setBalanceError("");
    try {
      // Use direct fetch with a fresh token, same as fetchData
      const freshToken = await forceRefreshToken();
      if (freshToken === publicAnonKey) {
        setBalanceError("No valid session. Please sign out and back in.");
        setBalanceSaving(false);
        return;
      }
      const res = await fetch(`${API_BASE}/admin/user-balance`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`,
          "X-User-Token": freshToken,
        },
        body: JSON.stringify({ email, balance: parseFloat(editBalance) }),
      });
      if (res.ok) {
        // Update local state
        if (pageState.kind === "ready") {
          setPageState({
            ...pageState,
            users: pageState.users.map((u) =>
              u.email === email ? { ...u, balance: parseFloat(editBalance) } : u
            ),
          });
        }
        setEditingEmail(null);
        setEditBalance("");
      } else {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        setBalanceError(data.error || "Failed to update balance");
      }
    } catch {
      setBalanceError("Network error updating balance");
    }
    setBalanceSaving(false);
  };

  const handlePlanUpdate = async (userId: string, email: string) => {
    setPlanSaving(true);
    setBalanceError("");
    try {
      const freshToken = await forceRefreshToken();
      if (freshToken === publicAnonKey) {
        setBalanceError("No valid session. Please sign out and back in.");
        setPlanSaving(false);
        return;
      }
      const res = await fetch(`${API_BASE}/admin/user-plan`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`,
          "X-User-Token": freshToken,
        },
        body: JSON.stringify({ email, plan: editPlan }),
      });
      if (res.ok) {
        // Update local state
        if (pageState.kind === "ready") {
          setPageState({
            ...pageState,
            users: pageState.users.map((u) =>
              u.userId === userId ? { ...u, plan: editPlan } : u
            ),
          });
        }
        setEditingPlanUserId(null);
        setEditPlan("");
      } else {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        setBalanceError(data.error || "Failed to update plan");
      }
    } catch {
      setBalanceError("Network error updating plan");
    }
    setPlanSaving(false);
  };

  const handleSignOutAndRedirect = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This will remove their account, profile, scans, and all related data permanently.")) return;
    setDeletingUserId(userId);
    setBalanceError("");
    try {
      const freshToken = await forceRefreshToken();
      if (freshToken === publicAnonKey) {
        setBalanceError("No valid session. Please sign out and back in.");
        setDeletingUserId(null);
        return;
      }
      const res = await fetch(`${API_BASE}/admin/user/${userId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`,
          "X-User-Token": freshToken,
        },
      });
      if (res.ok) {
        if (pageState.kind === "ready") {
          setPageState({
            ...pageState,
            users: pageState.users.filter((u) => u.userId !== userId),
          });
        }
      } else {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        setBalanceError(data.error || "Failed to delete user");
      }
    } catch {
      setBalanceError("Network error deleting user");
    }
    setDeletingUserId(null);
  };

  const handleCleanupDuplicates = async () => {
    if (!confirm("This will remove all duplicate user profiles (keeping the one linked to Supabase Auth for each email) and clean up orphaned entries. Continue?")) return;
    setCleaningUp(true);
    setCleanupResult(null);
    setBalanceError("");
    try {
      const freshToken = await forceRefreshToken();
      if (freshToken === publicAnonKey) {
        setBalanceError("No valid session. Please sign out and back in.");
        setCleaningUp(false);
        return;
      }
      const res = await fetch(`${API_BASE}/admin/cleanup-duplicates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`,
          "X-User-Token": freshToken,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setCleanupResult(`Cleaned up ${data.duplicatesRemoved} duplicates, deleted ${data.authUsersDeleted} auth users. ${data.remaining} unique users remain.`);
        // Refresh the data
        await fetchData();
      } else {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        setBalanceError(data.error || "Cleanup failed");
      }
    } catch {
      setBalanceError("Network error during cleanup");
    }
    setCleaningUp(false);
  };

  // ── Helpers ──

  const formatDate = (d: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatChartDate = (d: string) => {
    const date = new Date(d);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const planBadge = (plan: string) => {
    const styles: Record<string, string> = {
      pro: "bg-blue-500/20 text-blue-400",
      starter: "bg-green-500/20 text-green-400",
      trial: "bg-yellow-500/20 text-yellow-400",
    };
    return styles[plan] || styles.trial;
  };

  // ── Render: state machine driven ──

  if (pageState.kind === "checking_auth") {
    return (
      <FullPageCenter>
        <Loader2 className="w-8 h-8 text-[#10B981] animate-spin mx-auto mb-3" />
        <p className="text-[#6B7280]">Verifying admin access...</p>
      </FullPageCenter>
    );
  }

  if (pageState.kind === "not_admin") {
    return (
      <FullPageCenter>
        <ShieldCheck className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-[#111827]" style={{ fontWeight: 600 }}>
          Admin access only
        </p>
        <p className="text-[#6B7280] mt-1" style={{ fontSize: "0.875rem" }}>
          This page is restricted to {ADMIN_EMAIL}
        </p>
        <button
          onClick={() => navigate("/dashboard", { replace: true })}
          className="mt-4 px-5 py-2 bg-[#10B981] hover:bg-[#047857] text-white rounded-lg transition-colors"
          style={{ fontSize: "0.875rem", fontWeight: 500 }}
        >
          Go to Dashboard
        </button>
      </FullPageCenter>
    );
  }

  if (pageState.kind === "loading_data") {
    return (
      <FullPageCenter>
        <Loader2 className="w-8 h-8 text-[#10B981] animate-spin mx-auto mb-3" />
        <p className="text-[#6B7280]">Loading admin data...</p>
      </FullPageCenter>
    );
  }

  if (pageState.kind === "error") {
    return (
      <FullPageCenter>
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-[#111827] mb-1" style={{ fontWeight: 600 }}>
          Something went wrong
        </p>
        <p className="text-[#6B7280] mb-4 max-w-md text-center" style={{ fontSize: "0.875rem" }}>
          {pageState.message}
        </p>
        <div className="flex gap-3">
          {pageState.canRetry && (
            <button
              onClick={handleRetry}
              className="px-5 py-2 bg-[#10B981] hover:bg-[#047857] text-white rounded-lg transition-colors"
              style={{ fontSize: "0.875rem", fontWeight: 500 }}
            >
              Retry
            </button>
          )}
          <button
            onClick={handleSignOutAndRedirect}
            className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-[#111827] rounded-lg transition-colors flex items-center gap-2"
            style={{ fontSize: "0.875rem", fontWeight: 500 }}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </FullPageCenter>
    );
  }

  // ── kind === "ready" ──
  const { stats, users, requests } = pageState;

  return (
    <div className="min-h-screen bg-gray-900" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-[#F59E0B]" />
              <h1 className="text-white" style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                Admin Dashboard
              </h1>
            </div>
            <span
              className="bg-[#F59E0B]/20 text-[#F59E0B] px-2.5 py-0.5 rounded-full"
              style={{ fontSize: "0.75rem", fontWeight: 600 }}
            >
              ADMIN
            </span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            style={{ fontSize: "0.875rem" }}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Balance error toast */}
        {balanceError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg mb-4 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-red-400" style={{ fontSize: "0.875rem" }}>
                {balanceError}
              </p>
            </div>
            <button onClick={() => setBalanceError("")} className="text-red-400 hover:text-red-300">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-800 rounded-xl p-1 mb-6 w-fit">
          {(["overview", "users", "requests"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-lg transition-all ${
                activeTab === tab
                  ? "bg-[#10B981] text-white shadow-lg"
                  : "text-gray-400 hover:text-white hover:bg-gray-700"
              }`}
              style={{ fontSize: "0.875rem", fontWeight: 500 }}
            >
              {tab === "overview"
                ? "Overview"
                : tab === "users"
                ? `Users (${users.length})`
                : `Requests (${requests.length})`}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: "Total Users", value: stats.totalUsers, icon: Users, color: "#10B981" },
                { label: "Setup Done", value: stats.setupComplete, icon: CheckCircle, color: "#047857" },
                { label: "Total Scans", value: stats.totalScans, icon: ScanLine, color: "#3B82F6" },
                { label: "WA Messages", value: stats.totalWaMessages, icon: MessageCircle, color: "#25D366" },
                { label: "Total Balance", value: `$${stats.totalBalance}`, icon: Wallet, color: "#F59E0B" },
              ].map((card) => (
                <div key={card.label} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${card.color}20` }}
                    >
                      <card.icon className="w-5 h-5" style={{ color: card.color }} />
                    </div>
                  </div>
                  <p className="text-white" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                    {card.value}
                  </p>
                  <p className="text-gray-400" style={{ fontSize: "0.75rem" }}>
                    {card.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Plan Distribution */}
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: "Trial Users", count: stats.trialUsers, color: "#F59E0B" },
                { label: "Starter Plan", count: stats.starterUsers, color: "#10B981" },
                { label: "Pro Plan", count: stats.proUsers, color: "#3B82F6" },
              ].map((item) => (
                <div key={item.label} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                  <p className="text-gray-400 mb-1" style={{ fontSize: "0.75rem" }}>
                    {item.label}
                  </p>
                  <p className="text-white" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                    {item.count}
                  </p>
                  <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${stats.totalUsers ? (item.count / stats.totalUsers) * 100 : 0}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-white mb-4" style={{ fontWeight: 600 }}>
                  Signups (Last 30 Days)
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.signupChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" tickFormatter={formatChartDate} stroke="#6B7280" style={{ fontSize: "0.7rem" }} />
                    <YAxis stroke="#6B7280" style={{ fontSize: "0.7rem" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px", color: "#fff" }}
                      labelFormatter={(v) => formatDate(String(v))}
                    />
                    <Bar dataKey="signups" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-white mb-4" style={{ fontWeight: 600 }}>
                  QR Scans (Last 30 Days)
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={stats.scanChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" tickFormatter={formatChartDate} stroke="#6B7280" style={{ fontSize: "0.7rem" }} />
                    <YAxis stroke="#6B7280" style={{ fontSize: "0.7rem" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px", color: "#fff" }}
                      labelFormatter={(v) => formatDate(String(v))}
                    />
                    <Area type="monotone" dataKey="scans" stroke="#3B82F6" fill="#3B82F620" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pending Requests Alert */}
            {stats.pendingTeamReqs > 0 && (
              <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
                  <div>
                    <p className="text-[#F59E0B]" style={{ fontWeight: 600 }}>
                      {stats.pendingTeamReqs} Pending Team Request
                      {stats.pendingTeamReqs > 1 ? "s" : ""}
                    </p>
                    <p className="text-gray-400" style={{ fontSize: "0.875rem" }}>
                      WhatsApp team send requests awaiting action
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("requests")}
                  className="bg-[#F59E0B] text-white px-4 py-2 rounded-lg hover:bg-[#D97706] transition-colors"
                  style={{ fontSize: "0.875rem", fontWeight: 500 }}
                >
                  View Requests
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── USERS TAB ── */}
        {activeTab === "users" && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-white" style={{ fontWeight: 600 }}>
                All Users ({users.length})
              </h3>
              <div className="flex items-center gap-3">
                {cleanupResult && (
                  <span className="text-green-400" style={{ fontSize: "0.75rem" }}>
                    {cleanupResult}
                  </span>
                )}
                <button
                  onClick={handleCleanupDuplicates}
                  disabled={cleaningUp}
                  className="flex items-center gap-2 bg-[#F59E0B]/20 hover:bg-[#F59E0B]/30 text-[#F59E0B] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  style={{ fontSize: "0.75rem", fontWeight: 600 }}
                >
                  {cleaningUp ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  Clean Up Duplicates
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    {["User", "ID", "Business", "Plan", "Balance", "Setup", "Joined", "Actions"].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left text-gray-400 px-6 py-3"
                          style={{ fontSize: "0.75rem", fontWeight: 600 }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.userId} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="px-6 py-4">
                        <p className="text-white" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                          {u.name || "—"}
                        </p>
                        <p className="text-gray-400" style={{ fontSize: "0.75rem" }}>
                          {u.email}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-500 font-mono" style={{ fontSize: "0.625rem" }}>
                          {u.userId.substring(0, 8)}...
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-300" style={{ fontSize: "0.875rem" }}>
                          {u.businessName || "—"}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        {editingPlanUserId === u.userId ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={editPlan}
                              onChange={(e) => setEditPlan(e.target.value)}
                              className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                              autoFocus
                            >
                              <option value="trial">Trial</option>
                              <option value="starter">Starter</option>
                              <option value="pro">Pro</option>
                            </select>
                            <button
                              onClick={() => handlePlanUpdate(u.userId, u.email)}
                              disabled={planSaving}
                              className="text-green-400 hover:text-green-300"
                            >
                              {planSaving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setEditingPlanUserId(null);
                                setEditPlan("");
                              }}
                              className="text-gray-400 hover:text-gray-300"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all hover:ring-2 hover:ring-white/20 ${planBadge(u.plan)}`}
                            style={{ fontSize: "0.75rem", fontWeight: 600 }}
                            onClick={() => {
                              setEditingPlanUserId(u.userId);
                              setEditPlan(u.plan);
                              setBalanceError("");
                            }}
                            title="Click to change plan"
                          >
                            {u.plan.toUpperCase()}
                            <Pencil className="w-3 h-3 opacity-60" />
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingEmail === u.userId ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.01"
                              value={editBalance}
                              onChange={(e) => setEditBalance(e.target.value)}
                              className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleBalanceUpdate(u.email);
                                if (e.key === "Escape") {
                                  setEditingEmail(null);
                                  setEditBalance("");
                                }
                              }}
                            />
                            <button
                              onClick={() => handleBalanceUpdate(u.email)}
                              disabled={balanceSaving}
                              className="text-green-400 hover:text-green-300"
                            >
                              {balanceSaving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setEditingEmail(null);
                                setEditBalance("");
                              }}
                              className="text-gray-400 hover:text-gray-300"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span
                            className="text-[#10B981] cursor-pointer hover:underline"
                            style={{ fontSize: "0.875rem", fontWeight: 600 }}
                            onClick={() => {
                              setEditingEmail(u.userId);
                              setEditBalance(String(u.balance ?? 0));
                              setBalanceError("");
                            }}
                          >
                            ${(u.balance ?? 0).toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {u.setupComplete ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <Clock className="w-4 h-4 text-yellow-400" />
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-400" style={{ fontSize: "0.75rem" }}>
                          {formatDate(u.createdAt)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {u.reviewLink ? (
                            <a
                              href={u.reviewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                              style={{ fontSize: "0.75rem" }}
                            >
                              Link
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : null}
                          <button
                            onClick={() => handleDeleteUser(u.userId)}
                            disabled={deletingUserId === u.userId}
                            className="text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-30"
                            title="Delete user and all their data"
                          >
                            {deletingUserId === u.userId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── REQUESTS TAB ── */}
        {activeTab === "requests" && (
          <div className="space-y-4">
            {requests.length === 0 ? (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
                <MessageCircle className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No WhatsApp team requests yet</p>
              </div>
            ) : (
              requests.map((req, idx) => (
                <div
                  key={`${req.email}-${idx}`}
                  className="bg-gray-800 rounded-xl border border-gray-700 p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-white" style={{ fontWeight: 600 }}>
                          {req.businessName || "Unknown Business"}
                        </p>
                        <span
                          className={`px-2 py-0.5 rounded-full ${
                            req.status === "pending"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : req.status === "completed"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-gray-500/20 text-gray-400"
                          }`}
                          style={{ fontSize: "0.625rem", fontWeight: 700 }}
                        >
                          {(req.status || "pending").toUpperCase()}
                        </span>
                      </div>
                      <p className="text-gray-400" style={{ fontSize: "0.875rem" }}>
                        {req.email}
                      </p>
                    </div>
                    <p className="text-gray-500" style={{ fontSize: "0.75rem" }}>
                      {formatDate(req.createdAt)}
                    </p>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      <p className="text-gray-400" style={{ fontSize: "0.75rem" }}>
                        Contacts
                      </p>
                      <p className="text-white" style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                        {req.contactCount}
                      </p>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      <p className="text-gray-400" style={{ fontSize: "0.75rem" }}>
                        Est. Cost
                      </p>
                      <p className="text-[#10B981]" style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                        ${req.estimatedCost}
                      </p>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      <p className="text-gray-400" style={{ fontSize: "0.75rem" }}>
                        Status
                      </p>
                      <p
                        className="text-white"
                        style={{ fontSize: "1.25rem", fontWeight: 700, textTransform: "capitalize" }}
                      >
                        {req.status || "pending"}
                      </p>
                    </div>
                  </div>
                  {req.notes && (
                    <div className="mt-4 bg-gray-700/30 rounded-lg p-3">
                      <p className="text-gray-400" style={{ fontSize: "0.75rem" }}>
                        Notes
                      </p>
                      <p className="text-gray-300" style={{ fontSize: "0.875rem" }}>
                        {req.notes}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Utility layout component ──

function FullPageCenter({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen bg-gray-50 flex items-center justify-center px-4"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      <div className="text-center">{children}</div>
    </div>
  );
}