import { Navigate } from "react-router";
import { useAuth, isSetupCompleteOverride } from "./auth-context";
import { Loader2 } from "lucide-react";

function Spinner({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-[#10B981] animate-spin mx-auto mb-3" />
        <p className="text-[#6B7280]">{text}</p>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function SetupGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <Navigate to="/login" replace />;

  // Allow through if:
  // 1. Profile flag is true (normal case), OR
  // 2. The synchronous module-level override is set (handles React state batching
  //    race where TOKEN_REFRESHED can transiently reset setupComplete to false
  //    before the React state from updateProfile() has been committed).
  if (profile.setupComplete || isSetupCompleteOverride()) {
    return <>{children}</>;
  }

  // Setup not complete — send to wizard
  return <Navigate to="/dashboard/setup" replace />;
}