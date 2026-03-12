import { Link } from "react-router";
import { QRCodeSVG } from "qrcode.react";
import {
  QrCode,
  Star,
  Shield,
  CheckCircle,
  ArrowRight,
  Smartphone,
  Link as LinkIcon,
  Zap,
} from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { useAuth } from "./auth-context";

const heroImage =
  "https://images.unsplash.com/photo-1687422808191-93810cd07ab0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzbWFsbCUyMGJ1c2luZXNzJTIwb3duZXIlMjBoYXBweSUyMGN1c3RvbWVyfGVufDF8fHx8MTc3MzA4NDc4MHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";

const restaurantImage =
  "https://images.unsplash.com/photo-1489925461942-d8f490a04588?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZXN0YXVyYW50JTIwY2FmZSUyMGNvdW50ZXIlMjB0YWJsZXR8ZW58MXx8fHwxNzczMDg0NzgxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";

const salonImage =
  "https://images.unsplash.com/photo-1759134198561-e2041049419c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzYWxvbiUyMGJhcmJlciUyMHNob3AlMjBpbnRlcmlvcnxlbnwxfHx8fDE3NzMwODQ3ODF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";

export function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100" style={{ borderTop: "3px solid #10B981" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-[#10B981] to-[#047857] rounded-xl flex items-center justify-center shadow-md shadow-[#10B981]/30">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <span className="text-[#111827]" style={{ fontSize: "1.125rem", fontWeight: 700 }}>
              The Dom Review
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-[#6B7280] hover:text-[#111827] transition-colors">
              How It Works
            </a>
            <a href="#pricing" className="text-[#6B7280] hover:text-[#111827] transition-colors">
              Pricing
            </a>
            {user ? (
              <Link
                to="/dashboard"
                className="bg-[#10B981] hover:bg-[#047857] text-white px-5 py-2 rounded-lg transition-colors"
                style={{ fontWeight: 600 }}
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-[#6B7280] hover:text-[#111827] transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="bg-[#10B981] hover:bg-[#047857] text-white px-5 py-2 rounded-lg transition-colors"
                >
                  Start Free Trial
                </Link>
              </>
            )}
          </div>
          {user ? (
            <Link
              to="/dashboard"
              className="md:hidden bg-[#10B981] hover:bg-[#047857] text-white px-4 py-2 rounded-lg transition-colors"
              style={{ fontWeight: 600 }}
            >
              Dashboard
            </Link>
          ) : (
            <Link
              to="/signup"
              className="md:hidden bg-[#10B981] hover:bg-[#047857] text-white px-4 py-2 rounded-lg transition-colors"
            >
              Start Free
            </Link>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#10B981]/8 via-white to-[#F59E0B]/8" />
        <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, rgba(16,185,129,0.07) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(245,158,11,0.07) 0%, transparent 50%)" }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 bg-[#10B981]/10 text-[#047857] px-4 py-1.5 rounded-full mb-6 border border-[#10B981]/20">
                <Zap className="w-4 h-4" />
                <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>Built for small businesses</span>
              </div>
              <h1
                className="text-[#111827] mb-6"
                style={{ fontSize: "clamp(2rem, 5vw, 3.25rem)", fontWeight: 800, lineHeight: 1.15 }}
              >
                Turn Happy Customers Into{" "}
                <span className="text-[#10B981]">Google Reviews</span>
              </h1>
              <p className="text-[#6B7280] mb-8 max-w-lg" style={{ fontSize: "1.125rem", lineHeight: 1.7 }}>
                Create a QR code your customers can scan to leave reviews
                instantly. No apps to download, no complicated setup.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 text-white px-8 py-3.5 rounded-xl transition-all shadow-xl hover:-translate-y-0.5 hover:shadow-2xl"
                  style={{ fontWeight: 700, background: "linear-gradient(135deg, #10B981 0%, #047857 100%)", boxShadow: "0 8px 24px rgba(16,185,129,0.35)" }}
                >
                  Start Free 10-Day Trial
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 border border-gray-200 text-[#111827] px-8 py-3.5 rounded-xl hover:bg-gray-50 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  See How It Works
                </a>
              </div>
              <div className="flex items-center gap-6 text-[#6B7280]">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-[#10B981]" />
                  <span style={{ fontSize: "0.875rem" }}>No credit card required</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-[#10B981]" />
                  <span style={{ fontSize: "0.875rem" }}>Setup in 2 minutes</span>
                </div>
              </div>
            </div>

            {/* QR Demo Preview */}
            <div className="relative flex justify-center lg:justify-end">
              {/* Floating new review notification */}
              <div className="absolute -top-4 -left-4 lg:-left-10 z-20 bg-white rounded-2xl shadow-xl border border-gray-100 px-4 py-3 flex items-center gap-3" style={{ minWidth: "180px" }}>
                <div className="w-9 h-9 bg-[#10B981]/10 rounded-full flex items-center justify-center shrink-0">
                  <Star className="w-5 h-5 text-[#F59E0B] fill-[#F59E0B]" />
                </div>
                <div>
                  <p className="text-[#111827]" style={{ fontSize: "0.8rem", fontWeight: 600, lineHeight: 1.2 }}>New Review!</p>
                  <div className="flex gap-0.5 mt-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className="w-3 h-3 text-[#F59E0B] fill-[#F59E0B]" />
                    ))}
                  </div>
                </div>
              </div>
              {/* Scan count badge */}
              <div className="absolute -bottom-3 -right-3 lg:-right-6 z-20 bg-gradient-to-br from-[#10B981] to-[#047857] rounded-2xl shadow-lg shadow-[#10B981]/30 px-4 py-2.5">
                <p className="text-white/80" style={{ fontSize: "0.7rem", fontWeight: 500 }}>This week</p>
                <p className="text-white" style={{ fontSize: "1.1rem", fontWeight: 800, lineHeight: 1.2 }}>47 scans</p>
              </div>
              <div className="bg-white rounded-3xl shadow-2xl shadow-gray-300/60 border border-gray-100 p-8 max-w-sm w-full relative" style={{ background: "linear-gradient(145deg, #ffffff 0%, #f9fffe 100%)" }}>
                <div className="text-center mb-6">
                  <p className="text-[#6B7280] mb-1" style={{ fontSize: "0.875rem" }}>
                    Your customers see this:
                  </p>
                  <h3 className="text-[#111827]" style={{ fontWeight: 600 }}>
                    Joe's Pizza
                  </h3>
                </div>
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-2xl bg-[#10B981]/20 blur-lg scale-110" />
                    <div className="relative p-4 bg-white rounded-2xl border-2 border-[#10B981]/30 shadow-lg">
                      <QRCodeSVG
                        value="https://search.google.com/local/writereview?placeid=EXAMPLE"
                        size={180}
                        fgColor="#111827"
                        bgColor="#ffffff"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-center text-[#6B7280]" style={{ fontSize: "0.875rem" }}>
                  Scan to leave us a Google Review!
                </p>
                <div className="mt-4 flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className="w-5 h-5 text-[#F59E0B] fill-[#F59E0B]"
                    />
                  ))}
                </div>
              </div>
              {/* Decorative elements */}
              <div className="absolute -top-8 -right-8 w-36 h-36 bg-[#10B981]/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-[#F59E0B]/10 rounded-full blur-3xl" />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20" style={{ background: "linear-gradient(180deg, #f9fffe 0%, #ffffff 100%)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-[#10B981]/10 text-[#047857] px-4 py-1.5 rounded-full mb-4 border border-[#10B981]/20">
              <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>Simple setup</span>
            </div>
            <h2
              className="text-[#111827] mb-4"
              style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)", fontWeight: 700 }}
            >
              How It Works
            </h2>
            <p className="text-[#6B7280] max-w-xl mx-auto" style={{ fontSize: "1.125rem" }}>
              Get more Google reviews in three simple steps
            </p>
          </div>
          <div className="relative grid md:grid-cols-3 gap-8">
            {/* Connector line between cards (desktop only) */}
            <div className="hidden md:block absolute top-16 left-1/3 right-1/3 h-0.5 z-0" style={{ background: "repeating-linear-gradient(90deg, #10B981 0, #10B981 8px, transparent 8px, transparent 16px)" }} />
            {[
              {
                icon: LinkIcon,
                step: "1",
                title: "Add Your Google Review Link",
                desc: "Paste your Google Business review link. We'll show you how to find it.",
              },
              {
                icon: QrCode,
                step: "2",
                title: "Generate Your QR Code",
                desc: "We instantly create a unique QR code linked to your review page.",
              },
              {
                icon: Smartphone,
                step: "3",
                title: "Customers Scan & Review",
                desc: "Place your QR code at the counter, on receipts, or anywhere visible.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="relative bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 z-10"
              >
                <div className="absolute -top-5 left-8">
                  <div
                    className="w-10 h-10 bg-gradient-to-br from-[#10B981] to-[#047857] rounded-full flex items-center justify-center text-white shadow-lg shadow-[#10B981]/30"
                    style={{ fontSize: "1rem", fontWeight: 700 }}
                  >
                    {item.step}
                  </div>
                </div>
                <div className="w-12 h-12 bg-[#10B981]/10 rounded-xl flex items-center justify-center mb-5 mt-3">
                  <item.icon className="w-6 h-6 text-[#10B981]" />
                </div>
                <h3 className="text-[#111827] mb-2" style={{ fontWeight: 600 }}>
                  {item.title}
                </h3>
                <p className="text-[#6B7280]" style={{ lineHeight: 1.7 }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20" style={{ background: "linear-gradient(135deg, #064E3B 0%, #065F46 50%, #047857 100%)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-white/10 text-white/90 px-4 py-1.5 rounded-full mb-4 border border-white/20">
              <Star className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
              <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>Real results</span>
            </div>
            <h2
              className="text-white mb-4"
              style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)", fontWeight: 700 }}
            >
              Trusted by Local Businesses
            </h2>
            <p className="text-white/70 max-w-xl mx-auto" style={{ fontSize: "1.125rem" }}>
              Restaurants, salons, auto repair shops, dentists and more
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                img: heroImage,
                name: "Maria's Bakery",
                quote: "We went from 12 to 87 reviews in just 3 months!",
                person: "Maria G.",
              },
              {
                img: restaurantImage,
                name: "Tony's Auto Repair",
                quote: "So simple to set up. Our customers love it.",
                person: "Tony R.",
              },
              {
                img: salonImage,
                name: "Glow Up Salon",
                quote: "The QR code sits right at checkout. Reviews pour in!",
                person: "Ashley K.",
              },
            ].map((t) => (
              <div
                key={t.name}
                className="bg-white rounded-2xl overflow-hidden shadow-xl shadow-black/20 hover:shadow-2xl hover:-translate-y-1 transition-all duration-200"
              >
                <div className="h-48 overflow-hidden">
                  <ImageWithFallback
                    src={t.img}
                    alt={t.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6">
                  <div className="flex gap-0.5 mb-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]"
                      />
                    ))}
                  </div>
                  <p className="text-[#111827] mb-3" style={{ fontWeight: 500 }}>
                    "{t.quote}"
                  </p>
                  <p className="text-[#6B7280]" style={{ fontSize: "0.875rem" }}>
                    — {t.person}, {t.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2
              className="text-[#111827] mb-4"
              style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)", fontWeight: 700 }}
            >
              Simple, Transparent Pricing
            </h2>
            <p className="text-[#6B7280] max-w-xl mx-auto" style={{ fontSize: "1.125rem" }}>
              Start with a free 10-day trial. No credit card required.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Starter */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
              <h3 className="text-[#111827] mb-1" style={{ fontWeight: 600 }}>
                Starter
              </h3>
              <p className="text-[#6B7280] mb-6" style={{ fontSize: "0.875rem" }}>
                Perfect for a single location
              </p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-[#111827]" style={{ fontSize: "2.5rem", fontWeight: 800 }}>
                  $8
                </span>
                <span className="text-[#6B7280]">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "1 QR code",
                  "Scan analytics",
                  "Download & print QR",
                  "Email support",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[#111827]">
                    <CheckCircle className="w-5 h-5 text-[#10B981] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/signup"
                className="block text-center bg-white border-2 border-[#10B981] text-[#10B981] hover:bg-[#10B981] hover:text-white px-6 py-3 rounded-xl transition-colors"
                style={{ fontWeight: 600 }}
              >
                Start Free Trial
              </Link>
            </div>
            {/* Pro */}
            <div className="relative rounded-2xl p-8 shadow-xl shadow-[#10B981]/20" style={{ background: "linear-gradient(145deg, #ffffff 0%, #f0fdf8 100%)", border: "2px solid #10B981" }}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#10B981]/5 rounded-full -translate-y-1/2 translate-x-1/2 overflow-hidden rounded-2xl" />
              <div className="absolute -top-3 right-6">
                <span
                  className="bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white px-4 py-1 rounded-full shadow-md"
                  style={{ fontSize: "0.75rem", fontWeight: 700 }}
                >
                  POPULAR
                </span>
              </div>
              <h3 className="text-[#111827] mb-1" style={{ fontWeight: 600 }}>
                Pro
              </h3>
              <p className="text-[#6B7280] mb-6" style={{ fontSize: "0.875rem" }}>
                For growing businesses
              </p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-[#111827]" style={{ fontSize: "2.5rem", fontWeight: 800 }}>
                  $15
                </span>
                <span className="text-[#6B7280]">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Up to 5 QR codes",
                  "Advanced analytics",
                  "Custom branding",
                  "Priority support",
                  "Multiple locations",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[#111827]">
                    <CheckCircle className="w-5 h-5 text-[#10B981] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/signup"
                className="block text-center bg-gradient-to-r from-[#10B981] to-[#047857] hover:from-[#047857] hover:to-[#065F46] text-white px-6 py-3 rounded-xl transition-all shadow-lg shadow-[#10B981]/30"
                style={{ fontWeight: 600 }}
              >
                Start Free Trial
              </Link>
            </div>
            {/* WhatsApp Add-on */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm relative">
              <div className="absolute -top-3 right-6">
                <span
                  className="bg-[#25D366] text-white px-4 py-1 rounded-full"
                  style={{ fontSize: "0.75rem", fontWeight: 700 }}
                >
                  ADD-ON
                </span>
              </div>
              <h3 className="text-[#111827] mb-1" style={{ fontWeight: 600 }}>
                WhatsApp Reviews
              </h3>
              <p className="text-[#6B7280] mb-6" style={{ fontSize: "0.875rem" }}>
                Send review requests via WhatsApp
              </p>
              <div className="mb-2">
                <span className="text-[#25D366]" style={{ fontSize: "2.5rem", fontWeight: 800 }}>
                  Free
                </span>
              </div>
              <p className="text-[#6B7280] mb-6" style={{ fontSize: "0.8125rem" }}>
                Sending is free · Import at <span className="text-[#111827] font-semibold">$0.0001</span>/contact
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Free to send messages",
                  "Bulk import at $0.0001/contact",
                  "Message templates",
                  "Tracked review links",
                  "Team sends it for you",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[#111827]">
                    <CheckCircle className="w-5 h-5 text-[#25D366] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/signup"
                className="block text-center bg-white border-2 border-[#25D366] text-[#25D366] hover:bg-[#25D366] hover:text-white px-6 py-3 rounded-xl transition-colors"
                style={{ fontWeight: 600 }}
              >
                Add to Any Plan
              </Link>
            </div>
            {/* QR Code Add-on */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm relative">
              <div className="absolute -top-3 right-6">
                <span
                  className="bg-[#F59E0B] text-white px-4 py-1 rounded-full"
                  style={{ fontSize: "0.75rem", fontWeight: 700 }}
                >
                  ADD-ON
                </span>
              </div>
              <h3 className="text-[#111827] mb-1" style={{ fontWeight: 600 }}>
                Extra QR Code
              </h3>
              <p className="text-[#6B7280] mb-6" style={{ fontSize: "0.875rem" }}>
                Need more QR codes beyond your plan?
              </p>
              <div className="mb-2">
                <span className="text-[#F59E0B]" style={{ fontSize: "2.5rem", fontWeight: 800 }}>
                  $5
                </span>
                <span className="text-[#6B7280] ml-1" style={{ fontSize: "1rem" }}>
                  per QR code
                </span>
              </div>
              <p className="text-[#6B7280] mb-6" style={{ fontSize: "0.8125rem" }}>
                One-time purchase · Deducted from balance
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Buy as many as you need",
                  "Works with any plan",
                  "Deducted from account balance",
                  "Each QR links to a unique location",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[#111827]">
                    <CheckCircle className="w-5 h-5 text-[#F59E0B] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/signup"
                className="block text-center bg-white border-2 border-[#F59E0B] text-[#F59E0B] hover:bg-[#F59E0B] hover:text-white px-6 py-3 rounded-xl transition-colors"
                style={{ fontWeight: 600 }}
              >
                Add to Any Plan
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="relative bg-gradient-to-br from-[#10B981] to-[#064E3B] rounded-3xl p-12 lg:p-16 overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full translate-x-1/3 -translate-y-1/3" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -translate-x-1/4 translate-y-1/4" />
            <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-[#F59E0B]/10 rounded-full blur-xl" />
            <div className="relative z-10">
              <h2
                className="text-white mb-4"
                style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)", fontWeight: 700 }}
              >
                Ready to Get More Reviews?
              </h2>
              <p className="text-white/80 mb-8 max-w-lg mx-auto" style={{ fontSize: "1.125rem" }}>
                Join hundreds of local businesses using The Dom Review App to grow
                their online reputation.
              </p>
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 bg-white text-[#047857] px-8 py-3.5 rounded-xl hover:bg-gray-50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
                style={{ fontWeight: 700 }}
              >
                Start Free 10-Day Trial
                <ArrowRight className="w-5 h-5" />
              </Link>
              <p className="text-white/50 mt-4" style={{ fontSize: "0.8rem" }}>No credit card required · Cancel anytime</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#10B981] rounded-lg flex items-center justify-center">
                <QrCode className="w-4 h-4 text-white" />
              </div>
              <span className="text-[#111827]" style={{ fontWeight: 600 }}>
                The Dom Review App
              </span>
            </div>
            <div className="flex items-center gap-6 text-[#6B7280]" style={{ fontSize: "0.875rem" }}>
              <Link to="/privacy" className="hover:text-[#111827] transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="hover:text-[#111827] transition-colors">
                Terms of Service
              </Link>
            </div>
            <p className="text-[#6B7280]" style={{ fontSize: "0.875rem" }}>
              &copy; 2026 The Dom Review App. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}