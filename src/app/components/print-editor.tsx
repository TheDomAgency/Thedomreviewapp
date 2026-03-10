import { useState, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Printer, Download, Type, RotateCcw, Eye, FileText, QrCode, Image as LucideImage, ChevronDown, FileDown } from "lucide-react";
import type { QRCodeEntry } from "./auth-context";
import { useAuth } from "./auth-context";
import { jsPDF } from "jspdf";

interface PrintEditorProps {
  qrEntry: QRCodeEntry;
  onClose: () => void;
}

// ── Page size definitions ──
// printWidth = card width in CSS px for the actual print output
// All other dimensions scale from this base
interface PageSizeConfig {
  label: string;
  desc: string;
  printWidth: number;   // card width in print (px)
  qrSize: number;       // QR code px
  headerPx: number;     // header padding vertical
  headerFont: number;   // header title font size (px)
  logoSize: number;     // logo width/height (px)
  bodyPx: number;       // body padding
  ctaFont: number;      // CTA font size (px)
  subFont: number;      // subtitle font size (px)
  footerFont: number;   // footer font size (px)
  qrPad: number;        // QR wrapper padding
  radius: number;       // border-radius
  border: number;       // border width
}

const PAGE_SIZES: Record<string, PageSizeConfig> = {
  "business-card": {
    label: "Business Card",
    desc: "3.5 × 2 in",
    printWidth: 336,
    qrSize: 100,
    headerPx: 10,
    headerFont: 13,
    logoSize: 24,
    bodyPx: 12,
    ctaFont: 11,
    subFont: 8,
    footerFont: 7,
    qrPad: 6,
    radius: 12,
    border: 2,
  },
  "a7": {
    label: "A7",
    desc: "74 × 105 mm",
    printWidth: 280,
    qrSize: 120,
    headerPx: 14,
    headerFont: 14,
    logoSize: 28,
    bodyPx: 16,
    ctaFont: 12,
    subFont: 9,
    footerFont: 8,
    qrPad: 8,
    radius: 14,
    border: 2,
  },
  "table-tent": {
    label: "Table Tent",
    desc: "4 × 6 in",
    printWidth: 384,
    qrSize: 180,
    headerPx: 20,
    headerFont: 18,
    logoSize: 40,
    bodyPx: 24,
    ctaFont: 16,
    subFont: 12,
    footerFont: 10,
    qrPad: 12,
    radius: 20,
    border: 3,
  },
  "a6": {
    label: "A6",
    desc: "105 × 148 mm",
    printWidth: 396,
    qrSize: 200,
    headerPx: 22,
    headerFont: 19,
    logoSize: 44,
    bodyPx: 28,
    ctaFont: 17,
    subFont: 12,
    footerFont: 10,
    qrPad: 14,
    radius: 22,
    border: 3,
  },
  "a5": {
    label: "A5",
    desc: "148 × 210 mm",
    printWidth: 560,
    qrSize: 280,
    headerPx: 28,
    headerFont: 24,
    logoSize: 56,
    bodyPx: 36,
    ctaFont: 22,
    subFont: 15,
    footerFont: 13,
    qrPad: 18,
    radius: 28,
    border: 3,
  },
  "a4": {
    label: "A4",
    desc: "210 × 297 mm",
    printWidth: 680,
    qrSize: 340,
    headerPx: 36,
    headerFont: 30,
    logoSize: 64,
    bodyPx: 48,
    ctaFont: 26,
    subFont: 18,
    footerFont: 15,
    qrPad: 22,
    radius: 32,
    border: 4,
  },
  "letter": {
    label: "US Letter",
    desc: '8.5 × 11 in',
    printWidth: 700,
    qrSize: 350,
    headerPx: 38,
    headerFont: 32,
    logoSize: 68,
    bodyPx: 50,
    ctaFont: 28,
    subFont: 19,
    footerFont: 16,
    qrPad: 24,
    radius: 32,
    border: 4,
  },
};

