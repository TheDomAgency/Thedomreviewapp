import { useState, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Download,
  Copy,
  Check,
  Pencil,
  Printer,
  Loader2,
  MapPin,
  Search,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  Crown,
  X,
  Globe,
  ImageIcon,
  Palette,
  Wand2,
  ExternalLink,
  QrCode,
  ChevronDown,
} from "lucide-react";
import { useAuth, type QRCodeEntry } from "./auth-context";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { PrintEditor } from "./print-editor";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-6cea9865`;

interface PlaceSuggestion {
  placeId: string;
  name: string;
  address: string;
  googleMapsUri: string;
}

export function QRCodePage() {
  const { profile, user, updateProfile, refreshProfile, apiCall } = useAuth();

  // Client-side fallback: if profile has businessName/reviewLink but no qrCodes,
  // synthesize a qrCodes array so the UI works even before server migration runs
  const qrCodes: QRCodeEntry[] = (() => {
    if (profile?.qrCodes && profile.qrCodes.length > 0) return profile.qrCodes;
    if (profile?.businessName || profile?.reviewLink) {
      return [{
        id: "qr_1",
        businessName: profile.businessName || "",
        reviewLink: profile.reviewLink || "",
      }];
    }
    return [];
  })();
  const baseLimitMap: Record<string, number> = { pro: 5, starter: 1, trial: 1 };
  const baseLimit = baseLimitMap[profile?.plan || "trial"] || 1;
  const extraSlots = profile?.extraQrSlots || 0;
  const maxQR = baseLimit + extraSlots;
  const canAdd = qrCodes.length < maxQR;

  // Refresh profile on mount to pick up any admin plan changes
  useEffect(() => {
    refreshProfile();
  }, []);

  // Currently selected QR code index
  const [activeIdx, setActiveIdx] = useState(0);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  // Print editor state
  const [showPrintEditor, setShowPrintEditor] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  // Purchase QR slot state
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  // Edit form state
  const [editBusinessName, setEditBusinessName] = useState("");
  const [editReviewLink, setEditReviewLink] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");
  const [editBrandColor, setEditBrandColor] = useState("");
  const [editWebsiteUrl, setEditWebsiteUrl] = useState("");

  // Brand sync state
  const [syncingBrand, setSyncingBrand] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncSuccess, setSyncSuccess] = useState(false);

  // Logo upload state
  const [logoInputUrl, setLogoInputUrl] = useState("");

  // Google Places autocomplete state
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [placesError, setPlacesError] = useState("");
  const searchTimeoutRef = useRef<number | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Ensure activeIdx is valid
  useEffect(() => {
    if (activeIdx >= qrCodes.length && qrCodes.length > 0) {
      setActiveIdx(qrCodes.length - 1);
    }
  }, [qrCodes.length, activeIdx]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setShowDownloadMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeQR = qrCodes[activeIdx] || null;
  const scanUrl = activeQR?.reviewLink || "";
  const isEditOrAdd = isEditing !== null || isAdding;

  // Show Print Editor view
  if (showPrintEditor && activeQR) {
    return (
      <PrintEditor
        qrEntry={activeQR}
        onClose={() => {
          setShowPrintEditor(false);
          refreshProfile();
        }}
      />
    );
  }

  const handleCopy = () => {
    if (!activeQR?.reviewLink) return;
    navigator.clipboard.writeText(activeQR.reviewLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startEdit = (idx: number) => {
    const qr = qrCodes[idx];
    setEditBusinessName(qr.businessName);
    setEditReviewLink(qr.reviewLink);
    setEditLogoUrl(qr.logoUrl || "");
    setEditBrandColor(qr.brandColor || "#10B981");
    setEditWebsiteUrl(qr.websiteUrl || "");
    setSearchQuery(qr.businessName);
    setIsEditing(idx);
    setIsAdding(false);
    setSaveError("");
    setSyncError("");
    setSyncSuccess(false);
    setLogoInputUrl(qr.logoUrl || "");
  };

  const startAdd = () => {
    setEditBusinessName("");
    setEditReviewLink("");
    setEditLogoUrl("");
    setEditBrandColor("#10B981");
    setEditWebsiteUrl("");
    setSearchQuery("");
    setIsAdding(true);
    setIsEditing(null);
    setSaveError("");
    setSyncError("");
    setSyncSuccess(false);
    setLogoInputUrl("");
  };

  const cancelEdit = () => {
    setIsEditing(null);
    setIsAdding(false);
    setEditBusinessName("");
    setEditReviewLink("");
    setEditLogoUrl("");
    setEditBrandColor("#10B981");
    setEditWebsiteUrl("");
    setSaveError("");
    setSuggestions([]);
    setShowSuggestions(false);
    setSyncError("");
    setSyncSuccess(false);
    setLogoInputUrl("");
  };

  const handleSave = async () => {
    if (!editBusinessName.trim() && !editReviewLink.trim()) {
      setSaveError("Please enter a business name or review link.");
      return;
    }
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    const newEntry: QRCodeEntry = {
      id: isAdding ? `qr_${Date.now()}` : qrCodes[isEditing!].id,
      businessName: editBusinessName.trim(),
      reviewLink: editReviewLink.trim(),
      logoUrl: editLogoUrl.trim() || undefined,
      brandColor: editBrandColor.trim() || undefined,
      websiteUrl: editWebsiteUrl.trim() || undefined,
    };

    let updatedList: QRCodeEntry[];
    if (isAdding) {
      updatedList = [...qrCodes, newEntry];
    } else {
      updatedList = qrCodes.map((qr, i) => (i === isEditing ? newEntry : qr));
    }

    const result = await updateProfile({ qrCodes: updatedList });
    setSaving(false);
    if (result.error) {
      setSaveError(result.error);
    } else {
      setSaveSuccess(true);
      if (isAdding) setActiveIdx(updatedList.length - 1);
      cancelEdit();
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleDelete = async (idx: number) => {
    setSaving(true);
    setSaveError("");
    const updatedList = qrCodes.filter((_, i) => i !== idx);
    const result = await updateProfile({ qrCodes: updatedList });
    setSaving(false);
    setDeleteConfirm(null);
    if (result.error) {
      setSaveError(result.error);
    } else {
      setSaveSuccess(true);
      if (activeIdx >= updatedList.length) setActiveIdx(Math.max(0, updatedList.length - 1));
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  // ─── Brand Sync ───
  const handleSyncBrand = async () => {
    if (!editWebsiteUrl.trim()) {
      setSyncError("Please enter your website URL first.");
      return;
    }
    setSyncingBrand(true);
    setSyncError("");
    setSyncSuccess(false);
    try {
      const res = await apiCall("/sync-brand", {
        method: "POST",
        body: JSON.stringify({ websiteUrl: editWebsiteUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncError(data.error || "Failed to sync brand");
      } else {
        if (data.logoUrl) {
          setEditLogoUrl(data.logoUrl);
          setLogoInputUrl(data.logoUrl);
        }
        if (data.brandColor) {
          setEditBrandColor(data.brandColor);
        }
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 4000);
      }
    } catch {
      setSyncError("Network error. Please try again.");
    }
    setSyncingBrand(false);
  };

  // ─── Logo URL set ───
  const handleSetLogoUrl = () => {
    if (logoInputUrl.trim()) {
      setEditLogoUrl(logoInputUrl.trim());
    }
  };

  // ─── Download ───
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
      link.download = `${activeQR?.businessName || "qr-code"}-review.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
    setShowDownloadMenu(false);
  };

  // ─── Download full branded card as PNG ───
  const handleDownloadCard = () => {
    if (!scanUrl) return;
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const bc = activeQR?.brandColor || "#10B981";
    const businessName = activeQR?.businessName || "Your Business";
    const headerTitle = activeQR?.printHeaderTitle || businessName;
    const ctaText = activeQR?.printCta || "Scan to leave us a review!";
    const subtitleText = activeQR?.printSubtitle || "We'd love to hear about your experience";
    const footerText = activeQR?.printFooter || businessName;

    const scale = 2;
    const cardW = 400 * scale;
    const headerH = 72 * scale;
    const qrBlockSize = 252 * scale; // qr + padding
    const bodyPadTop = 32 * scale;
    const bodyPadBot = 32 * scale;
    const ctaH = 24 * scale;
    const subH = 18 * scale;
    const gapAfterQr = 20 * scale;
    const gapAfterCta = 8 * scale;
    const footerH = 36 * scale;
    const cardH = headerH + bodyPadTop + qrBlockSize + gapAfterQr + ctaH + gapAfterCta + subH + bodyPadBot + footerH;

    const canvas = document.createElement("canvas");
    canvas.width = cardW;
    canvas.height = cardH;
    const ctx = canvas.getContext("2d")!;

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cardW, cardH);

    // Header
    ctx.fillStyle = bc;
    ctx.fillRect(0, 0, cardW, headerH);
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${20 * scale}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(headerTitle, cardW / 2, headerH / 2, cardW - 48 * scale);

    // QR code
    const origSvg = svg.cloneNode(true) as SVGSVGElement;
    const qrPx = 220 * scale;
    origSvg.setAttribute("width", String(qrPx));
    origSvg.setAttribute("height", String(qrPx));
    const svgData = new XMLSerializer().serializeToString(origSvg);

    const qrImg = new window.Image();
    qrImg.onload = () => {
      // QR wrapper
      const wrapSize = qrBlockSize;
      const wrapX = (cardW - wrapSize) / 2;
      const wrapY = headerH + bodyPadTop;
      ctx.fillStyle = "#fafafa";
      ctx.fillRect(wrapX, wrapY, wrapSize, wrapSize);
      ctx.strokeStyle = bc + "22";
      ctx.lineWidth = 2 * scale;
      ctx.strokeRect(wrapX, wrapY, wrapSize, wrapSize);

      // QR image centered in wrapper
      const qrOffset = (wrapSize - qrPx) / 2;
      ctx.drawImage(qrImg, wrapX + qrOffset, wrapY + qrOffset, qrPx, qrPx);

      // CTA
      const ctaY = wrapY + wrapSize + gapAfterQr;
      ctx.fillStyle = "#111827";
      ctx.font = `600 ${18 * scale}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(ctaText, cardW / 2, ctaY, cardW - 48 * scale);

      // Subtitle
      const subY = ctaY + ctaH + gapAfterCta;
      ctx.fillStyle = "#6B7280";
      ctx.font = `400 ${13 * scale}px Inter, system-ui, sans-serif`;
      ctx.fillText(subtitleText, cardW / 2, subY, cardW - 48 * scale);

      // Footer
      const footerY = cardH - footerH;
      ctx.fillStyle = "#f9fafb";
      ctx.fillRect(0, footerY, cardW, footerH);
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.moveTo(0, footerY);
      ctx.lineTo(cardW, footerY);
      ctx.stroke();
      ctx.fillStyle = "#9CA3AF";
      ctx.font = `500 ${11 * scale}px Inter, system-ui, sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillText(footerText, cardW / 2, footerY + footerH / 2, cardW - 24 * scale);

      // Card border
      ctx.strokeStyle = bc;
      ctx.lineWidth = 3 * scale;
      ctx.strokeRect(0, 0, cardW, cardH);

      // Download
      const link = document.createElement("a");
      link.download = `${businessName}-review-card.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    qrImg.src = "data:image/svg+xml;base64," + btoa(svgData);
    setShowDownloadMenu(false);
  };

  // ─── Print (clean, no browser headers/footers) ───
  const handlePrint = () => {
    if (!scanUrl) return;
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const brandColor = activeQR?.brandColor || "#10B981";
    const logoUrl = activeQR?.logoUrl || "";
    const businessName = activeQR?.businessName || "";
    const headerTitle = activeQR?.printHeaderTitle || businessName;
    const ctaText = activeQR?.printCta || "Scan to leave us a review!";
    const subtitleText = activeQR?.printSubtitle || "We'd love to hear about your experience";
    const footerText = activeQR?.printFooter || businessName || "Our Business";

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html><head>
<title>Print QR Code - ${businessName}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { margin: 0; size: auto; }
  @media print {
    html, body { margin: 0; padding: 0; }
    .no-print { display: none !important; }
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: #fff;
    padding: 40px;
  }
  .card {
    width: 400px;
    border: 3px solid ${brandColor};
    border-radius: 24px;
    overflow: hidden;
    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  }
  .card-header {
    background: ${brandColor};
    padding: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }
  .card-header img {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    object-fit: contain;
    background: white;
    padding: 4px;
  }
  .card-header h1 {
    color: white;
    font-size: 20px;
    font-weight: 700;
    text-align: center;
  }
  .card-body {
    padding: 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .qr-wrapper {
    padding: 16px;
    border: 2px solid ${brandColor}22;
    border-radius: 16px;
    margin-bottom: 20px;
    background: #fafafa;
  }
  .cta {
    font-size: 18px;
    font-weight: 600;
    color: #111827;
    text-align: center;
    margin-bottom: 8px;
  }
  .subtitle {
    font-size: 13px;
    color: #6B7280;
    text-align: center;
  }
  .footer {
    background: #f9fafb;
    padding: 12px;
    text-align: center;
    border-top: 1px solid #e5e7eb;
  }
  .footer span {
    font-size: 11px;
    color: #9CA3AF;
    font-weight: 500;
  }
  .tip {
    margin-top: 24px;
    padding: 12px 16px;
    border: 1px dashed #d1d5db;
    border-radius: 8px;
    font-size: 11px;
    color: #9CA3AF;
    text-align: center;
    max-width: 400px;
  }
</style>
</head><body>
<div class="card">
  <div class="card-header">
    ${logoUrl ? `<img src="${logoUrl}" alt="Logo" onerror="this.style.display='none'" />` : ""}
    <h1>${headerTitle}</h1>
  </div>
  <div class="card-body">
    <div class="qr-wrapper">${svgData}</div>
    <p class="cta">${ctaText}</p>
    <p class="subtitle">${subtitleText}</p>
  </div>
  <div class="footer">
    <span>${footerText}</span>
  </div>
</div>
<p class="tip no-print">Tip: In your browser's print dialog, uncheck "Headers and footers" for a cleaner print.</p>
<script>setTimeout(()=>window.print(),400)</script>
</body></html>`);
    printWindow.document.close();
  };

  // ─── Google Places search ───
  const fetchSuggestions = async (query: string) => {
    setLoadingSuggestions(true);
    setShowSuggestions(true);
    setPlacesError("");
    try {
      const response = await fetch(`${API_BASE}/places-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ query }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Search failed" }));
        setPlacesError(errData.error || "Search failed");
        setSuggestions([]);
      } else {
        const data = await response.json();
        const mapped = (data.places || []).map((p: any) => ({
          placeId: p.placeId,
          name: p.name,
          address: p.address,
          googleMapsUri: p.googleMapsUri,
        }));
        setSuggestions(mapped);
        if (mapped.length === 0) setPlacesError("");
      }
    } catch {
      setPlacesError("Network error during search. Please try again.");
      setSuggestions([]);
    }
    setLoadingSuggestions(false);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEditBusinessName(val);
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (val.trim().length >= 3) {
      searchTimeoutRef.current = window.setTimeout(() => fetchSuggestions(val.trim()), 400);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: PlaceSuggestion) => {
    setEditBusinessName(suggestion.name);
    setSearchQuery(suggestion.name);
    setShowSuggestions(false);
    setSuggestions([]);
    // Build review link from place ID
    const placeId = suggestion.placeId;
    if (placeId) {
      const reviewUrl = `https://search.google.com/local/writereview?placeid=${placeId}`;
      setEditReviewLink(reviewUrl);
    }
  };

  // ─── Purchase extra QR slot ───
  const handlePurchaseSlot = async () => {
    setPurchasing(true);
    setPurchaseError("");
    setPurchaseSuccess(false);
    try {
      const res = await apiCall("/purchase-qr-slot", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setPurchaseError(data.error || "Purchase failed");
      } else {
        setPurchaseSuccess(true);
        await refreshProfile();
        setTimeout(() => setPurchaseSuccess(false), 5000);
      }
    } catch {
      setPurchaseError("Network error. Please try again.");
    }
    setPurchasing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#111827]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            My QR Codes
          </h1>
          <p className="text-[#6B7280]" style={{ fontSize: "0.875rem" }}>
            {profile?.plan === "pro"
              ? `Manage up to ${maxQR} QR codes (${qrCodes.length}/${maxQR} used)`
              : `${maxQR} QR code${maxQR > 1 ? "s" : ""} included · Upgrade for more`}
          </p>
        </div>
        {canAdd && !isEditOrAdd && (
          <button
            onClick={startAdd}
            className="flex items-center gap-2 bg-[#10B981] hover:bg-[#047857] text-white px-4 py-2.5 rounded-lg transition-colors"
            style={{ fontSize: "0.875rem", fontWeight: 500 }}
          >
            <Plus className="w-4 h-4" />
            Add QR Code
          </button>
        )}
      </div>

      {/* Save success banner */}
      {saveSuccess && (
        <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl p-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
          <p className="text-[#047857]" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
            Changes saved successfully!
          </p>
        </div>
      )}

      {/* Save error banner */}
      {saveError && !isEditOrAdd && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-red-600" style={{ fontSize: "0.875rem" }}>{saveError}</p>
        </div>
      )}

      {/* Pro upgrade prompt for non-pro users who have 1 QR code */}
      {profile?.plan !== "pro" && qrCodes.length >= 1 && !isEditOrAdd && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Crown className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-[#111827]" style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                Upgrade to Pro for up to 5 QR codes
              </p>
              <p className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>
                Perfect for businesses with multiple locations
              </p>
            </div>
          </div>
          <span className="bg-blue-600 text-white px-4 py-2 rounded-lg" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
            $15/mo
          </span>
        </div>
      )}

      {/* QR Code Tabs */}
      {qrCodes.length > 1 && !isEditOrAdd && (
        <div className="flex gap-2 flex-wrap">
          {qrCodes.map((qr, idx) => (
            <button
              key={qr.id}
              onClick={() => setActiveIdx(idx)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeIdx === idx
                  ? "bg-[#10B981] text-white shadow-md"
                  : "bg-white border border-gray-200 text-[#6B7280] hover:border-[#10B981] hover:text-[#111827]"
              }`}
              style={{ fontSize: "0.875rem", fontWeight: activeIdx === idx ? 600 : 400 }}
            >
              {qr.logoUrl && (
                <img
                  src={qr.logoUrl}
                  alt=""
                  className="w-5 h-5 rounded object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              {qr.businessName || `QR Code ${idx + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {qrCodes.length === 0 && !isAdding && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-[#10B981]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-[#10B981]" />
          </div>
          <h3 className="text-[#111827] mb-2" style={{ fontWeight: 600 }}>
            No QR codes yet
          </h3>
          <p className="text-[#6B7280] mb-6" style={{ fontSize: "0.875rem" }}>
            Search for your business on Google to create your first QR code
          </p>
          <button
            onClick={startAdd}
            className="inline-flex items-center gap-2 bg-[#10B981] hover:bg-[#047857] text-white px-6 py-2.5 rounded-lg transition-colors"
            style={{ fontWeight: 500 }}
          >
            <Plus className="w-4 h-4" />
            Create Your First QR Code
          </button>
        </div>
      )}

      {/* Add/Edit Form */}
      {isEditOrAdd && (
        <div className="bg-white rounded-xl border-2 border-[#10B981]/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#111827]" style={{ fontWeight: 600 }}>
              {isAdding ? "Add New QR Code" : "Edit QR Code"}
            </h3>
            <button
              onClick={cancelEdit}
              className="text-[#6B7280] hover:text-[#111827] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-5">
            {/* Business Name */}
            <div>
              <label className="block text-[#111827] mb-1.5" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                Business Name
              </label>
              <div className="relative" ref={suggestionsRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={editBusinessName}
                    onChange={handleSearchChange}
                    placeholder="Search for your business on Google..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg bg-white focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 outline-none transition-all"
                    autoFocus
                  />
                </div>
                {showSuggestions && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                    {loadingSuggestions ? (
                      <div className="p-4 flex items-center justify-center gap-2 text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span style={{ fontSize: "0.875rem" }}>Searching...</span>
                      </div>
                    ) : placesError ? (
                      <div className="p-4 flex items-start gap-2 text-red-500">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span style={{ fontSize: "0.8rem" }}>{placesError}</span>
                      </div>
                    ) : suggestions.length > 0 ? (
                      suggestions.map((suggestion) => (
                        <button
                          key={suggestion.placeId}
                          type="button"
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                          onClick={() => handleSuggestionClick(suggestion)}
                        >
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[#111827] font-medium" style={{ fontSize: "0.875rem" }}>
                                {suggestion.name}
                              </p>
                              <p className="text-[#6B7280] truncate" style={{ fontSize: "0.75rem" }}>
                                {suggestion.address}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-gray-500" style={{ fontSize: "0.875rem" }}>
                        No results found.
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="text-[#6B7280] mt-1.5" style={{ fontSize: "0.75rem" }}>
                Type your business name to search Google Places
              </p>
            </div>

            {/* Google Review Link */}
            <div>
              <label className="block text-[#111827] mb-1.5" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                Google Review Link{" "}
                <span className="text-[#6B7280] font-normal">(auto-filled or enter manually)</span>
              </label>
              <input
                type="url"
                value={editReviewLink}
                onChange={(e) => setEditReviewLink(e.target.value)}
                placeholder="https://search.google.com/local/writereview?placeid=..."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 outline-none transition-all"
              />
            </div>

            {/* ── Brand Customization Section ── */}
            <div className="border-t border-gray-100 pt-5">
              <div className="flex items-center gap-2 mb-4">
                <Palette className="w-4 h-4 text-[#10B981]" />
                <h4 className="text-[#111827]" style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                  Brand Customization
                </h4>
                <span className="bg-[#10B981]/10 text-[#047857] px-2 py-0.5 rounded-full" style={{ fontSize: "0.625rem", fontWeight: 600 }}>
                  OPTIONAL
                </span>
              </div>

              {/* Website URL + Auto Sync */}
              <div className="bg-gradient-to-r from-blue-50/50 to-purple-50/50 rounded-xl p-4 border border-blue-100/60 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wand2 className="w-4 h-4 text-blue-600" />
                  <p className="text-[#111827]" style={{ fontWeight: 600, fontSize: "0.825rem" }}>
                    Auto-sync from your website
                  </p>
                </div>
                <p className="text-[#6B7280] mb-3" style={{ fontSize: "0.75rem" }}>
                  Enter your website URL and we'll automatically fetch your logo and brand colors using AI.
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="url"
                      value={editWebsiteUrl}
                      onChange={(e) => setEditWebsiteUrl(e.target.value)}
                      placeholder="www.yourbusiness.com"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      style={{ fontSize: "0.875rem" }}
                    />
                  </div>
                  <button
                    onClick={handleSyncBrand}
                    disabled={syncingBrand || !editWebsiteUrl.trim()}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap"
                    style={{ fontSize: "0.825rem", fontWeight: 600 }}
                  >
                    {syncingBrand ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wand2 className="w-4 h-4" />
                    )}
                    {syncingBrand ? "Syncing..." : "Sync Brand"}
                  </button>
                </div>
                {syncError && (
                  <div className="mt-2 flex items-center gap-1.5 text-red-500" style={{ fontSize: "0.75rem" }}>
                    <AlertCircle className="w-3.5 h-3.5" />
                    {syncError}
                  </div>
                )}
                {syncSuccess && (
                  <div className="mt-2 flex items-center gap-1.5 text-[#10B981]" style={{ fontSize: "0.75rem", fontWeight: 500 }}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Brand synced! Logo and color updated.
                  </div>
                )}
              </div>

              {/* Logo URL + Preview */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-[#111827] mb-1.5" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                    <ImageIcon className="w-3.5 h-3.5" />
                    Logo URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={logoInputUrl}
                      onChange={(e) => setLogoInputUrl(e.target.value)}
                      placeholder="https://yourdomain.com/logo.png"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-white focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 outline-none transition-all"
                      style={{ fontSize: "0.825rem" }}
                    />
                    <button
                      onClick={handleSetLogoUrl}
                      disabled={!logoInputUrl.trim()}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg text-[#111827] transition-colors"
                      style={{ fontSize: "0.75rem", fontWeight: 500 }}
                    >
                      Set
                    </button>
                  </div>
                  {editLogoUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <img
                        src={editLogoUrl}
                        alt="Logo preview"
                        className="w-10 h-10 rounded-lg border border-gray-200 object-contain bg-white p-1"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <button
                        onClick={() => { setEditLogoUrl(""); setLogoInputUrl(""); }}
                        className="text-red-400 hover:text-red-500 transition-colors"
                        style={{ fontSize: "0.75rem" }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-[#111827] mb-1.5" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                    <Palette className="w-3.5 h-3.5" />
                    Brand Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editBrandColor || "#10B981"}
                      onChange={(e) => setEditBrandColor(e.target.value)}
                      className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={editBrandColor}
                      onChange={(e) => setEditBrandColor(e.target.value)}
                      placeholder="#10B981"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-white focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 outline-none transition-all"
                      style={{ fontSize: "0.825rem" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {saveError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-red-600" style={{ fontSize: "0.8rem" }}>{saveError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#047857] disabled:opacity-50 text-white py-2.5 rounded-lg transition-colors"
                style={{ fontWeight: 500 }}
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? "Saving..." : isAdding ? "Create QR Code" : "Save Changes"}
              </button>
              <button
                onClick={cancelEdit}
                className="px-6 py-2.5 border border-gray-200 text-[#6B7280] rounded-lg hover:bg-gray-50 transition-colors"
                style={{ fontWeight: 500 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content — only show when not editing/adding and have QR codes */}
      {!isEditOrAdd && qrCodes.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* QR Code Display Card — Branded */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {/* Card Header with brand color */}
            <div
              className="px-6 py-4 flex items-center gap-3"
              style={{ backgroundColor: activeQR?.brandColor || "#10B981" }}
            >
              {activeQR?.logoUrl && (
                <img
                  src={activeQR.logoUrl}
                  alt="Logo"
                  className="w-10 h-10 rounded-lg object-contain bg-white p-1 shadow-sm"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div className="min-w-0">
                <h3 className="text-white truncate" style={{ fontWeight: 700 }}>
                  {activeQR?.businessName || "Your Business"}
                </h3>
                <p className="text-white/80" style={{ fontSize: "0.75rem" }}>
                  Scan to leave a Google Review
                </p>
              </div>
            </div>

            {/* QR Code Body */}
            <div className="p-6 text-center">
              {scanUrl ? (
                <div
                  ref={qrRef}
                  className="inline-block p-4 bg-white rounded-2xl shadow-inner mb-4"
                  style={{ border: `2px solid ${(activeQR?.brandColor || "#10B981")}22` }}
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
                <div className="inline-flex flex-col items-center justify-center w-[260px] h-[260px] bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300 mb-4 px-4">
                  <AlertCircle className="w-8 h-8 text-[#F59E0B] mb-2" />
                  <p className="text-[#111827]" style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                    No review link set
                  </p>
                  <p className="text-[#6B7280] text-center" style={{ fontSize: "0.75rem" }}>
                    Edit this QR code to set a Google review link
                  </p>
                </div>
              )}
              <p className="text-[#6B7280] mb-4" style={{ fontSize: "0.75rem" }}>
                This QR code links directly to your Google review page
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <div className="relative" ref={downloadMenuRef}>
                  <button
                    onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                    disabled={!scanUrl}
                    className="flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#047857] disabled:opacity-50 text-white px-6 py-2.5 rounded-lg transition-colors w-full"
                  >
                    <Download className="w-4 h-4" />
                    Download PNG
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDownloadMenu ? "rotate-180" : ""}`} />
                  </button>
                  {showDownloadMenu && (
                    <div className="absolute left-1/2 -translate-x-1/2 w-60 bottom-full mb-2 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                      <button
                        onClick={handleDownload}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="w-8 h-8 bg-[#10B981]/10 rounded-lg flex items-center justify-center shrink-0">
                          <QrCode className="w-4 h-4 text-[#10B981]" />
                        </div>
                        <div>
                          <p className="text-[#111827]" style={{ fontSize: "0.825rem", fontWeight: 600 }}>
                            QR Code Only
                          </p>
                          <p className="text-[#9CA3AF]" style={{ fontSize: "0.7rem" }}>
                            Clean QR code image
                          </p>
                        </div>
                      </button>
                      <div className="border-t border-gray-100" />
                      <button
                        onClick={handleDownloadCard}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="w-8 h-8 bg-[#F59E0B]/10 rounded-lg flex items-center justify-center shrink-0">
                          <ImageIcon className="w-4 h-4 text-[#F59E0B]" />
                        </div>
                        <div>
                          <p className="text-[#111827]" style={{ fontSize: "0.825rem", fontWeight: 600 }}>
                            Full Card Design
                          </p>
                          <p className="text-[#9CA3AF]" style={{ fontSize: "0.7rem" }}>
                            Branded card with text
                          </p>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowPrintEditor(true)}
                  disabled={!scanUrl}
                  className="flex items-center justify-center gap-2 bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 text-white px-6 py-2.5 rounded-lg transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Edit & Print Card
                </button>
              </div>
            </div>
          </div>

          {/* QR Code Details */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[#111827]" style={{ fontWeight: 600 }}>
                  Business Details
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(activeIdx)}
                    className="text-[#10B981] hover:text-[#047857] flex items-center gap-1"
                    style={{ fontSize: "0.875rem", fontWeight: 500 }}
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                  {qrCodes.length > 1 && (
                    <>
                      {deleteConfirm === activeIdx ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(activeIdx)}
                            disabled={saving}
                            className="text-red-500 hover:text-red-600 flex items-center gap-1"
                            style={{ fontSize: "0.75rem", fontWeight: 500 }}
                          >
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="text-[#6B7280] hover:text-[#111827]"
                            style={{ fontSize: "0.75rem" }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(activeIdx)}
                          className="text-red-400 hover:text-red-500 transition-colors"
                          title="Delete this QR code"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[#111827] mb-1.5" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                    Business Name
                  </label>
                  <p className="text-[#111827] px-4 py-2.5 bg-gray-50 rounded-lg">
                    {activeQR?.businessName || "Not set"}
                  </p>
                </div>
                <div>
                  <label className="block text-[#111827] mb-1.5" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                    Google Review Link
                  </label>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-[#6B7280] px-4 py-2.5 bg-gray-50 rounded-lg truncate" style={{ fontSize: "0.875rem" }}>
                      {activeQR?.reviewLink || "Not set"}
                    </p>
                    {activeQR?.reviewLink && (
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
                    )}
                  </div>
                </div>

                {/* Brand info row */}
                {(activeQR?.logoUrl || activeQR?.brandColor || activeQR?.websiteUrl) && (
                  <div className="border-t border-gray-100 pt-4">
                    <label className="block text-[#111827] mb-2" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                      Brand
                    </label>
                    <div className="flex items-center gap-3 flex-wrap">
                      {activeQR?.logoUrl && (
                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg">
                          <img
                            src={activeQR.logoUrl}
                            alt="Logo"
                            className="w-6 h-6 rounded object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          <span className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>Logo</span>
                        </div>
                      )}
                      {activeQR?.brandColor && (
                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg">
                          <div
                            className="w-5 h-5 rounded border border-gray-200"
                            style={{ backgroundColor: activeQR.brandColor }}
                          />
                          <span className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>{activeQR.brandColor}</span>
                        </div>
                      )}
                      {activeQR?.websiteUrl && (
                        <a
                          href={activeQR.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                          style={{ fontSize: "0.75rem" }}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Website
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tips / Plan info card */}
            <div className="bg-[#10B981]/5 rounded-xl border border-[#10B981]/20 p-6">
              <h3 className="text-[#047857] mb-3" style={{ fontWeight: 600 }}>
                {profile?.plan === "pro" ? "Pro Plan Features" : "Tips for More Reviews"}
              </h3>
              {profile?.plan === "pro" ? (
                <ul className="space-y-2 text-[#047857]" style={{ fontSize: "0.875rem" }}>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 shrink-0" />
                    Up to 5 QR codes for multiple locations
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 shrink-0" />
                    Custom branding with logo and colors
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 shrink-0" />
                    AI-powered website brand sync
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 shrink-0" />
                    Professional print-ready cards
                  </li>
                </ul>
              ) : (
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
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Code Add-On — Buy Extra Slots */}
      {!isEditOrAdd && qrCodes.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-[#F59E0B]/30 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-[#F59E0B]/20 to-[#F59E0B]/10 rounded-xl flex items-center justify-center shrink-0">
                <Plus className="w-6 h-6 text-[#F59E0B]" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-[#111827]" style={{ fontWeight: 700 }}>
                    Extra QR Code Add-On
                  </h3>
                  <span
                    className="bg-[#F59E0B] text-white px-2 py-0.5 rounded-full"
                    style={{ fontSize: "0.625rem", fontWeight: 700 }}
                  >
                    ADD-ON
                  </span>
                </div>
                <p className="text-[#6B7280]" style={{ fontSize: "0.875rem" }}>
                  Need more QR codes? Buy additional slots at <strong className="text-[#111827]">$5 per QR code</strong>. Deducted from your account balance.
                </p>
                {extraSlots > 0 && (
                  <p className="text-[#10B981] mt-1" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                    You have {extraSlots} add-on slot{extraSlots > 1 ? "s" : ""} purchased
                  </p>
                )}
                <p className="text-[#6B7280] mt-1" style={{ fontSize: "0.75rem" }}>
                  Current balance: <strong className="text-[#111827]">${(profile?.balance ?? 0).toFixed(2)}</strong>
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="text-right mb-1">
                <p className="text-[#111827]" style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                  $5
                </p>
                <p className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>
                  per QR code
                </p>
              </div>
              <button
                onClick={handlePurchaseSlot}
                disabled={purchasing || (profile?.balance ?? 0) < 5}
                className="flex items-center gap-2 bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap"
                style={{ fontWeight: 600, fontSize: "0.875rem" }}
              >
                {purchasing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {purchasing ? "Purchasing..." : "Buy Extra QR Slot"}
              </button>
              {(profile?.balance ?? 0) < 5 && !purchasing && (
                <p className="text-red-500" style={{ fontSize: "0.7rem" }}>
                  Insufficient balance — top up first
                </p>
              )}
            </div>
          </div>

          {/* Purchase success */}
          {purchaseSuccess && (
            <div className="mt-4 bg-[#10B981]/10 border border-[#10B981]/30 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
              <p className="text-[#047857]" style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                Extra QR slot purchased! You can now add another QR code.
              </p>
            </div>
          )}

          {/* Purchase error */}
          {purchaseError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-red-600" style={{ fontSize: "0.875rem" }}>{purchaseError}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}