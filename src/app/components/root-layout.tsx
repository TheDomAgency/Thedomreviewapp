import { Outlet } from "react-router";
import { AuthProvider } from "./auth-context";

export function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}
