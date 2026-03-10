import { useState, useMemo } from "react";
import {
  Mail,
  CreditCard,
  Shield,
  Check,
  Loader2,
  MessageCircle,
  Wallet,
} from "lucide-react";
import { useAuth } from "./auth-context";

export function AccountPage() {
  const { profile, updateProfile } = useAuth();
  const [email, setEmail] = useState(profile?.email || "");
  const [name, setName] = useState(profile?.name || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
    const result = await updateProfile({ name: name.trim() });
    setSaving(false);
    if (!result.error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const initials = (profile?.name || profile?.businessName || profile?.email || "U")
    .charAt(0)
    .toUpperCase();

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
            <label
              className="block text-[#111827] mb-1.5"
              style={{ fontSize: "0.875rem", fontWeight: 500 }}
            >
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
            <label
              className="block text-[#111827] mb-1.5"
              style={{ fontSize: "0.875rem", fontWeight: 500 }}
            >
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
        </div>
      </div>

      {/* Subscription */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-[#111827] mb-4" style={{ fontWeight: 600 }}>
          Subscription
        </h3>
        <div className="space-y-4">
          {/* Account Balance */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[#10B981]/10 to-[#047857]/10 rounded-lg border border-[#10B981]/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#10B981]/20 rounded-lg flex items-center justify-center">
                <Wallet className="w-5 h-5 text-[#10B981]" />
              </div>
              <div>
                <p className="text-[#111827]" style={{ fontWeight: 600 }}>
                  Account Balance
                </p>
                <p className="text-[#047857]" style={{ fontSize: "0.875rem" }}>
                  Free credit from signup
                </p>
              </div>
            </div>
            <span
              className="text-[#10B981]"
              style={{ fontSize: "1.25rem", fontWeight: 700 }}
            >
              ${(profile?.balance ?? 0).toFixed(2)}
            </span>
          </div>

          {/* Current Plan */}
          <div className="flex items-center justify-between p-4 bg-[#10B981]/5 rounded-lg border border-[#10B981]/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#10B981]/10 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#10B981]" />
              </div>
              <div>
                <p className="text-[#111827]" style={{ fontWeight: 600 }}>
                  {profile?.plan === "trial" ? "Free Trial" : profile?.plan === "starter" ? "Starter Plan" : "Pro Plan"}
                </p>
                {profile?.plan === "trial" && (
                  <p className="text-[#047857]" style={{ fontSize: "0.875rem" }}>
                    {trialInfo.daysRemaining} days remaining
                  </p>
                )}
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
            <div className="border border-gray-200 rounded-lg p-4 hover:border-[#10B981] transition-colors cursor-pointer">
              <p className="text-[#111827] mb-1" style={{ fontWeight: 600 }}>
                Starter
              </p>
              <p className="text-[#111827] mb-2" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                $8
                <span
                  className="text-[#6B7280]"
                  style={{ fontSize: "0.875rem", fontWeight: 400 }}
                >
                  /month
                </span>
              </p>
              <p className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>
                1 QR code, scan analytics
              </p>
            </div>
            <div className="border-2 border-[#10B981] rounded-lg p-4 relative cursor-pointer">
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
                <span
                  className="text-[#6B7280]"
                  style={{ fontSize: "0.875rem", fontWeight: 400 }}
                >
                  /month
                </span>
              </p>
              <p className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>
                5 QR codes, advanced analytics
              </p>
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
                    $0.49 per message · Bulk import · Team sends for you
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