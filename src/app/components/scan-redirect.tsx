import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-6cea9865`;

/**
 * Public scan redirect page — this is where QR codes point.
 *
 * Flow:
 * 1. Customer scans QR code → browser opens /scan/:userId
 * 2. This page calls POST /scan/:userId (with anon key for gateway auth) to record the scan
 * 3. Server returns the business's Google review link
 * 4. Page redirects the customer to the Google review page
 *
 * This avoids the "Invalid JWT" error that happens when a QR code points
 * directly to the Edge Function (phones send no Authorization header).
 */
export function ScanRedirect() {
  const { userId } = useParams<{ userId: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setError("Invalid QR code — no business ID found.");
      return;
    }

    let cancelled = false;

    const doScan = async () => {
      try {
        // Call the scan recording endpoint — uses anon key for Supabase gateway auth
        const res = await fetch(`${API_BASE}/scan/${userId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${publicAnonKey}`,
          },
        });

        if (cancelled) return;

        if (res.ok) {
          const data = await res.json();
          const reviewLink = data.reviewLink;

          if (reviewLink && reviewLink.length > 0) {
            // Redirect to Google review page
            window.location.href = reviewLink;
            return;
          } else {
            setError(
              "This business hasn't set up their Google review link yet. Please ask them to configure it in their dashboard."
            );
          }
        } else {
          console.error("Scan API error:", res.status);
          // Even if the scan recording fails, try the redirect endpoint as fallback
          try {
            const redirectRes = await fetch(`${API_BASE}/r/${userId}`, {
              headers: {
                Authorization: `Bearer ${publicAnonKey}`,
              },
              redirect: "manual",
            });
            // If we get a redirect response, follow it
            const location = redirectRes.headers.get("location");
            if (location && !location.includes("placeid=EXAMPLE")) {
              window.location.href = location;
              return;
            }
          } catch {
            // Fallback failed too
          }
          setError("Something went wrong recording this scan. Please try again.");
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Scan redirect error:", err);
        setError("Could not connect to the server. Please check your internet connection and try again.");
      }
    };

    doScan();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Error state
  if (error) {
    return (
      <div
        className="min-h-screen bg-white flex items-center justify-center px-4"
        style={{ fontFamily: "Inter, sans-serif" }}
      >
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h1
            className="text-[#111827] mb-2"
            style={{ fontSize: "1.25rem", fontWeight: 700 }}
          >
            Unable to Open Review Page
          </h1>
          <p
            className="text-[#6B7280] mb-6"
            style={{ fontSize: "0.875rem", lineHeight: 1.6 }}
          >
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-[#10B981] hover:bg-[#047857] text-white rounded-lg transition-colors"
            style={{ fontSize: "0.875rem", fontWeight: 500 }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Loading state — shown while the scan is being recorded and redirect is preparing
  return (
    <div
      className="min-h-screen bg-white flex items-center justify-center px-4"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#10B981] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p
          className="text-[#111827] mb-1"
          style={{ fontSize: "1rem", fontWeight: 600 }}
        >
          Opening Google Reviews...
        </p>
        <p className="text-[#6B7280]" style={{ fontSize: "0.875rem" }}>
          You'll be redirected in a moment
        </p>
      </div>
    </div>
  );
}
