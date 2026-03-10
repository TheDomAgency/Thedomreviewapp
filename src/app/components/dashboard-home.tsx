import { useState, useEffect } from "react";
import { Link } from "react-router";
import { QRCodeSVG } from "qrcode.react";
import {
  QrCode,
  ScanLine,
  TrendingUp,
  Download,
  ArrowUpRight,
  Clock,
  Smartphone,
  Loader2,
  Wallet,
} from "lucide-react";
import { useAuth } from "./auth-context";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-6cea9865`;

interface Scan {
  timestamp: string;
  device: string;
  userAgent: string;
}

interface Stats {
  total: number;
  today: number;
  thisWeek: number;
  avgDaily: string;
}

export function DashboardHome() {
  const { profile, user, apiCall } = useAuth();
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, thisWeek: 0, avgDaily: "0" });
  const [recentScans, setRecentScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, scansRes] = await Promise.all([
          apiCall("/stats"),
          apiCall("/scans"),
        ]);
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data.stats);
        }
        if (scansRes.ok) {
          const data = await scansRes.json();
          setRecentScans(data.scans.slice(0, 5));
        }
      } catch (err) {
        console.log("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [apiCall]);

  const formatTime = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const businessName = profile?.businessName || "Your Business";
  // QR code encodes the user's actual Google review link directly
  const firstQR = profile?.qrCodes?.[0];
  const scanUrl = firstQR?.reviewLink || profile?.reviewLink || "";
  const qrBusinessName = firstQR?.businessName || businessName;
  const qrCount = profile?.qrCodes?.length || (scanUrl ? 1 : 0);
  const maxQR = profile?.plan === "pro" ? 5 : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#111827]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
          Welcome back, {profile?.name?.split(" ")[0] || "there"}!
        </h1>
        <p className="text-[#6B7280]" style={{ fontSize: "0.875rem" }}>
          Here's how your QR code is performing
        </p>
      </div>

      {/* Balance Banner */}
      {profile?.balance !== undefined && (
        <div className="bg-gradient-to-r from-[#10B981] to-[#047857] rounded-xl p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <p style={{ fontSize: "0.875rem", fontWeight: 500, opacity: 0.9 }}>Account Balance</p>
              <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>${(profile.balance ?? 0).toFixed(2)}</p>
            </div>
          </div>
          <div className="text-right">
            <p style={{ fontSize: "0.75rem", opacity: 0.8 }}>Add funds for contact imports</p>
            <p style={{ fontSize: "0.875rem", fontWeight: 600 }}>$0.0001 per contact</p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Scans", value: String(stats.total), change: `${stats.total > 0 ? "+" : ""}${stats.total}`, icon: ScanLine, color: "#10B981" },
          { label: "This Week", value: String(stats.thisWeek), change: `+${stats.thisWeek}`, icon: TrendingUp, color: "#10B981" },
          { label: "Today", value: String(stats.today), change: `+${stats.today}`, icon: QrCode, color: "#F59E0B" },
          { label: "Avg. Daily", value: stats.avgDaily, change: "Steady", icon: Clock, color: "#047857" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${stat.color}15` }}
              >
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
              <span
                className="text-[#10B981] flex items-center gap-0.5"
                style={{ fontSize: "0.75rem", fontWeight: 500 }}
              >
                {stat.change}
                <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>
            <p className="text-[#111827]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : stat.value}
            </p>
            <p className="text-[#6B7280]" style={{ fontSize: "0.875rem" }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* QR Code Preview */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-[#111827] mb-4" style={{ fontWeight: 600 }}>
            Your QR Code{qrCount > 1 ? "s" : ""}
          </h3>
          {qrCount > 1 && (
            <p className="text-[#6B7280] text-center mb-3" style={{ fontSize: "0.75rem" }}>
              {qrCount}/{maxQR} QR codes
            </p>
          )}
          <div className="flex justify-center mb-4">
            {scanUrl ? (
              <div className="p-3 rounded-xl border-2 border-[#10B981]/20 shadow-sm shadow-[#10B981]/10">
                <QRCodeSVG
                  value={scanUrl}
                  size={140}
                  fgColor="#111827"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-[164px] h-[164px] bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 px-3">
                <p className="text-[#6B7280] text-center" style={{ fontSize: "0.75rem" }}>
                  Set up your review link to generate a QR code
                </p>
              </div>
            )}
          </div>
          <p className="text-center text-[#6B7280] mb-4" style={{ fontSize: "0.875rem" }}>
            {qrBusinessName}
          </p>
          <div className="flex gap-2">
            <button className="flex-1 flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#047857] text-white py-2.5 rounded-lg transition-colors">
              <Download className="w-4 h-4" />
              Download
            </button>
            <Link
              to="/dashboard/qr-code"
              className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-[#111827] py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Manage
            </Link>
          </div>
        </div>

        {/* Recent Scans */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#111827]" style={{ fontWeight: 600 }}>
              Recent Scans
            </h3>
            <Link
              to="/dashboard/analytics"
              className="text-[#10B981] hover:text-[#047857] flex items-center gap-1"
              style={{ fontSize: "0.875rem", fontWeight: 500 }}
            >
              View All
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-[#10B981] animate-spin" />
            </div>
          ) : recentScans.length === 0 ? (
            <div className="text-center py-12">
              <Smartphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-[#6B7280]" style={{ fontSize: "0.875rem" }}>
                No scans yet. Share your QR code to start collecting reviews!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentScans.map((scan, idx) => (
                <div
                  key={`${scan.timestamp}-${idx}`}
                  className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[#10B981]/10 rounded-lg flex items-center justify-center">
                      <Smartphone className="w-4 h-4 text-[#10B981]" />
                    </div>
                    <div>
                      <p className="text-[#111827]" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                        {scan.device}
                      </p>
                      <p className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>
                        QR Scan
                      </p>
                    </div>
                  </div>
                  <span className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>
                    {formatTime(scan.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}