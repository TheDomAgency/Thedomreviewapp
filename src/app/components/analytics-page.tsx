import { useState, useEffect } from "react";
import {
  TrendingUp,
  Smartphone,
  Globe,
  Clock,
  CalendarDays,
  Loader2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useAuth } from "./auth-context";

interface Stats {
  total: number;
  today: number;
  thisWeek: number;
  avgDaily: string;
}

interface ChartPoint {
  date: string;
  scans: number;
}

export function AnalyticsPage() {
  const { apiCall } = useAuth();
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, thisWeek: 0, avgDaily: "0" });
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [deviceCounts, setDeviceCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await apiCall("/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats);
          setChartData(data.chartData);
          setDeviceCounts(data.deviceCounts);
        }
      } catch (err) {
        console.log("Error fetching analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [apiCall]);

  const deviceData = Object.entries(deviceCounts).map(([name, value]) => ({
    name,
    value,
  }));
  const COLORS = ["#10B981", "#F59E0B", "#047857", "#6B7280"];

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#10B981] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#111827]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
          Analytics
        </h1>
        <p className="text-[#6B7280]" style={{ fontSize: "0.875rem" }}>
          Track how your QR code is performing
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Scans", value: stats.total, icon: TrendingUp, color: "#10B981" },
          { label: "This Week", value: stats.thisWeek, icon: CalendarDays, color: "#10B981" },
          { label: "Today", value: stats.today, icon: Clock, color: "#F59E0B" },
          { label: "Avg. Daily", value: stats.avgDaily, icon: Globe, color: "#047857" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-gray-200 p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${stat.color}15` }}
              >
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
            </div>
            <p className="text-[#111827]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
              {stat.value}
            </p>
            <p className="text-[#6B7280]" style={{ fontSize: "0.875rem" }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Scans Over Time */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-[#111827] mb-6" style={{ fontWeight: 600 }}>
            Scans Over Time (Last 30 Days)
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#6B7280" }}
                  allowDecimals={false}
                />
                <Tooltip
                  labelFormatter={formatDate}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                    fontSize: "0.875rem",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="scans"
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="url(#colorScans)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-[#6B7280]">
              No scan data yet
            </div>
          )}
        </div>

        {/* Device Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-[#111827] mb-6" style={{ fontWeight: 600 }}>
            Device Breakdown
          </h3>
          {deviceData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={deviceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {deviceData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      fontSize: "0.875rem",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-4">
                {deviceData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <span className="text-[#111827]" style={{ fontSize: "0.875rem" }}>
                        {d.name}
                      </span>
                    </div>
                    <span className="text-[#6B7280]" style={{ fontSize: "0.875rem" }}>
                      {d.value} scans
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[200px]">
              <div className="text-center">
                <Smartphone className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-[#6B7280]" style={{ fontSize: "0.875rem" }}>
                  No device data yet
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
