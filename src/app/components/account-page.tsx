import { useState, useMemo, useEffect } from "react";
import {
  Mail,
  CreditCard,
  Shield,
  Check,
  Loader2,
  MessageCircle,
  Wallet,
  Building2,
  Link as LinkIcon,
  AlertCircle,
  Plus,
  Crown,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useAuth } from "./auth-context";

const TOP_UP_AMOUNTS = [5, 10, 25, 50];

export function AccountPage() {
  const { profile, updateProfile, apiCall } = useAuth();
  const [email, setEmail] = useState(profile?.email || "");
  const [name, setName] = useState(profile?.name || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Top-up state
  const [topUpAmount, setTopUpAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [topUpSubmitting, setTopUpSubmitting] = useState(false);
  const [topUpSuccess, setTopUpSuccess] = useState(false);
  const [topUpError, setTopUpError] = useState("");
  const [recentTopUps, setRecentTopUps] = useState<any[]>([]);
  const [loadingTopUps, setLoadingTopUps] = useState(false);

  // Sync local state when profile loads or changes externally
  useEffect(() => {
    if (profile) {
      setEmail(profile.email || "");
      setName(profile.name || "");
    }
  }, [profile]);

  // Load recent top-up requests
  useEffect(() => {
    const loadTopUps = async () => {
      setLoadingTopUps(true);
      try {
        const res = await apiCall("/topup-requests");
        if (res.ok) {
          const data = await res.json();
          setRecentTopUps(data.requests || []);
        }
      } catch {
        console.log("Failed to load top-up requests");
      }
      setLoadingTopUps(false);
    };
    loadTopUps();
  }, [apiCall]);

  const trialInfo = useMemo(() => {
    if (!profile?.trialStartDate) return { daysRemaining: 10, progress: 0 };
    const start = new Date(profile.trialStartDate);
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const remaining = Math.max(0, 10 - elapsed);
    const progress = Math.min(100, (elapsed / 10) * 100);
    return { daysRemaining: remaining, progress };
  }, [profile?.trialStartDate]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    setSaved(false);
    const result = await updateProfile({
      name: name.trim(),
    });
    setSaving(false);
    if (result.error) {
      setSaveError(result.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleTopUp = async () => {
    const amount = topUpAmount || (customAmount ? parseFloat(customAmount) : 0);
    if (!amount || amount <= 0) {
      setTopUpError("Please select or enter a valid amount.");
      return;
    }
    setTopUpSubmitting(true);
    setTopUpError("");
    setTopUpSuccess(false);
    try {
      const res = await apiCall("/topup-request", {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
      if (res.ok) {
        setTopUpSuccess(true);
        setTopUpAmount(null);
        setCustomAmount("");
        // Refresh top-up list
        const listRes = await apiCall("/topup-requests");
        if (listRes.ok) {
          const data = await listRes.json();
          setRecentTopUps(data.requests || []);
        }
        setTimeout(() => setTopUpSuccess(false), 5000);
      } else {
        const data = await res.json().catch(() => ({ error: "Request failed" }));
        setTopUpError(data.error || "Failed to submit top-up request");
      }
    } catch {
      setTopUpError("Network error. Please try again.");
    }
    setTopUpSubmitting(false);
  };

  const initials = (profile?.name || profile?.businessName || profile?.email || "U")
    .charAt(0)
    .toUpperCase();

  const qrCount = profile?.qrCodes?.length || (profile?.reviewLink ? 1 : 0);
  const maxQR = profile?.plan === "pro" ? 5 : 1;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-[#111827]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
          Account
        </h1>
        <p className="text-[#6B7280]" style={{ fontSize: "0.875rem" }}>
          Manage your account settings and subscription
        </p>
      </div>

      {/* Profile */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-[#111827] mb-4" style={{ fontWeight: 600 }}>
          Profile
        </h3>
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-16 h-16 bg-[#10B981] rounded-full flex items-center justify-center text-white"
            style={{ fontSize: "1.5rem", fontWeight: 700 }}
          >
            {initials}
          </div>
          <div>
            <p className="text-[#111827]" style={{ fontWeight: 600 }}>
              {profile?.businessName || profile?.name || "Your Business"}
            </p>
            <p className="text-[#6B7280]" style={{ fontSize: "0.875rem" }}>
              {profile?.email || ""}
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-[#111827] mb-1.5" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-[#111827] mb-1.5" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-[#6B7280] cursor-not-allowed"
            />
            <p className="text-[#6B7280] mt-1" style={{ fontSize: "0.75rem" }}>
              Email cannot be changed
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-[#10B981] hover:bg-[#047857] disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2"
            style={{ fontWeight: 500 }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saved ? <Check className="w-4 h-4" /> : null}
            {saved ? "Saved!" : "Save Changes"}
          </button>
          {saveError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-600" style={{ fontSize: "0.8rem" }}>{saveError}</p>
            </div>
          )}
        </div>
      </div>

      {/* Subscription */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-[#111827] mb-4" style={{ fontWeight: 600 }}>
          Subscription
        </h3>
        <div className="space-y-4">
          {/* Current Plan */}
          <div className="flex items-center justify-between p-4 bg-[#10B981]/5 rounded-lg border border-[#10B981]/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#10B981]/10 rounded-lg flex items-center justify-center">
                {profile?.plan === "pro" ? (
                  <Crown className="w-5 h-5 text-[#10B981]" />
                ) : (
                  <Shield className="w-5 h-5 text-[#10B981]" />
                )}
              </div>
              <div>
                <p className="text-[#111827]" style={{ fontWeight: 600 }}>
                  {profile?.plan === "trial"
                    ? "Free Trial"
                    : profile?.plan === "starter"
                    ? "Starter Plan"
                    : "Pro Plan"}
                </p>
                <p className="text-[#047857]" style={{ fontSize: "0.875rem" }}>
                  {profile?.plan === "trial"
                    ? `${trialInfo.daysRemaining} days remaining`
                    : profile?.plan === "pro"
                    ? `${qrCount}/${maxQR} QR codes used`
                    : `${qrCount}/${maxQR} QR code used`}
                </p>
              </div>
            </div>
            <span
              className="bg-[#10B981] text-white px-3 py-1 rounded-full"
              style={{ fontSize: "0.75rem", fontWeight: 600 }}
            >
              ACTIVE
            </span>
          </div>

          {/* Plan Options */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div
              className={`border rounded-lg p-4 transition-colors ${
                profile?.plan === "starter"
                  ? "border-[#10B981] bg-[#10B981]/5"
                  : "border-gray-200 hover:border-[#10B981]"
              }`}
            >
              <p className="text-[#111827] mb-1" style={{ fontWeight: 600 }}>
                Starter
              </p>
              <p className="text-[#111827] mb-2" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                $8
                <span className="text-[#6B7280]" style={{ fontSize: "0.875rem", fontWeight: 400 }}>
                  /month
                </span>
              </p>
              <ul className="text-[#6B7280] space-y-1" style={{ fontSize: "0.75rem" }}>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-[#10B981]" /> 1 QR code
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-[#10B981]" /> Scan analytics
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-[#10B981]" /> WhatsApp add-on
                </li>
              </ul>
              {profile?.plan === "starter" && (
                <p className="mt-2 text-[#10B981]" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                  Current Plan
                </p>
              )}
            </div>
            <div
              className={`border-2 rounded-lg p-4 relative transition-colors ${
                profile?.plan === "pro"
                  ? "border-[#10B981] bg-[#10B981]/5"
                  : "border-[#10B981] hover:bg-[#10B981]/5"
              }`}
            >
              <span
                className="absolute -top-2.5 right-3 bg-[#F59E0B] text-white px-2 py-0.5 rounded-full"
                style={{ fontSize: "0.625rem", fontWeight: 700 }}
              >
                POPULAR
              </span>
              <p className="text-[#111827] mb-1" style={{ fontWeight: 600 }}>
                Pro
              </p>
              <p className="text-[#111827] mb-2" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                $15
                <span className="text-[#6B7280]" style={{ fontSize: "0.875rem", fontWeight: 400 }}>
                  /month
                </span>
              </p>
              <ul className="text-[#6B7280] space-y-1" style={{ fontSize: "0.75rem" }}>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-[#10B981]" />{" "}
                  <strong className="text-[#111827]">Up to 5 QR codes</strong>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-[#10B981]" /> Advanced analytics
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-[#10B981]" /> WhatsApp add-on
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-[#10B981]" /> Priority support
                </li>
              </ul>
              {profile?.plan === "pro" && (
                <p className="mt-2 text-[#10B981]" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                  Current Plan
                </p>
              )}
            </div>
          </div>

          {/* WhatsApp Add-on */}
          <div className="border border-[#25D366]/30 bg-[#25D366]/5 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#25D366]/10 rounded-lg flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-[#25D366]" />
                </div>
                <div>
                  <p className="text-[#111827]" style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                    WhatsApp Reviews Add-on
                  </p>
                  <p className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>
                    Free to send · Import at $0.0001/contact · Team sends for you
                  </p>
                </div>
              </div>
              <span
                className="bg-[#25D366] text-white px-3 py-1 rounded-full shrink-0"
                style={{ fontSize: "0.625rem", fontWeight: 700 }}
              >
                ADD-ON
              </span>
            </div>
          </div>

          {/* QR Code Add-on */}
          <div className="border border-[#F59E0B]/30 bg-[#F59E0B]/5 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#F59E0B]/10 rounded-lg flex items-center justify-center">
                  <Plus className="w-5 h-5 text-[#F59E0B]" />
                </div>
                <div>
                  <p className="text-[#111827]" style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                    Extra QR Code Add-On
                  </p>
                  <p className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>
                    $5 per extra QR code · Deducted from balance
                    {(profile?.extraQrSlots ?? 0) > 0 && (
                      <span className="text-[#10B981] font-semibold"> · {profile?.extraQrSlots} purchased</span>
                    )}
                  </p>
                </div>
              </div>
              <span
                className="bg-[#F59E0B] text-white px-3 py-1 rounded-full shrink-0"
                style={{ fontSize: "0.625rem", fontWeight: 700 }}
              >
                ADD-ON
              </span>
            </div>
          </div>

          {/* Connect Payment */}
          <button
            className="w-full flex items-center justify-center gap-2 bg-[#F59E0B] hover:bg-[#D97706] text-white py-3 rounded-lg transition-colors"
            style={{ fontWeight: 600 }}
          >
            <CreditCard className="w-5 h-5" />
            Connect Payment (Stripe)
          </button>
          <p className="text-center text-[#6B7280]" style={{ fontSize: "0.75rem" }}>
            Stripe payment integration coming soon. Your free trial will continue until it expires.
          </p>
        </div>
      </div>

      {/* Balance & Top-Up */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-[#111827] mb-4" style={{ fontWeight: 600 }}>
          Account Balance & Top-Up
        </h3>

        {/* Current Balance */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[#10B981]/10 to-[#047857]/10 rounded-lg border border-[#10B981]/20 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#10B981]/20 rounded-lg flex items-center justify-center">
              <Wallet className="w-5 h-5 text-[#10B981]" />
            </div>
            <div>
              <p className="text-[#111827]" style={{ fontWeight: 600 }}>
                Current Balance
              </p>
              <p className="text-[#047857]" style={{ fontSize: "0.875rem" }}>
                Used for WhatsApp contact imports ($0.0001/contact)
              </p>
            </div>
          </div>
          <span className="text-[#10B981]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            ${(profile?.balance ?? 0).toFixed(2)}
          </span>
        </div>

        {/* Top-up success */}
        {topUpSuccess && (
          <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-lg p-3 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
            <p className="text-[#047857]" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
              Top-up request submitted! Our team will process it shortly and add funds to your account.
            </p>
          </div>
        )}

        {/* Top-up error */}
        {topUpError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-red-600" style={{ fontSize: "0.875rem" }}>{topUpError}</p>
          </div>
        )}

        {/* Top-up amounts */}
        <div className="mb-4">
          <p className="text-[#111827] mb-3" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
            Top Up Your Balance
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            {TOP_UP_AMOUNTS.map((amount) => (
              <button
                key={amount}
                onClick={() => {
                  setTopUpAmount(amount);
                  setCustomAmount("");
                  setTopUpError("");
                }}
                className={`py-3 rounded-lg border-2 transition-all ${
                  topUpAmount === amount
                    ? "border-[#10B981] bg-[#10B981]/10 text-[#047857]"
                    : "border-gray-200 hover:border-[#10B981]/50 text-[#111827]"
                }`}
                style={{ fontWeight: 600 }}
              >
                ${amount}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]">$</span>
              <input
                type="number"
                min="1"
                step="0.01"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setTopUpAmount(null);
                  setTopUpError("");
                }}
                placeholder="Custom amount"
                className="w-full pl-7 pr-4 py-2.5 border border-gray-200 rounded-lg bg-white focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 outline-none transition-all"
              />
            </div>
            <button
              onClick={handleTopUp}
              disabled={topUpSubmitting || (!topUpAmount && !customAmount)}
              className="flex items-center gap-2 bg-[#10B981] hover:bg-[#047857] disabled:opacity-50 text-white px-6 py-2.5 rounded-lg transition-colors whitespace-nowrap"
              style={{ fontWeight: 500 }}
            >
              {topUpSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {topUpSubmitting ? "Submitting..." : "Request Top-Up"}
            </button>
          </div>
          <p className="text-[#6B7280] mt-2" style={{ fontSize: "0.75rem" }}>
            Top-up requests are processed by our team. Your balance will be updated once confirmed.
          </p>
        </div>

        {/* Recent Top-up Requests */}
        {recentTopUps.length > 0 && (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-[#111827] mb-3" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
              Recent Top-Up Requests
            </p>
            <div className="space-y-2">
              {recentTopUps.slice(0, 5).map((req, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        req.status === "completed"
                          ? "bg-green-100"
                          : req.status === "rejected"
                          ? "bg-red-100"
                          : "bg-yellow-100"
                      }`}
                    >
                      {req.status === "completed" ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : req.status === "rejected" ? (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      ) : (
                        <Clock className="w-4 h-4 text-yellow-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-[#111827]" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                        ${req.amount?.toFixed(2)} top-up
                      </p>
                      <p className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>
                        {new Date(req.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full ${
                      req.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : req.status === "rejected"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                    style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase" }}
                  >
                    {req.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Security */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-[#111827] mb-4" style={{ fontWeight: 600 }}>
          Security & Privacy
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Shield className="w-5 h-5 text-[#10B981]" />
            <div>
              <p className="text-[#111827]" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                SSL Secured
              </p>
              <p className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>
                All data is encrypted in transit
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Mail className="w-5 h-5 text-[#10B981]" />
            <div>
              <p className="text-[#111827]" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                Minimal Data Collection
              </p>
              <p className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>
                We only collect your email and business review link
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}