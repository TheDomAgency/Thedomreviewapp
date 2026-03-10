import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/root-layout";
import { LandingPage } from "./components/landing-page";
import { LoginPage } from "./components/login-page";
import { SignupPage } from "./components/signup-page";
import { SetupWizard } from "./components/setup-wizard";
import { DashboardLayout } from "./components/dashboard-layout";
import { DashboardHome } from "./components/dashboard-home";
import { QRCodePage } from "./components/qr-code-page";
import { WhatsAppPage } from "./components/whatsapp-page";
import { AnalyticsPage } from "./components/analytics-page";
import { AccountPage } from "./components/account-page";
import { PrivacyPage } from "./components/privacy-page";
import { TermsPage } from "./components/terms-page";
import { AdminDashboard } from "./components/admin-dashboard";
import { ProtectedRoute, SetupGuard } from "./components/protected-route";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: LandingPage },
      { path: "login", Component: LoginPage },
      { path: "signup", Component: SignupPage },
      { path: "privacy", Component: PrivacyPage },
      { path: "terms", Component: TermsPage },
      {
        path: "dashboard/setup",
        element: (
          <ProtectedRoute>
            <SetupWizard />
          </ProtectedRoute>
        ),
      },
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
            <SetupGuard>
              <DashboardLayout />
            </SetupGuard>
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
    ],
  },
]);