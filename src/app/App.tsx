import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Component, ReactNode, ErrorInfo } from "react";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", fontFamily: "Inter, sans-serif" }}>
          <h1 style={{ color: "#DC2626" }}>Something went wrong</h1>
          <pre style={{ background: "#F3F4F6", padding: "10px", borderRadius: "5px", overflow: "auto" }}>
            {this.state.error?.toString()}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}