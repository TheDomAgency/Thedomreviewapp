import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/root-layout";
import { LandingPage } from "./components/landing-page";
import { LoginPage } from "./components/login-page";
import { SignupPage } from "./components/signup-page";
import { DashboardLayout } from "./components/dashboard-layout";
import { DashboardHome } from "./components/dashboard-home";
import { QRCodePage } from "./components/qr-code-page";
import { WhatsAppPage } from "./components/whatsapp-page";
import { AnalyticsPage } from "./components/analytics-page";
import { AccountPage } from "./components/account-page";
import { PrivacyPage } from "./components/privacy-page";
import { TermsPage } from "./components/terms-page";
import { AdminDashboard } from "./components/admin-dashboard";
import { ProtectedRoute } from "./components/protected-route";
import { ScanRedirect } from "./components/scan-redirect";
import { Link } from "react-router";

function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="text-center">
        <h1 className="text-6xl font-bold text-[#10B981] mb-4">404</h1>
        <p className="text-2xl text-[#111827] mb-2">Page not found</p>
        <p className="text-[#6B7280] mb-6">The page you're looking for doesn't exist.</p>
        <Link
          to="/"
          className="inline-block px-6 py-3 bg-[#10B981] hover:bg-[#047857] text-white rounded-lg transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}

function ErrorPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#DC2626] mb-4">Oops! Something went wrong</h1>
        <p className="text-[#6B7280] mb-6">Please try refreshing the page.</p>
        <Link
          to="/"
          className="inline-block px-6 py-3 bg-[#10B981] hover:bg-[#047857] text-white rounded-lg transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    errorElement: <ErrorPage />,
    children: [
      { index: true, Component: LandingPage },
      { path: "login", Component: LoginPage },
      { path: "signup", Component: SignupPage },
      { path: "privacy", Component: PrivacyPage },
      { path: "terms", Component: TermsPage },
      { path: "scan/:userId", Component: ScanRedirect },
      {
        path: "dashboard/admin",
        element: (
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "dashboard",
        element: (
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, Component: DashboardHome },
          { path: "qr-code", Component: QRCodePage },
          { path: "whatsapp", Component: WhatsAppPage },
          { path: "analytics", Component: AnalyticsPage },
          { path: "account", Component: AccountPage },
        ],
      },
      { path: "*", Component: NotFound },
    ],
  },
]);