// PDF page dimensions in mm for jsPDF
const PDF_DIMS: Record<string, { w: number; h: number; orientation: "p" | "l" }> = {
  "business-card": { w: 88.9, h: 50.8, orientation: "l" },
  "a7": { w: 74, h: 105, orientation: "p" },
  "table-tent": { w: 101.6, h: 152.4, orientation: "p" },
  "a6": { w: 105, h: 148, orientation: "p" },
  "a5": { w: 148, h: 210, orientation: "p" },
  "a4": { w: 210, h: 297, orientation: "p" },
  "letter": { w: 215.9, h: 279.4, orientation: "p" },
};

const SIZE_ORDER = ["business-card", "a7", "table-tent", "a6", "a5", "a4", "letter"];

// Preview scaling: we want the card to fit nicely in the preview panel (~400px wide max)
function getPreviewScale(cfg: PageSizeConfig): number {
  const maxPreviewWidth = 380;
  if (cfg.printWidth <= maxPreviewWidth) return 1;
  return maxPreviewWidth / cfg.printWidth;
}

export function PrintEditor({ qrEntry, onClose }: PrintEditorProps) {
  const { updateProfile, profile } = useAuth();
  const qrRef = useRef<HTMLDivElement>(null);

  // Editable fields with defaults
  const [headerTitle, setHeaderTitle] = useState(
    qrEntry.printHeaderTitle || qrEntry.businessName || ""
  );
  const [ctaText, setCtaText] = useState(
    qrEntry.printCta || "Scan to leave us a review!"
  );
  const [subtitleText, setSubtitleText] = useState(
    qrEntry.printSubtitle || "We'd love to hear about your experience"
  );
  const [footerText, setFooterText] = useState(
    qrEntry.printFooter || qrEntry.businessName || ""
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pageSize, setPageSize] = useState("table-tent");

  const brandColor = qrEntry.brandColor || "#10B981";
  const logoUrl = qrEntry.logoUrl || "";
  const reviewLink = qrEntry.reviewLink || "";

  const cfg = PAGE_SIZES[pageSize];
  const previewScale = getPreviewScale(cfg);

  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const changed =
      headerTitle !== (qrEntry.printHeaderTitle || qrEntry.businessName || "") ||
      ctaText !== (qrEntry.printCta || "Scan to leave us a review!") ||
      subtitleText !== (qrEntry.printSubtitle || "We'd love to hear about your experience") ||
      footerText !== (qrEntry.printFooter || qrEntry.businessName || "");
    setHasChanges(changed);
  }, [headerTitle, ctaText, subtitleText, footerText, qrEntry]);

  const handleSave = async () => {
    setSaving(true);
    const qrCodes = profile?.qrCodes || [];
    const updatedList = qrCodes.map((qr) =>
      qr.id === qrEntry.id
        ? {
            ...qr,
            printHeaderTitle: headerTitle.trim() || undefined,
            printCta: ctaText.trim() || undefined,
            printSubtitle: subtitleText.trim() || undefined,
            printFooter: footerText.trim() || undefined,
          }
        : qr
    );
    await updateProfile({ qrCodes: updatedList });
    setSaving(false);
    setSaved(true);
    setHasChanges(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setHeaderTitle(qrEntry.businessName || "");
    setCtaText("Scan to leave us a review!");
    setSubtitleText("We'd love to hear about your experience");
    setFooterText(qrEntry.businessName || "");
  };

  // Build inline CSS for a given config (shared between preview and print)
  const buildCardCSS = (c: PageSizeConfig) => `
    .card {
      width: ${c.printWidth}px;
      border: ${c.border}px solid ${brandColor};
      border-radius: ${c.radius}px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      background: #fff;
    }
    .card-header {
      background: ${brandColor};
      padding: ${c.headerPx}px ${c.headerPx * 1.5}px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: ${Math.round(c.logoSize * 0.3)}px;
    }
    .card-header img {
      width: ${c.logoSize}px;
      height: ${c.logoSize}px;
      border-radius: ${Math.round(c.radius * 0.4)}px;
      object-fit: contain;
      background: white;
      padding: ${Math.max(2, Math.round(c.logoSize * 0.08))}px;
    }
    .card-header h1 {
      color: white;
      font-size: ${c.headerFont}px;
      font-weight: 700;
      text-align: center;
      margin: 0;
    }
    .card-body {
      padding: ${c.bodyPx}px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .qr-wrapper {
      padding: ${c.qrPad}px;
      border: 2px solid ${brandColor}22;
      border-radius: ${Math.round(c.radius * 0.6)}px;
      margin-bottom: ${Math.round(c.bodyPx * 0.6)}px;
      background: #fafafa;
    }
    .cta {
      font-size: ${c.ctaFont}px;
      font-weight: 600;
      color: #111827;
      text-align: center;
      margin: 0 0 ${Math.round(c.subFont * 0.5)}px 0;
    }
    .subtitle {
      font-size: ${c.subFont}px;
      color: #6B7280;
      text-align: center;
      margin: 0;
    }
    .footer {
      background: #f9fafb;
      padding: ${Math.round(c.footerFont * 0.8)}px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer span {
      font-size: ${c.footerFont}px;
      color: #9CA3AF;
      font-weight: 500;
    }
  `;

  const handlePrint = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    // Re-render QR at print size
    const printQrSize = cfg.qrSize;
    const tempDiv = document.createElement("div");
    const tempRoot = document.createElement("div");
    tempDiv.appendChild(tempRoot);
    document.body.appendChild(tempDiv);
    tempDiv.style.position = "absolute";
    tempDiv.style.left = "-9999px";

    // We'll use inline SVG generation for the print QR
    const origSvg = svg.cloneNode(true) as SVGSVGElement;
    origSvg.setAttribute("width", String(printQrSize));
    origSvg.setAttribute("height", String(printQrSize));
    const svgData = new XMLSerializer().serializeToString(origSvg);
    document.body.removeChild(tempDiv);

    const businessName = qrEntry.businessName || "";
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
  ${buildCardCSS(cfg)}
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
  .size-label {
    margin-bottom: 12px;
    font-size: 11px;
    color: #9CA3AF;
    text-align: center;
  }
</style>
</head><body>
<p class="size-label no-print">${cfg.label} (${cfg.desc})</p>
<div class="card">
  <div class="card-header">
    ${logoUrl ? `<img src="${logoUrl}" alt="Logo" onerror="this.style.display='none'" />` : ""}
    <h1>${headerTitle || businessName}</h1>
  </div>
  <div class="card-body">
    <div class="qr-wrapper">${svgData}</div>
    <p class="cta">${ctaText}</p>
    <p class="subtitle">${subtitleText}</p>
  </div>
  <div class="footer">
    <span>${footerText || businessName}</span>
  </div>
</div>
<p class="tip no-print">Tip: In your browser's print dialog, uncheck "Headers and footers" for a cleaner print.</p>
<script>setTimeout(()=>window.print(),400)</script>
</body></html>`);
    printWindow.document.close();
  };

  const handleDownloadPNG = () => {
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
      link.download = `${qrEntry.businessName || "qr-code"}-review.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  // Download the full branded card as PNG using canvas drawing
  const handleDownloadCardPNG = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const c = cfg;
    const scale = 2; // 2x for high-res
    const cardW = c.printWidth * scale;
    const headerH = (c.headerPx * 2 + c.headerFont) * scale;
    const qrTotalSize = (c.qrSize + c.qrPad * 2) * scale;
    const ctaLineH = c.ctaFont * 1.4 * scale;
    const subLineH = c.subFont * 1.4 * scale;
    const bodyH = (c.bodyPx * 2) * scale + qrTotalSize + ctaLineH + subLineH;
    const footerH = (c.footerFont * 2.5) * scale;
    const cardH = headerH + bodyH + footerH;

    const canvas = document.createElement("canvas");
    canvas.width = cardW;
    canvas.height = cardH;
    const ctx = canvas.getContext("2d")!;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cardW, cardH);

    // Header background
    ctx.fillStyle = brandColor;
    ctx.fillRect(0, 0, cardW, headerH);

    // Header text
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${c.headerFont * scale}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      headerTitle || qrEntry.businessName || "Your Business",
      cardW / 2,
      headerH / 2,
      cardW - 40 * scale
    );

    // QR code: convert SVG to image and draw on canvas
    const origSvg = svg.cloneNode(true) as SVGSVGElement;
    origSvg.setAttribute("width", String(c.qrSize * scale));
    origSvg.setAttribute("height", String(c.qrSize * scale));
    const svgData = new XMLSerializer().serializeToString(origSvg);

    const qrImg = new window.Image();
    qrImg.onload = () => {
      // QR wrapper background
      const qrWrapperW = qrTotalSize;
      const qrWrapperH = qrTotalSize;
      const qrWrapperX = (cardW - qrWrapperW) / 2;
      const qrWrapperY = headerH + c.bodyPx * scale;

      ctx.fillStyle = "#fafafa";
      ctx.fillRect(qrWrapperX, qrWrapperY, qrWrapperW, qrWrapperH);

      // QR wrapper border
      ctx.strokeStyle = brandColor + "22";
      ctx.lineWidth = 2 * scale;
      ctx.strokeRect(qrWrapperX, qrWrapperY, qrWrapperW, qrWrapperH);

      // QR image
      ctx.drawImage(
        qrImg,
        qrWrapperX + c.qrPad * scale,
        qrWrapperY + c.qrPad * scale,
        c.qrSize * scale,
        c.qrSize * scale
      );

      // CTA text
      const ctaY = qrWrapperY + qrWrapperH + Math.round(c.bodyPx * 0.6) * scale;
      ctx.fillStyle = "#111827";
      ctx.font = `600 ${c.ctaFont * scale}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(
        ctaText || "Scan to leave us a review!",
        cardW / 2,
        ctaY,
        cardW - 40 * scale
      );

      // Subtitle text
      const subY = ctaY + ctaLineH;
      ctx.fillStyle = "#6B7280";
      ctx.font = `400 ${c.subFont * scale}px Inter, system-ui, sans-serif`;
      ctx.fillText(
        subtitleText || "We'd love to hear about your experience",
        cardW / 2,
        subY,
        cardW - 40 * scale
      );

      // Footer background
      const footerY = cardH - footerH;
      ctx.fillStyle = "#f9fafb";
      ctx.fillRect(0, footerY, cardW, footerH);

      // Footer border line
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.moveTo(0, footerY);
      ctx.lineTo(cardW, footerY);
      ctx.stroke();

      // Footer text
      ctx.fillStyle = "#9CA3AF";
      ctx.font = `500 ${c.footerFont * scale}px Inter, system-ui, sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillText(
        footerText || qrEntry.businessName || "Your Business",
        cardW / 2,
        footerY + footerH / 2,
        cardW - 20 * scale
      );

      // Border around the card
      ctx.strokeStyle = brandColor;
      ctx.lineWidth = c.border * scale;
      ctx.strokeRect(0, 0, cardW, cardH);

      // Download
      const link = document.createElement("a");
      link.download = `${qrEntry.businessName || "qr-code"}-card-${c.label.toLowerCase().replace(/\s+/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    qrImg.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const handleDownloadPDF = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const c = cfg;
    const scale = 3; // 3x for high-res PDF
    const cardW = c.printWidth * scale;
    const headerH = (c.headerPx * 2 + c.headerFont) * scale;
    const qrTotalSize = (c.qrSize + c.qrPad * 2) * scale;
    const ctaLineH = c.ctaFont * 1.4 * scale;
    const subLineH = c.subFont * 1.4 * scale;
    const bodyH = (c.bodyPx * 2) * scale + qrTotalSize + ctaLineH + subLineH;
    const footerH = (c.footerFont * 2.5) * scale;
    const cardH = headerH + bodyH + footerH;

    const canvas = document.createElement("canvas");
    canvas.width = cardW;
    canvas.height = cardH;
    const ctx = canvas.getContext("2d")!;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cardW, cardH);

    // Header background
    ctx.fillStyle = brandColor;
    ctx.fillRect(0, 0, cardW, headerH);

    // Header text
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${c.headerFont * scale}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      headerTitle || qrEntry.businessName || "Your Business",
      cardW / 2,
      headerH / 2,
      cardW - 40 * scale
    );

    // QR code
    const origSvg = svg.cloneNode(true) as SVGSVGElement;
    origSvg.setAttribute("width", String(c.qrSize * scale));
    origSvg.setAttribute("height", String(c.qrSize * scale));
    const svgData = new XMLSerializer().serializeToString(origSvg);

    const qrImg = new window.Image();
    qrImg.onload = () => {
      const qrWrapperW = qrTotalSize;
      const qrWrapperH = qrTotalSize;
      const qrWrapperX = (cardW - qrWrapperW) / 2;
      const qrWrapperY = headerH + c.bodyPx * scale;

      ctx.fillStyle = "#fafafa";
      ctx.fillRect(qrWrapperX, qrWrapperY, qrWrapperW, qrWrapperH);
      ctx.strokeStyle = brandColor + "22";
      ctx.lineWidth = 2 * scale;
      ctx.strokeRect(qrWrapperX, qrWrapperY, qrWrapperW, qrWrapperH);

      ctx.drawImage(
        qrImg,
        qrWrapperX + c.qrPad * scale,
        qrWrapperY + c.qrPad * scale,
        c.qrSize * scale,
        c.qrSize * scale
      );

      // CTA
      const ctaY = qrWrapperY + qrWrapperH + Math.round(c.bodyPx * 0.6) * scale;
      ctx.fillStyle = "#111827";
      ctx.font = `600 ${c.ctaFont * scale}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(ctaText || "Scan to leave us a review!", cardW / 2, ctaY, cardW - 40 * scale);

      // Subtitle
      const subY = ctaY + ctaLineH;
      ctx.fillStyle = "#6B7280";
      ctx.font = `400 ${c.subFont * scale}px Inter, system-ui, sans-serif`;
      ctx.fillText(subtitleText || "We'd love to hear about your experience", cardW / 2, subY, cardW - 40 * scale);

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
      ctx.font = `500 ${c.footerFont * scale}px Inter, system-ui, sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillText(footerText || qrEntry.businessName || "Your Business", cardW / 2, footerY + footerH / 2, cardW - 20 * scale);

      // Card border
      ctx.strokeStyle = brandColor;
      ctx.lineWidth = c.border * scale;
      ctx.strokeRect(0, 0, cardW, cardH);

      // Now create PDF
      const dims = PDF_DIMS[pageSize];
      const pageW = dims.orientation === "l" ? dims.w : dims.w;
      const pageH = dims.orientation === "l" ? dims.h : dims.h;

      const pdf = new jsPDF({
        orientation: dims.orientation,
        unit: "mm",
        format: [pageW, pageH],
      });

      // Calculate image dimensions to fit centered on the page with margin
      const margin = Math.min(pageW, pageH) * 0.05; // 5% margin
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2;
      const imgAspect = cardW / cardH;
      let imgW: number, imgH: number;

      if (availW / availH > imgAspect) {
        imgH = availH;
        imgW = imgH * imgAspect;
      } else {
        imgW = availW;
        imgH = imgW / imgAspect;
      }

      const imgX = (pageW - imgW) / 2;
      const imgY = (pageH - imgH) / 2;

      const imgDataUrl = canvas.toDataURL("image/png", 1.0);
      pdf.addImage(imgDataUrl, "PNG", imgX, imgY, imgW, imgH);
      pdf.save(`${qrEntry.businessName || "qr-code"}-card-${c.label.toLowerCase().replace(/\s+/g, "-")}.pdf`);
    };
    qrImg.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#111827] transition-colors"
          style={{ fontSize: "0.875rem", fontWeight: 500 }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to QR Codes
        </button>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-[#10B981] hover:bg-[#047857] disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
              style={{ fontSize: "0.825rem", fontWeight: 600 }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          )}
          {saved && (
            <span className="text-[#10B981]" style={{ fontSize: "0.825rem", fontWeight: 600 }}>
              Saved
            </span>
          )}
        </div>
      </div>

      <div>
        <h1 className="text-[#111827]" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
          Edit Print Card
        </h1>
        <p className="text-[#6B7280]" style={{ fontSize: "0.875rem" }}>
          Customize text, pick a page size, and see a live preview before printing
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left: Edit Fields */}
        <div className="space-y-5">
          {/* Page Size Selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-[#10B981]" />
              <h3 className="text-[#111827]" style={{ fontWeight: 600, fontSize: "1rem" }}>
                Page Size
              </h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SIZE_ORDER.map((key) => {
                const s = PAGE_SIZES[key];
                const isActive = pageSize === key;
                return (
                  <button
                    key={key}
                    onClick={() => setPageSize(key)}
                    className={`relative px-3 py-2.5 rounded-lg border-2 transition-all text-left ${
                      isActive
                        ? "border-[#10B981] bg-[#10B981]/5 shadow-sm"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <p
                      className={isActive ? "text-[#047857]" : "text-[#111827]"}
                      style={{ fontSize: "0.8rem", fontWeight: 600 }}
                    >
                      {s.label}
                    </p>
                    <p className="text-[#9CA3AF]" style={{ fontSize: "0.65rem" }}>
                      {s.desc}
                    </p>
                    {isActive && (
                      <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#10B981] rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card Text */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Type className="w-5 h-5 text-[#F59E0B]" />
                <h3 className="text-[#111827]" style={{ fontWeight: 600, fontSize: "1rem" }}>
                  Card Text
                </h3>
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-[#6B7280] hover:text-[#111827] transition-colors"
                style={{ fontSize: "0.75rem", fontWeight: 500 }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[#111827] mb-1" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                  Header Title
                </label>
                <input
                  type="text"
                  value={headerTitle}
                  onChange={(e) => setHeaderTitle(e.target.value)}
                  placeholder={qrEntry.businessName || "Your Business Name"}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg bg-white focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 outline-none transition-all"
                  style={{ fontSize: "0.85rem" }}
                />
              </div>
              <div>
                <label className="block text-[#111827] mb-1" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                  Call to Action
                </label>
                <input
                  type="text"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  placeholder="Scan to leave us a review!"
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg bg-white focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 outline-none transition-all"
                  style={{ fontSize: "0.85rem" }}
                />
              </div>
              <div>
                <label className="block text-[#111827] mb-1" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                  Subtitle
                </label>
                <input
                  type="text"
                  value={subtitleText}
                  onChange={(e) => setSubtitleText(e.target.value)}
                  placeholder="We'd love to hear about your experience"
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg bg-white focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 outline-none transition-all"
                  style={{ fontSize: "0.85rem" }}
                />
              </div>
              <div>
                <label className="block text-[#111827] mb-1" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                  Footer Text
                </label>
                <input
                  type="text"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  placeholder={qrEntry.businessName || "Your Business Name"}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg bg-white focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20 outline-none transition-all"
                  style={{ fontSize: "0.85rem" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Live Preview */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#6B7280]" />
              <span className="text-[#6B7280]" style={{ fontSize: "0.825rem", fontWeight: 600 }}>
                LIVE PREVIEW
              </span>
            </div>
            <span className="text-[#9CA3AF] bg-gray-100 px-2.5 py-1 rounded-md" style={{ fontSize: "0.7rem", fontWeight: 500 }}>
              {cfg.label} · {cfg.desc}
            </span>
          </div>

          <div
            className="bg-gray-100 rounded-2xl flex items-center justify-center overflow-hidden"
            style={{ minHeight: 480, padding: 24 }}
          >
            <div
              className="transition-all duration-300"
              style={{
                transform: `scale(${previewScale})`,
                transformOrigin: "center center",
                width: cfg.printWidth,
              }}
            >
              {/* Card preview */}
              <div
                className="bg-white overflow-hidden"
                style={{
                  border: `${cfg.border}px solid ${brandColor}`,
                  borderRadius: cfg.radius,
                  boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
                }}
              >
                {/* Header */}
                <div
                  className="flex items-center justify-center"
                  style={{
                    backgroundColor: brandColor,
                    padding: `${cfg.headerPx}px ${cfg.headerPx * 1.5}px`,
                    gap: Math.round(cfg.logoSize * 0.3),
                  }}
                >
                  {logoUrl && (
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="object-contain bg-white"
                      style={{
                        width: cfg.logoSize,
                        height: cfg.logoSize,
                        borderRadius: Math.round(cfg.radius * 0.4),
                        padding: Math.max(2, Math.round(cfg.logoSize * 0.08)),
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                  <h1
                    className="text-white text-center"
                    style={{ fontSize: cfg.headerFont, fontWeight: 700, margin: 0 }}
                  >
                    {headerTitle || qrEntry.businessName || "Your Business"}
                  </h1>
                </div>

                {/* Body */}
                <div
                  className="flex flex-col items-center"
                  style={{ padding: cfg.bodyPx }}
                >
                  <div
                    ref={qrRef}
                    style={{
                      padding: cfg.qrPad,
                      border: `2px solid ${brandColor}22`,
                      borderRadius: Math.round(cfg.radius * 0.6),
                      backgroundColor: "#fafafa",
                      marginBottom: Math.round(cfg.bodyPx * 0.6),
                    }}
                  >
                    {reviewLink ? (
                      <QRCodeSVG
                        value={reviewLink}
                        size={cfg.qrSize}
                        fgColor="#111827"
                        bgColor="#ffffff"
                        level="H"
                      />
                    ) : (
                      <div
                        className="flex items-center justify-center bg-gray-50"
                        style={{
                          width: cfg.qrSize,
                          height: cfg.qrSize,
                          borderRadius: 8,
                        }}
                      >
                        <span className="text-[#9CA3AF]" style={{ fontSize: "0.75rem" }}>
                          No review link
                        </span>
                      </div>
                    )}
                  </div>
                  <p
                    className="text-[#111827] text-center"
                    style={{
                      fontSize: cfg.ctaFont,
                      fontWeight: 600,
                      margin: `0 0 ${Math.round(cfg.subFont * 0.5)}px 0`,
                    }}
                  >
                    {ctaText || "Scan to leave us a review!"}
                  </p>
                  <p
                    className="text-[#6B7280] text-center"
                    style={{ fontSize: cfg.subFont, margin: 0 }}
                  >
                    {subtitleText || "We'd love to hear about your experience"}
                  </p>
                </div>

                {/* Footer */}
                <div
                  className="text-center"
                  style={{
                    backgroundColor: "#f9fafb",
                    borderTop: "1px solid #e5e7eb",
                    padding: Math.round(cfg.footerFont * 0.8),
                  }}
                >
                  <span
                    className="text-[#9CA3AF]"
                    style={{ fontSize: cfg.footerFont, fontWeight: 500 }}
                  >
                    {footerText || qrEntry.businessName || "Your Business"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons — below preview */}
          <div className="mt-5 space-y-3">
            {/* Download PDF — primary CTA */}
            <button
              onClick={handleDownloadPDF}
              disabled={!reviewLink}
              className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-[#10B981] to-[#047857] hover:from-[#059669] hover:to-[#065F46] disabled:opacity-50 text-white py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg group"
              style={{ fontWeight: 600, fontSize: "0.95rem" }}
            >
              <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center group-hover:bg-white/25 transition-colors">
                <FileDown className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="block leading-tight">Download PDF</span>
                <span className="block text-white/75 leading-tight" style={{ fontSize: "0.7rem", fontWeight: 400 }}>
                  {cfg.label} · {cfg.desc} — print-ready file
                </span>
              </div>
            </button>

            {/* Secondary row: Print + Download PNGs */}
            <div className="flex gap-3">
              {/* Small Print button */}
              <button
                onClick={handlePrint}
                disabled={!reviewLink}
                className="flex items-center justify-center gap-2 border-2 border-gray-200 hover:border-[#10B981] hover:bg-[#10B981]/5 disabled:opacity-50 text-[#111827] hover:text-[#047857] px-4 py-2.5 rounded-xl transition-all"
                style={{ fontSize: "0.8rem", fontWeight: 600 }}
              >
                <Printer className="w-4 h-4" />
                Print
              </button>

              {/* Download PNG options */}
              <div className="flex-1 grid grid-cols-2 gap-2">
                <button
                  onClick={handleDownloadPNG}
                  disabled={!reviewLink}
                  className="flex items-center justify-center gap-1.5 border-2 border-gray-200 hover:border-[#10B981] hover:bg-[#10B981]/5 disabled:opacity-50 text-[#6B7280] hover:text-[#047857] py-2.5 rounded-xl transition-all"
                  style={{ fontSize: "0.7rem", fontWeight: 600 }}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  QR Only
                </button>
                <button
                  onClick={handleDownloadCardPNG}
                  disabled={!reviewLink}
                  className="flex items-center justify-center gap-1.5 border-2 border-gray-200 hover:border-[#F59E0B] hover:bg-[#F59E0B]/5 disabled:opacity-50 text-[#6B7280] hover:text-[#92400E] py-2.5 rounded-xl transition-all"
                  style={{ fontSize: "0.7rem", fontWeight: 600 }}
                >
                  <LucideImage className="w-3.5 h-3.5" />
                  Card PNG
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}