import { useState, useMemo } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  QrCode,
  MessageCircle,
  BarChart3,
  User,
  Menu,
  X,
  LogOut,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "./auth-context";

const ADMIN_EMAIL = "sabbyzaman29@gmail.com";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "My QR Code", icon: QrCode, path: "/dashboard/qr-code" },
  { label: "WhatsApp", icon: MessageCircle, path: "/dashboard/whatsapp" },
  { label: "Analytics", icon: BarChart3, path: "/dashboard/analytics" },
  { label: "Account", icon: User, path: "/dashboard/account" },
];

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const isAdmin = profile?.email === ADMIN_EMAIL;

  const trialInfo = useMemo(() => {
    if (!profile?.trialStartDate) return { daysRemaining: 10, progress: 0 };
    const start = new Date(profile.trialStartDate);
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const remaining = Math.max(0, 10 - elapsed);
    const progress = Math.min(100, (elapsed / 10) * 100);
    return { daysRemaining: remaining, progress };
  }, [profile?.trialStartDate]);

  const initials = (profile?.name || profile?.businessName || profile?.email || "U")
    .charAt(0)
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex" style={{ fontFamily: "Inter, sans-serif" }}>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#10B981] rounded-lg flex items-center justify-center">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <span className="text-[#111827]" style={{ fontSize: "1rem", fontWeight: 700 }}>
              The Dom Review
            </span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-[#6B7280] hover:text-[#111827]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? "bg-[#10B981]/10 text-[#047857]"
                    : "text-[#6B7280] hover:bg-gray-50 hover:text-[#111827]"
                }`}
                style={{ fontWeight: isActive ? 500 : 400 }}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              to="/dashboard/admin"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-[#F59E0B] hover:bg-[#F59E0B]/10"
              style={{ fontWeight: 500 }}
            >
              <ShieldCheck className="w-5 h-5" />
              Admin Panel
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-gray-100">
          {profile?.plan === "trial" && (
            <div className="bg-[#10B981]/10 rounded-lg p-3 mb-3">
              <p className="text-[#047857]" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                FREE TRIAL
              </p>
              <p className="text-[#047857]" style={{ fontSize: "0.875rem" }}>
                {trialInfo.daysRemaining} days remaining
              </p>
              <div className="mt-2 h-1.5 bg-[#10B981]/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#10B981] rounded-full transition-all"
                  style={{ width: `${trialInfo.progress}%` }}
                />
              </div>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 h-16 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-[#6B7280] hover:text-[#111827]"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div
              className="hidden sm:flex items-center gap-1.5 text-[#6B7280]"
              style={{ fontSize: "0.875rem" }}
            >
              <span>Dashboard</span>
              {location.pathname !== "/dashboard" && (
                <>
                  <ChevronRight className="w-4 h-4" />
                  <span className="text-[#111827]" style={{ fontWeight: 500 }}>
                    {navItems.find((n) => n.path === location.pathname)?.label || ""}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-[#6B7280]" style={{ fontSize: "0.875rem" }}>
              {profile?.businessName || profile?.email || ""}
            </span>
            <div
              className="w-8 h-8 bg-[#10B981] rounded-full flex items-center justify-center text-white"
              style={{ fontSize: "0.875rem", fontWeight: 600 }}
            >
              {initials}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}