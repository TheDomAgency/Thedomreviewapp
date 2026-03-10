import { useState, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Download,
  Copy,
  Check,
  Pencil,
  Printer,
  Loader2,
} from "lucide-react";
import { useAuth } from "./auth-context";
import { projectId } from "/utils/supabase/info";

export function QRCodePage() {
  const { profile, user, updateProfile } = useAuth();
  const [businessName, setBusinessName] = useState(profile?.businessName || "");
  const [reviewLink, setReviewLink] = useState(profile?.reviewLink || "");
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  // Sync local state when profile loads or changes
  useEffect(() => {
    if (profile) {
      setBusinessName(profile.businessName || "");
      setReviewLink(profile.reviewLink || "");
    }
  }, [profile]);

  // The QR code points to the scan-tracking redirect endpoint
  const scanUrl = user?.id
    ? `https://${projectId}.supabase.co/functions/v1/make-server-6cea9865/r/${user.id}`
    : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(reviewLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    await updateProfile({
      businessName: businessName.trim(),
      reviewLink: reviewLink.trim(),
    });
    setSaving(false);
    setIsEditing(false);
  };

  const handleDownload = () => {
    if (!scanUrl) return;
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = 600;
      canvas.height = 600;
      ctx!.fillStyle = "#ffffff";
      ctx!.fillRect(0, 0, 600, 600);
      ctx!.drawImage(img, 40, 40, 520, 520);
      const link = document.createElement("a");
      link.download = `${profile?.businessName || "qr-code"}-review.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const handlePrint = () => {
    if (!scanUrl) return;
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Print QR Code</title></head><body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:Inter,sans-serif;">
        <h2 style="margin-bottom:8px;">${profile?.businessName || ""}</h2>
        <p style="color:#6B7280;margin-bottom:24px;">Scan to leave us a Google Review!</p>
        ${svgData}
        <script>setTimeout(()=>window.print(),300)</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#111827]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
          My QR Code
        </h1>
        <p className="text-[#6B7280]" style={{ fontSize: "0.875rem" }}>
          Manage your review QR code and business settings
        </p>
      </div>

      {/* Show warning if profile isn't set up */}
      {profile && (!profile.businessName || !profile.reviewLink) && (
        <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 flex items-start gap-3">
          <span className="text-[#F59E0B] text-lg mt-0.5">&#9888;</span>
          <div>
            <p className="text-[#92400E]" style={{ fontWeight: 600, fontSize: "0.875rem" }}>
              Setup incomplete
            </p>
            <p className="text-[#92400E]" style={{ fontSize: "0.875rem" }}>
              {!profile.businessName && !profile.reviewLink
                ? "Please set your business name and Google review link using the Edit button to activate your QR code."
                : !profile.businessName
                ? "Please set your business name using the Edit button."
                : "Please set your Google review link using the Edit button."}
            </p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* QR Code Display */}
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="text-center">
            <h3 className="text-[#111827] mb-1" style={{ fontWeight: 600 }}>
              {profile?.businessName || "Your Business"}
            </h3>
            <p className="text-[#6B7280] mb-6" style={{ fontSize: "0.875rem" }}>
              Scan to leave a Google Review
            </p>
            {scanUrl ? (
              <div
                ref={qrRef}
                className="inline-block p-5 bg-white rounded-2xl border-2 border-[#10B981]/20 shadow-lg shadow-[#10B981]/10 mb-6"
              >
                <QRCodeSVG
                  value={scanUrl}
                  size={220}
                  fgColor="#111827"
                  bgColor="#ffffff"
                  level="H"
                />
              </div>
            ) : (
              <div className="inline-flex items-center justify-center w-[260px] h-[260px] bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300 mb-6">
                <p className="text-[#6B7280]" style={{ fontSize: "0.875rem" }}>
                  Loading QR code...
                </p>
              </div>
            )}
            <p className="text-[#6B7280] mb-4" style={{ fontSize: "0.75rem" }}>
              This QR code tracks scans before redirecting to your Google review page
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleDownload}
                className="flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#047857] text-white px-6 py-2.5 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Download PNG
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center justify-center gap-2 border border-gray-200 text-[#111827] px-6 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            </div>
          </div>
        </div>

        {/* Business Setup */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[#111827]" style={{ fontWeight: 600 }}>
                Business Details
              </h3>
              <button
                onClick={() => {
                  if (isEditing) {
                    setBusinessName(profile?.businessName || "");
                    setReviewLink(profile?.reviewLink || "");
                  }
                  setIsEditing(!isEditing);
                }}
                className="text-[#10B981] hover:text-[#047857] flex items-center gap-1"
                style={{ fontSize: "0.875rem", fontWeight: 500 }}
              >
                <Pencil className="w-4 h-4" />
                {isEditing ? "Cancel" : "Edit"}
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label
                  className="block text-[#111827] mb-1.5"
                  style={{ fontSize: "0.875rem", fontWeight: 500 }}
                >
                  Business Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 outline-none transition-all"
                  />
                ) : (
                  <p className="text-[#111827] px-4 py-2.5 bg-gray-50 rounded-lg">
                    {profile?.businessName || "Not set"}
                  </p>
                )}
              </div>
              <div>
                <label
                  className="block text-[#111827] mb-1.5"
                  style={{ fontSize: "0.875rem", fontWeight: 500 }}
                >
                  Google Review Link
                </label>
                {isEditing ? (
                  <input
                    type="url"
                    value={reviewLink}
                    onChange={(e) => setReviewLink(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 outline-none transition-all"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <p
                      className="flex-1 text-[#6B7280] px-4 py-2.5 bg-gray-50 rounded-lg truncate"
                      style={{ fontSize: "0.875rem" }}
                    >
                      {profile?.reviewLink || "Not set"}
                    </p>
                    <button
                      onClick={handleCopy}
                      className="shrink-0 p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-[#10B981]" />
                      ) : (
                        <Copy className="w-4 h-4 text-[#6B7280]" />
                      )}
                    </button>
                  </div>
                )}
              </div>
              {isEditing && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#047857] disabled:opacity-50 text-white py-2.5 rounded-lg transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              )}
            </div>
          </div>

          {/* Tips */}
          <div className="bg-[#10B981]/5 rounded-xl border border-[#10B981]/20 p-6">
            <h3 className="text-[#047857] mb-3" style={{ fontWeight: 600 }}>
              Tips for More Reviews
            </h3>
            <ul className="space-y-2 text-[#047857]" style={{ fontSize: "0.875rem" }}>
              <li className="flex items-start gap-2">
                <span>*</span>
                Place your QR code at the checkout counter
              </li>
              <li className="flex items-start gap-2">
                <span>*</span>
                Print it on receipts and business cards
              </li>
              <li className="flex items-start gap-2">
                <span>*</span>
                Add a small sign: "Enjoyed your visit? Scan to review!"
              </li>
              <li className="flex items-start gap-2">
                <span>*</span>
                Use table tents in restaurants or waiting rooms
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}