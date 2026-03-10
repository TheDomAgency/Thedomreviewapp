import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { QrCode, Eye, EyeOff, Loader2, Shield, CheckCircle, Gift } from "lucide-react";
import { useAuth } from "./auth-context";

export function SignupPage() {
  const { signUp, user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Navigate reactively once user state is committed
  useEffect(() => {
    if (user && profile && !authLoading) navigate("/dashboard", { replace: true });
  }, [user, profile, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    const result = await signUp(email, password, name);
    setLoading(false);
    if (result.error) setError(result.error);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" style={{ fontFamily: "Inter, sans-serif" }}>
        <Loader2 className="w-8 h-8 text-[#10B981] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-[#10B981] rounded-xl flex items-center justify-center">
              <QrCode className="w-6 h-6 text-white" />
            </div>
            <span className="text-[#111827]" style={{ fontSize: "1.25rem", fontWeight: 700 }}>
              The Dom Review
            </span>
          </Link>
          <h1 className="text-[#111827] mb-2" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            Start your free trial
          </h1>
          <p className="text-[#6B7280]">10 days free + $10 credit. No credit card required.</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}
            <div>
              <label className="block text-[#111827] mb-1.5" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Joe Smith"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-[#111827] mb-1.5" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@business.com"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-[#111827] mb-1.5" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="At least 6 characters"
                  className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-lg bg-white focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111827]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#047857] disabled:opacity-50 text-white py-3 rounded-xl transition-colors"
              style={{ fontWeight: 600 }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Account
            </button>
          </form>

          <div className="mt-5 flex items-center gap-4 justify-center text-[#6B7280]" style={{ fontSize: "0.75rem" }}>
            <div className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-[#10B981]" />
              No credit card
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-[#10B981]" />
              10-day free trial
            </div>
            <div className="flex items-center gap-1">
              <Gift className="w-3.5 h-3.5 text-[#F59E0B]" />
              $10 free credit
            </div>
          </div>
        </div>

        <p className="text-center mt-6 text-[#6B7280]" style={{ fontSize: "0.875rem" }}>
          Already have an account?{" "}
          <Link to="/login" className="text-[#10B981] hover:text-[#047857]" style={{ fontWeight: 500 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}