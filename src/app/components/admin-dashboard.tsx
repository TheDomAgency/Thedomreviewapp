import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Users,
  ScanLine,
  MessageCircle,
  DollarSign,
  Loader2,
  ShieldCheck,
  ArrowLeft,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Wallet,
  TrendingUp,
  AlertTriangle,
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

const ADMIN_EMAIL = "sabbyzaman29@gmail.com";

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

export function AdminDashboard() {
  const { user, profile, apiCall } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [teamRequests, setTeamRequests] = useState<TeamRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "requests">("overview");
  const [refreshing, setRefreshing] = useState(false);

  // Balance editing
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState("");
  const [balanceSaving, setBalanceSaving] = useState(false);

  const isAdmin = profile?.email === ADMIN_EMAIL || user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (!isAdmin && !loading) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAdmin, loading, navigate]);

  const fetchData = async () => {
    try {
      const [statsRes, usersRes, reqsRes] = await Promise.all([
        apiCall("/admin/stats"),
        apiCall("/admin/users"),
        apiCall("/admin/team-requests"),
      ]);

      if (statsRes.ok) {
        setStats(await statsRes.json());
      } else {
        const err = await statsRes.json();
        setError(err.error || `Stats failed (${statsRes.status})`);
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
      }

      if (reqsRes.ok) {
        const data = await reqsRes.json();
        setTeamRequests(data.requests || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleBalanceUpdate = async (email: string) => {
    setBalanceSaving(true);
    try {
      const res = await apiCall("/admin/user-balance", {
        method: "PUT",
        body: JSON.stringify({ email, balance: parseFloat(editBalance) }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.email === email ? { ...u, balance: parseFloat(editBalance) } : u))
        );
        setEditingEmail(null);
        setEditBalance("");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update balance");
      }
    } catch (err) {
      alert("Network error updating balance");
    }
    setBalanceSaving(false);
  };

  const formatDate = (d: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatChartDate = (d: string) => {
    const date = new Date(d);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" style={{ fontFamily: "Inter, sans-serif" }}>
        <div className="text-center">
          <ShieldCheck className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-[#111827]" style={{ fontWeight: 600 }}>Admin access only</p>
          <p className="text-[#6B7280] mt-1" style={{ fontSize: "0.875rem" }}>
            This page is restricted to {ADMIN_EMAIL}
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" style={{ fontFamily: "Inter, sans-serif" }}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#10B981] animate-spin mx-auto mb-3" />
          <p className="text-[#6B7280]">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Admin Header */}
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
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2 rounded-lg transition-colors"
            style={{ fontSize: "0.875rem" }}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
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
              {tab === "overview" ? "Overview" : tab === "users" ? `Users (${users.length})` : `Requests (${teamRequests.length})`}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && stats && (
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
                      <card.icon className="w-4.5 h-4.5" style={{ color: card.color }} />
                    </div>
                  </div>
                  <p className="text-white" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                    {card.value}
                  </p>
                  <p className="text-gray-400" style={{ fontSize: "0.75rem" }}>{card.label}</p>
                </div>
              ))}
            </div>

            {/* Plan Distribution */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <p className="text-gray-400 mb-1" style={{ fontSize: "0.75rem" }}>Trial Users</p>
                <p className="text-white" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats.trialUsers}</p>
                <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#F59E0B] rounded-full"
                    style={{ width: `${stats.totalUsers ? (stats.trialUsers / stats.totalUsers) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <p className="text-gray-400 mb-1" style={{ fontSize: "0.75rem" }}>Starter Plan</p>
                <p className="text-white" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats.starterUsers}</p>
                <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#10B981] rounded-full"
                    style={{ width: `${stats.totalUsers ? (stats.starterUsers / stats.totalUsers) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <p className="text-gray-400 mb-1" style={{ fontSize: "0.75rem" }}>Pro Plan</p>
                <p className="text-white" style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats.proUsers}</p>
                <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#3B82F6] rounded-full"
                    style={{ width: `${stats.totalUsers ? (stats.proUsers / stats.totalUsers) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Signups Chart */}
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
                      labelFormatter={(v) => formatDate(v)}
                    />
                    <Bar dataKey="signups" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Scans Chart */}
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
                      labelFormatter={(v) => formatDate(v)}
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
                      {stats.pendingTeamReqs} Pending Team Request{stats.pendingTeamReqs > 1 ? "s" : ""}
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

        {/* USERS TAB */}
        {activeTab === "users" && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-white" style={{ fontWeight: 600 }}>
                All Users ({users.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    {["User", "Business", "Plan", "Balance", "Setup", "Joined", "Actions"].map((h) => (
                      <th
                        key={h}
                        className="text-left text-gray-400 px-6 py-3"
                        style={{ fontSize: "0.75rem", fontWeight: 600 }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.email} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="px-6 py-4">
                        <p className="text-white" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                          {u.name || "—"}
                        </p>
                        <p className="text-gray-400" style={{ fontSize: "0.75rem" }}>{u.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-300" style={{ fontSize: "0.875rem" }}>
                          {u.businessName || "—"}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full ${
                            u.plan === "pro"
                              ? "bg-blue-500/20 text-blue-400"
                              : u.plan === "starter"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-yellow-500/20 text-yellow-400"
                          }`}
                          style={{ fontSize: "0.75rem", fontWeight: 600 }}
                        >
                          {u.plan.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {editingEmail === u.email ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.01"
                              value={editBalance}
                              onChange={(e) => setEditBalance(e.target.value)}
                              className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                              autoFocus
                            />
                            <button
                              onClick={() => handleBalanceUpdate(u.email)}
                              disabled={balanceSaving}
                              className="text-green-400 hover:text-green-300"
                            >
                              {balanceSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => { setEditingEmail(null); setEditBalance(""); }}
                              className="text-gray-400 hover:text-gray-300"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span
                            className="text-[#10B981] cursor-pointer hover:underline"
                            style={{ fontSize: "0.875rem", fontWeight: 600 }}
                            onClick={() => { setEditingEmail(u.email); setEditBalance(String(u.balance)); }}
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
                        {u.reviewLink ? (
                          <a
                            href={u.reviewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300"
                            style={{ fontSize: "0.75rem" }}
                          >
                            Review Link
                          </a>
                        ) : (
                          <span className="text-gray-500" style={{ fontSize: "0.75rem" }}>No link</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REQUESTS TAB */}
        {activeTab === "requests" && (
          <div className="space-y-4">
            {teamRequests.length === 0 ? (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
                <MessageCircle className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No WhatsApp team requests yet</p>
              </div>
            ) : (
              teamRequests.map((req, idx) => (
                <div key={`${req.email}-${idx}`} className="bg-gray-800 rounded-xl border border-gray-700 p-6">
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
                          {req.status?.toUpperCase() || "PENDING"}
                        </span>
                      </div>
                      <p className="text-gray-400" style={{ fontSize: "0.875rem" }}>{req.email}</p>
                    </div>
                    <p className="text-gray-500" style={{ fontSize: "0.75rem" }}>{formatDate(req.createdAt)}</p>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      <p className="text-gray-400" style={{ fontSize: "0.75rem" }}>Contacts</p>
                      <p className="text-white" style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                        {req.contactCount}
                      </p>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      <p className="text-gray-400" style={{ fontSize: "0.75rem" }}>Est. Cost</p>
                      <p className="text-[#10B981]" style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                        ${req.estimatedCost}
                      </p>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      <p className="text-gray-400" style={{ fontSize: "0.75rem" }}>Status</p>
                      <p className="text-white" style={{ fontSize: "1.25rem", fontWeight: 700, textTransform: "capitalize" }}>
                        {req.status || "pending"}
                      </p>
                    </div>
                  </div>
                  {req.notes && (
                    <div className="mt-4 bg-gray-700/30 rounded-lg p-3">
                      <p className="text-gray-400" style={{ fontSize: "0.75rem" }}>Notes</p>
                      <p className="text-gray-300" style={{ fontSize: "0.875rem" }}>{req.notes}</p>
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
