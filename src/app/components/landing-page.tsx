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
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#10B981] rounded-lg flex items-center justify-center">
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
        <div className="absolute inset-0 bg-gradient-to-br from-[#10B981]/5 via-transparent to-[#F59E0B]/5" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 bg-[#10B981]/10 text-[#047857] px-4 py-1.5 rounded-full mb-6">
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
                  className="inline-flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#047857] text-white px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-[#10B981]/25 hover:shadow-[#10B981]/40"
                  style={{ fontWeight: 600 }}
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
              <div className="bg-white rounded-2xl shadow-2xl shadow-gray-200/50 border border-gray-100 p-8 max-w-sm w-full">
                <div className="text-center mb-6">
                  <p className="text-[#6B7280] mb-1" style={{ fontSize: "0.875rem" }}>
                    Your customers see this:
                  </p>
                  <h3 className="text-[#111827]" style={{ fontWeight: 600 }}>
                    Joe's Pizza
                  </h3>
                </div>
                <div className="flex justify-center mb-6">
                  <div className="p-4 bg-white rounded-xl border-2 border-[#10B981]/20 shadow-lg shadow-[#10B981]/10">
                    <QRCodeSVG
                      value="https://search.google.com/local/writereview?placeid=EXAMPLE"
                      size={180}
                      fgColor="#111827"
                      bgColor="#ffffff"
                    />
                  </div>
                </div>
                <p className="text-center text-[#6B7280]" style={{ fontSize: "0.875rem" }}>
                  Scan to leave us a Google Review!
                </p>
                <div className="mt-4 flex justify-center">
                  <div className="flex -space-x-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className="w-5 h-5 text-[#F59E0B] fill-[#F59E0B]"
                      />
                    ))}
                  </div>
                </div>
              </div>
              {/* Decorative elements */}
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-[#10B981]/10 rounded-full blur-2xl" />
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-[#F59E0B]/10 rounded-full blur-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
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
          <div className="grid md:grid-cols-3 gap-8">
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
                className="relative bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="absolute -top-4 left-8">
                  <div
                    className="w-8 h-8 bg-[#10B981] rounded-full flex items-center justify-center text-white"
                    style={{ fontSize: "0.875rem", fontWeight: 700 }}
                  >
                    {item.step}
                  </div>
                </div>
                <div className="w-12 h-12 bg-[#10B981]/10 rounded-xl flex items-center justify-center mb-5 mt-2">
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
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2
              className="text-[#111827] mb-4"
              style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)", fontWeight: 700 }}
            >
              Trusted by Local Businesses
            </h2>
            <p className="text-[#6B7280] max-w-xl mx-auto" style={{ fontSize: "1.125rem" }}>
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
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
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
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
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
            <div className="relative bg-white rounded-2xl border-2 border-[#10B981] p-8 shadow-lg shadow-[#10B981]/10">
              <div className="absolute -top-3 right-6">
                <span
                  className="bg-[#F59E0B] text-white px-4 py-1 rounded-full"
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
                className="block text-center bg-[#10B981] hover:bg-[#047857] text-white px-6 py-3 rounded-xl transition-colors shadow-lg shadow-[#10B981]/25"
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
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-[#111827]" style={{ fontSize: "2.5rem", fontWeight: 800 }}>
                  $0.49
                </span>
                <span className="text-[#6B7280]">/message</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Bulk import contacts",
                  "Message templates",
                  "Tracked review links",
                  "Send history & analytics",
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
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-gradient-to-br from-[#10B981] to-[#047857] rounded-3xl p-12 lg:p-16">
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
              className="inline-flex items-center gap-2 bg-white text-[#047857] px-8 py-3.5 rounded-xl hover:bg-gray-50 transition-colors shadow-lg"
              style={{ fontWeight: 600 }}
            >
              Start Free 10-Day Trial
              <ArrowRight className="w-5 h-5" />
            </Link>
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