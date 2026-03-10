import { useState, useCallback, useRef, useEffect } from "react";
import {
  MessageCircle,
  Send,
  Plus,
  Clock,
  Copy,
  Check,
  ExternalLink,
  Users,
  Loader2,
  Trash2,
  Upload,
  FileText,
  Headphones,
  DollarSign,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "./auth-context";
import { projectId } from "/utils/supabase/info";

interface Contact {
  phone: string;
  name: string;
}

interface MessageLog {
  id: string;
  phone: string;
  name: string;
  sentAt: string;
  status: "sent" | "pending";
}

const DEFAULT_TEMPLATES = [
  {
    id: "friendly",
    label: "Friendly",
    message:
      "Hi {name}! Thanks for choosing {business}. We'd love to hear about your experience! Could you take a moment to leave us a quick Google review? It really helps us out. {link}",
  },
  {
    id: "short",
    label: "Short & Sweet",
    message:
      "Hi {name}! Enjoyed your visit to {business}? We'd appreciate a quick review! {link}",
  },
  {
    id: "professional",
    label: "Professional",
    message:
      "Dear {name}, thank you for visiting {business}. Your feedback is valuable to us. We would be grateful if you could share your experience by leaving a Google review: {link}",
  },
  {
    id: "followup",
    label: "Follow-up",
    message:
      "Hi {name}, we hope you had a great experience at {business}! If you have a moment, we'd really appreciate a Google review. It helps other customers find us too! {link}",
  },
];

const COST_PER_IMPORT = 0.0001;

export function WhatsAppPage() {
  const { profile, user, apiCall } = useAuth();
  const [activeTab, setActiveTab] = useState<"send" | "import" | "team">(
    "send"
  );
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("friendly");
  const [customMessage, setCustomMessage] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [messageLog, setMessageLog] = useState<MessageLog[]>([]);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  // Bulk import state
  const [importedContacts, setImportedContacts] = useState<Contact[]>([]);
  const [csvText, setCsvText] = useState("");
  const [showImportPreview, setShowImportPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual bulk contacts
  const [manualContacts, setManualContacts] = useState<Contact[]>([
    { phone: "", name: "" },
  ]);

  // Team request state
  const [teamRequestSent, setTeamRequestSent] = useState(false);
  const [teamRequestLoading, setTeamRequestLoading] = useState(false);
  const [teamNotes, setTeamNotes] = useState("");

  // Persisted logs from server
  const [serverLogs, setServerLogs] = useState<MessageLog[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);

  const scanUrl = user?.id
    ? `https://${projectId}.supabase.co/functions/v1/make-server-6cea9865/r/${user.id}`
    : "";
  const businessName = profile?.businessName || "our business";

  // Load past logs from server
  useEffect(() => {
    if (logsLoaded) return;
    (async () => {
      try {
        const res = await apiCall("/whatsapp-logs");
        if (res.ok) {
          const data = await res.json();
          setServerLogs(data.logs || []);
        }
      } catch (err) {
        console.log("Error loading WhatsApp logs:", err);
      }
      setLogsLoaded(true);
    })();
  }, [apiCall, logsLoaded]);

  const allLogs = [...messageLog, ...serverLogs.filter(
    (sl) => !messageLog.some((ml) => ml.id === sl.id)
  )];

  const totalSent = allLogs.length;
  const uniqueCustomers = new Set(allLogs.map((l) => l.phone)).size;

  const getComposedMessage = useCallback(
    (name: string) => {
      const template = useCustom
        ? customMessage
        : DEFAULT_TEMPLATES.find((t) => t.id === selectedTemplate)?.message ||
          "";
      return template
        .replace(/{name}/g, name || "there")
        .replace(/{business}/g, businessName)
        .replace(/{link}/g, scanUrl);
    },
    [useCustom, customMessage, selectedTemplate, businessName, scanUrl]
  );

  const formatPhone = (raw: string) => {
    const cleaned = raw.replace(/[^\d+]/g, "");
    return cleaned.replace(/^\+/, "");
  };

  const handleSendSingle = () => {
    if (!phone.trim()) return;
    const formattedPhone = formatPhone(phone);
    const message = getComposedMessage(customerName);
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;

    const newLog: MessageLog = {
      id: `${Date.now()}`,
      phone: formattedPhone,
      name: customerName || "Unknown",
      sentAt: new Date().toISOString(),
      status: "sent",
    };
    setMessageLog((prev) => [newLog, ...prev]);
    saveMessageLog(newLog);
    window.open(waUrl, "_blank");
    setPhone("");
    setCustomerName("");
  };

  const handleSendBulk = async (contacts: Contact[]) => {
    const validContacts = contacts.filter((c) => c.phone.trim());
    if (validContacts.length === 0) return;

    setSending(true);
    for (let i = 0; i < validContacts.length; i++) {
      const contact = validContacts[i];
      const formattedPhone = formatPhone(contact.phone);
      const message = getComposedMessage(contact.name);
      const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;

      const newLog: MessageLog = {
        id: `${Date.now()}-${i}`,
        phone: formattedPhone,
        name: contact.name || "Unknown",
        sentAt: new Date().toISOString(),
        status: "sent",
      };
      setMessageLog((prev) => [newLog, ...prev]);
      saveMessageLog(newLog);
      window.open(waUrl, "_blank");
      if (i < validContacts.length - 1) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    setSending(false);
  };

  const saveMessageLog = async (log: MessageLog) => {
    try {
      await apiCall("/whatsapp-log", {
        method: "POST",
        body: JSON.stringify(log),
      });
    } catch (err) {
      console.log("Error saving WhatsApp log:", err);
    }
  };

  // CSV parsing
  const parseCSV = (text: string): Contact[] => {
    const lines = text.trim().split("\n");
    const contacts: Contact[] = [];
    for (const line of lines) {
      const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^"|"$/g, ""));
      if (parts.length >= 2) {
        contacts.push({ name: parts[0], phone: parts[1] });
      } else if (parts.length === 1 && parts[0].match(/\d/)) {
        contacts.push({ name: "", phone: parts[0] });
      }
    }
    return contacts.filter((c) => c.phone.length >= 5);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      const parsed = parseCSV(text);
      setImportedContacts(parsed);
      setShowImportPreview(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handlePasteImport = () => {
    const parsed = parseCSV(csvText);
    setImportedContacts(parsed);
    setShowImportPreview(true);
  };

  // Manual bulk contacts
  const addManualContact = () => {
    setManualContacts((prev) => [...prev, { phone: "", name: "" }]);
  };

  const removeManualContact = (index: number) => {
    setManualContacts((prev) => prev.filter((_, i) => i !== index));
  };

  const updateManualContact = (
    index: number,
    field: "phone" | "name",
    value: string
  ) => {
    setManualContacts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(scanUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTeamRequest = async () => {
    setTeamRequestLoading(true);
    try {
      const allContacts = [
        ...importedContacts,
        ...manualContacts.filter((c) => c.phone.trim()),
      ];
      await apiCall("/whatsapp-team-request", {
        method: "POST",
        body: JSON.stringify({
          contacts: allContacts,
          notes: teamNotes,
          template: useCustom
            ? customMessage
            : DEFAULT_TEMPLATES.find((t) => t.id === selectedTemplate)
                ?.message || "",
          businessName,
          reviewLink: scanUrl,
        }),
      });
      setTeamRequestSent(true);
    } catch (err) {
      console.log("Error sending team request:", err);
    }
    setTeamRequestLoading(false);
  };

  const previewMessage = getComposedMessage(customerName || "John");
  const validManualCount = manualContacts.filter(
    (c) => c.phone.trim()
  ).length;
  const totalBulkContacts =
    activeTab === "import" ? importedContacts.length : validManualCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-[#111827]"
          style={{ fontSize: "1.5rem", fontWeight: 700 }}
        >
          WhatsApp Reviews
        </h1>
        <p className="text-[#6B7280]" style={{ fontSize: "0.875rem" }}>
          Send review requests directly to your customers via WhatsApp
        </p>
      </div>

      {/* Pricing Banner */}
      <div className="bg-gradient-to-r from-[#25D366]/10 to-[#25D366]/5 border border-[#25D366]/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#25D366]/15 rounded-lg flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 text-[#25D366]" />
          </div>
          <div>
            <p
              className="text-[#111827]"
              style={{ fontWeight: 600, fontSize: "0.875rem" }}
            >
              WhatsApp Reviews
            </p>
            <p className="text-[#6B7280]" style={{ fontSize: "0.8125rem" }}>
              <span className="text-[#25D366] font-bold">FREE</span> to send messages ·
              Import contacts at <span className="text-[#111827] font-bold">$0.0001</span>/contact
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p
            className="text-[#111827]"
            style={{ fontSize: "1.125rem", fontWeight: 700 }}
          >
            {totalSent}
          </p>
          <p className="text-[#6B7280]" style={{ fontSize: "0.6875rem" }}>
            messages sent
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-[#25D366]" />
            </div>
            <div>
              <p
                className="text-[#111827]"
                style={{ fontSize: "1.5rem", fontWeight: 700 }}
              >
                {totalSent}
              </p>
              <p className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>
                Total Sent
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-[#10B981]" />
            </div>
            <div>
              <p
                className="text-[#111827]"
                style={{ fontSize: "1.5rem", fontWeight: 700 }}
              >
                {uniqueCustomers}
              </p>
              <p className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>
                Unique Customers
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p
              className="text-[#111827] mb-1"
              style={{ fontSize: "0.875rem", fontWeight: 600 }}
            >
              Your Review Link
            </p>
            <p
              className="text-[#6B7280] truncate"
              style={{ fontSize: "0.75rem" }}
            >
              {scanUrl || "Not available"}
            </p>
          </div>
          <button
            onClick={handleCopyLink}
            className="shrink-0 p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {copied ? (
              <Check className="w-4 h-4 text-[#10B981]" />
            ) : (
              <Copy className="w-4 h-4 text-[#6B7280]" />
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Tabs */}
        <div className="space-y-6">
          {/* Tab Selector */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex border-b border-gray-100">
              {[
                { id: "send" as const, label: "Send Messages", icon: Send },
                {
                  id: "import" as const,
                  label: "Bulk Import",
                  icon: Upload,
                },
                {
                  id: "team" as const,
                  label: "Request Our Team",
                  icon: Headphones,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? "border-[#25D366] text-[#25D366] bg-[#25D366]/5"
                      : "border-transparent text-[#6B7280] hover:text-[#111827] hover:bg-gray-50"
                  }`}
                  style={{ fontSize: "0.8125rem", fontWeight: 500 }}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* Send Tab */}
              {activeTab === "send" && (
                <div className="space-y-5">
                  <div>
                    <h3
                      className="text-[#111827] mb-4"
                      style={{ fontWeight: 600 }}
                    >
                      Send Review Request
                    </h3>
                  </div>

                  {/* Single send */}
                  <div className="space-y-4">
                    <div>
                      <label
                        className="block text-[#111827] mb-1.5"
                        style={{ fontSize: "0.875rem", fontWeight: 500 }}
                      >
                        Customer Name{" "}
                        <span className="text-[#6B7280] font-normal">
                          (optional)
                        </span>
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g. John Smith"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label
                        className="block text-[#111827] mb-1.5"
                        style={{ fontSize: "0.875rem", fontWeight: 500 }}
                      >
                        Phone Number{" "}
                        <span className="text-[#6B7280] font-normal">
                          (with country code)
                        </span>
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. +1 555 123 4567"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 outline-none transition-all"
                      />
                    </div>
                    <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5">
                      <span
                        className="text-[#6B7280]"
                        style={{ fontSize: "0.8125rem" }}
                      >
                        Cost for this message
                      </span>
                      <span
                        className="text-[#25D366]"
                        style={{ fontWeight: 600 }}
                      >
                        FREE
                      </span>
                    </div>
                    <button
                      onClick={handleSendSingle}
                      disabled={!phone.trim() || !scanUrl}
                      className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1DA851] disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg transition-colors"
                      style={{ fontWeight: 600 }}
                    >
                      <Send className="w-4 h-4" />
                      Send via WhatsApp — Free
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200" />
                    </div>
                    <div className="relative flex justify-center">
                      <span
                        className="bg-white px-3 text-[#6B7280]"
                        style={{ fontSize: "0.75rem" }}
                      >
                        OR ADD MULTIPLE
                      </span>
                    </div>
                  </div>

                  {/* Manual bulk */}
                  <div className="space-y-3">
                    <div className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
                      {manualContacts.map((contact, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={contact.name}
                              onChange={(e) =>
                                updateManualContact(
                                  idx,
                                  "name",
                                  e.target.value
                                )
                              }
                              placeholder="Name"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 outline-none transition-all"
                              style={{ fontSize: "0.875rem" }}
                            />
                            <input
                              type="tel"
                              value={contact.phone}
                              onChange={(e) =>
                                updateManualContact(
                                  idx,
                                  "phone",
                                  e.target.value
                                )
                              }
                              placeholder="+1 555 123 4567"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 outline-none transition-all"
                              style={{ fontSize: "0.875rem" }}
                            />
                          </div>
                          {manualContacts.length > 1 && (
                            <button
                              onClick={() => removeManualContact(idx)}
                              className="shrink-0 p-2 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={addManualContact}
                      className="flex items-center gap-1.5 text-[#25D366] hover:text-[#1DA851] transition-colors"
                      style={{ fontSize: "0.875rem", fontWeight: 500 }}
                    >
                      <Plus className="w-4 h-4" />
                      Add another contact
                    </button>
                    {validManualCount > 0 && (
                      <>
                        <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5">
                          <span
                            className="text-[#6B7280]"
                            style={{ fontSize: "0.8125rem" }}
                          >
                            Cost for {validManualCount} message
                            {validManualCount !== 1 ? "s" : ""}
                          </span>
                          <span
                            className="text-[#25D366]"
                            style={{ fontWeight: 600 }}
                          >
                            FREE
                          </span>
                        </div>
                        <button
                          onClick={() => handleSendBulk(manualContacts)}
                          disabled={sending || !scanUrl}
                          className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1DA851] disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg transition-colors"
                          style={{ fontWeight: 600 }}
                        >
                          {sending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                          Send to {validManualCount} Contact
                          {validManualCount !== 1 ? "s" : ""} — Free
                        </button>
                      </>
                    )}
                    <p
                      className="text-[#6B7280] text-center"
                      style={{ fontSize: "0.75rem" }}
                    >
                      Each contact opens a WhatsApp tab for you to confirm &
                      send
                    </p>
                  </div>
                </div>
              )}

              {/* Import Tab */}
              {activeTab === "import" && (
                <div className="space-y-5">
                  <div>
                    <h3
                      className="text-[#111827] mb-1"
                      style={{ fontWeight: 600 }}
                    >
                      Bulk Import Contacts
                    </h3>
                    <p
                      className="text-[#6B7280]"
                      style={{ fontSize: "0.8125rem" }}
                    >
                      Upload a CSV file or paste your customer list
                    </p>
                  </div>

                  {/* Upload CSV */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 hover:border-[#25D366] rounded-xl p-8 text-center cursor-pointer transition-colors group"
                  >
                    <Upload className="w-8 h-8 text-gray-300 group-hover:text-[#25D366] mx-auto mb-3 transition-colors" />
                    <p
                      className="text-[#111827] mb-1"
                      style={{ fontWeight: 500, fontSize: "0.875rem" }}
                    >
                      Upload CSV File
                    </p>
                    <p
                      className="text-[#6B7280]"
                      style={{ fontSize: "0.75rem" }}
                    >
                      Format: Name, Phone (one per line)
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>

                  {/* Or paste */}
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200" />
                    </div>
                    <div className="relative flex justify-center">
                      <span
                        className="bg-white px-3 text-[#6B7280]"
                        style={{ fontSize: "0.75rem" }}
                      >
                        OR PASTE BELOW
                      </span>
                    </div>
                  </div>

                  <div>
                    <textarea
                      value={csvText}
                      onChange={(e) => setCsvText(e.target.value)}
                      rows={5}
                      placeholder={`John Smith, +1 555 123 4567\nJane Doe, +1 555 987 6543\nMike Johnson, +44 20 7946 0958`}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 outline-none transition-all resize-none font-mono"
                      style={{ fontSize: "0.8125rem" }}
                    />
                    <button
                      onClick={handlePasteImport}
                      disabled={!csvText.trim()}
                      className="mt-2 flex items-center gap-2 text-[#25D366] hover:text-[#1DA851] disabled:opacity-50 transition-colors"
                      style={{ fontSize: "0.875rem", fontWeight: 500 }}
                    >
                      <FileText className="w-4 h-4" />
                      Parse contacts
                    </button>
                  </div>

                  {/* Import Preview */}
                  {showImportPreview && importedContacts.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p
                          className="text-[#111827]"
                          style={{ fontWeight: 600, fontSize: "0.875rem" }}
                        >
                          {importedContacts.length} contacts found
                        </p>
                        <button
                          onClick={() => {
                            setImportedContacts([]);
                            setShowImportPreview(false);
                            setCsvText("");
                          }}
                          className="text-[#6B7280] hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="max-h-[160px] overflow-y-auto space-y-1.5">
                        {importedContacts.slice(0, 20).map((c, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between bg-white rounded-lg px-3 py-2"
                          >
                            <span
                              className="text-[#111827]"
                              style={{ fontSize: "0.8125rem" }}
                            >
                              {c.name || "No name"}
                            </span>
                            <span
                              className="text-[#6B7280]"
                              style={{ fontSize: "0.8125rem" }}
                            >
                              {c.phone}
                            </span>
                          </div>
                        ))}
                        {importedContacts.length > 20 && (
                          <p
                            className="text-center text-[#6B7280]"
                            style={{ fontSize: "0.75rem" }}
                          >
                            + {importedContacts.length - 20} more contacts
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5">
                        <span
                          className="text-[#6B7280]"
                          style={{ fontSize: "0.8125rem" }}
                        >
                          Import cost ({importedContacts.length} contacts)
                        </span>
                        <span
                          className="text-[#111827]"
                          style={{ fontWeight: 700 }}
                        >
                          $
                          {(importedContacts.length * COST_PER_IMPORT).toFixed(
                            4
                          )}
                        </span>
                      </div>
                      <button
                        onClick={() => handleSendBulk(importedContacts)}
                        disabled={sending || !scanUrl}
                        className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1DA851] disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg transition-colors"
                        style={{ fontWeight: 600 }}
                      >
                        {sending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Import & Send to {importedContacts.length} Contacts · $
                        {(importedContacts.length * COST_PER_IMPORT).toFixed(
                          4
                        )}
                      </button>
                    </div>
                  )}

                  {showImportPreview && importedContacts.length === 0 && (
                    <div className="flex items-center gap-2 text-[#F59E0B] bg-[#F59E0B]/10 rounded-lg px-4 py-3">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <p style={{ fontSize: "0.8125rem" }}>
                        No valid contacts found. Make sure each line has a name
                        and phone number separated by a comma.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Team Tab */}
              {activeTab === "team" && (
                <div className="space-y-5">
                  <div>
                    <h3
                      className="text-[#111827] mb-1"
                      style={{ fontWeight: 600 }}
                    >
                      Let Our Team Handle It
                    </h3>
                    <p
                      className="text-[#6B7280]"
                      style={{ fontSize: "0.8125rem" }}
                    >
                      Don't have time? We'll send the review requests for you.
                    </p>
                  </div>

                  {teamRequestSent ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-[#25D366]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="w-8 h-8 text-[#25D366]" />
                      </div>
                      <h4
                        className="text-[#111827] mb-2"
                        style={{ fontWeight: 600, fontSize: "1.125rem" }}
                      >
                        Request Submitted!
                      </h4>
                      <p
                        className="text-[#6B7280] max-w-sm mx-auto mb-4"
                        style={{ fontSize: "0.875rem" }}
                      >
                        Our team will review your contact list and send the
                        messages within 24 hours. We'll notify you once it's
                        done.
                      </p>
                      <button
                        onClick={() => {
                          setTeamRequestSent(false);
                          setTeamNotes("");
                        }}
                        className="text-[#25D366] hover:text-[#1DA851]"
                        style={{ fontSize: "0.875rem", fontWeight: 500 }}
                      >
                        Submit another request
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* How it works */}
                      <div className="bg-[#25D366]/5 rounded-xl p-4 space-y-3">
                        <p
                          className="text-[#166534]"
                          style={{
                            fontWeight: 600,
                            fontSize: "0.8125rem",
                          }}
                        >
                          How it works:
                        </p>
                        <div className="space-y-2">
                          {[
                            "Upload or paste your customer phone numbers below",
                            "Choose your preferred message template",
                            "Our team reviews & sends messages within 24 hours",
                            "You get notified once all messages are sent",
                          ].map((step, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2.5"
                            >
                              <div
                                className="w-5 h-5 bg-[#25D366] rounded-full flex items-center justify-center text-white shrink-0 mt-0.5"
                                style={{
                                  fontSize: "0.625rem",
                                  fontWeight: 700,
                                }}
                              >
                                {i + 1}
                              </div>
                              <p
                                className="text-[#166534]"
                                style={{ fontSize: "0.8125rem" }}
                              >
                                {step}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Upload contacts for team */}
                      <div>
                        <label
                          className="block text-[#111827] mb-1.5"
                          style={{ fontSize: "0.875rem", fontWeight: 500 }}
                        >
                          Customer List
                        </label>
                        <textarea
                          value={csvText}
                          onChange={(e) => setCsvText(e.target.value)}
                          rows={4}
                          placeholder={`John Smith, +1 555 123 4567\nJane Doe, +1 555 987 6543`}
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 outline-none transition-all resize-none font-mono"
                          style={{ fontSize: "0.8125rem" }}
                        />
                        <div className="mt-1.5 flex items-center gap-3">
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="text-[#25D366] hover:text-[#1DA851] flex items-center gap-1"
                            style={{
                              fontSize: "0.8125rem",
                              fontWeight: 500,
                            }}
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Or upload CSV
                          </button>
                          {csvText.trim() && (
                            <span
                              className="text-[#6B7280]"
                              style={{ fontSize: "0.75rem" }}
                            >
                              {parseCSV(csvText).length} contacts detected
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <label
                          className="block text-[#111827] mb-1.5"
                          style={{ fontSize: "0.875rem", fontWeight: 500 }}
                        >
                          Additional Notes{" "}
                          <span className="text-[#6B7280] font-normal">
                            (optional)
                          </span>
                        </label>
                        <textarea
                          value={teamNotes}
                          onChange={(e) => setTeamNotes(e.target.value)}
                          rows={3}
                          placeholder="e.g. Please send in the morning, use professional tone, these are from last week's customers..."
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 outline-none transition-all resize-none"
                          style={{ fontSize: "0.875rem" }}
                        />
                      </div>

                      {/* Cost estimate */}
                      {csvText.trim() && (
                        <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                          <span
                            className="text-[#6B7280]"
                            style={{ fontSize: "0.8125rem" }}
                          >
                            Import cost ({parseCSV(csvText).length} contacts)
                          </span>
                          <span
                            className="text-[#111827]"
                            style={{ fontWeight: 700 }}
                          >
                            $
                            {(
                              parseCSV(csvText).length * COST_PER_IMPORT
                            ).toFixed(4)}
                          </span>
                        </div>
                      )}

                      <button
                        onClick={handleTeamRequest}
                        disabled={
                          teamRequestLoading || !csvText.trim() || !scanUrl
                        }
                        className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1DA851] disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg transition-colors"
                        style={{ fontWeight: 600 }}
                      >
                        {teamRequestLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Headphones className="w-4 h-4" />
                        )}
                        Submit to Our Team
                      </button>

                      <p
                        className="text-[#6B7280] text-center"
                        style={{ fontSize: "0.75rem" }}
                      >
                        Sending is free · Import costs $0.0001/contact · No extra fees for team handling
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Message Template */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[#111827]" style={{ fontWeight: 600 }}>
                Message Template
              </h3>
              <button
                onClick={() => {
                  if (!useCustom) {
                    setCustomMessage(
                      DEFAULT_TEMPLATES.find(
                        (t) => t.id === selectedTemplate
                      )?.message || ""
                    );
                  }
                  setUseCustom(!useCustom);
                }}
                className="text-[#25D366] hover:text-[#1DA851]"
                style={{ fontSize: "0.875rem", fontWeight: 500 }}
              >
                {useCustom ? "Use Template" : "Customize"}
              </button>
            </div>

            {useCustom ? (
              <div className="space-y-3">
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 outline-none transition-all resize-none"
                  style={{ fontSize: "0.875rem" }}
                  placeholder="Write your custom message..."
                />
                <div className="flex flex-wrap gap-2">
                  {[
                    { tag: "{name}", label: "Name" },
                    { tag: "{business}", label: "Business" },
                    { tag: "{link}", label: "Link" },
                  ].map((v) => (
                    <button
                      key={v.tag}
                      onClick={() =>
                        setCustomMessage((prev) => prev + ` ${v.tag}`)
                      }
                      className="px-2.5 py-1 bg-[#25D366]/10 text-[#1DA851] rounded-md hover:bg-[#25D366]/20 transition-colors"
                      style={{ fontSize: "0.75rem", fontWeight: 500 }}
                    >
                      + {v.label}
                    </button>
                  ))}
                </div>
                <p className="text-[#6B7280]" style={{ fontSize: "0.75rem" }}>
                  Use {"{name}"}, {"{business}"}, and {"{link}"} as placeholders
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {DEFAULT_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                      selectedTemplate === template.id
                        ? "border-[#25D366] bg-[#25D366]/5 ring-1 ring-[#25D366]/20"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <p
                      className={`mb-0.5 ${
                        selectedTemplate === template.id
                          ? "text-[#1DA851]"
                          : "text-[#111827]"
                      }`}
                      style={{ fontSize: "0.875rem", fontWeight: 600 }}
                    >
                      {template.label}
                    </p>
                    <p
                      className="text-[#6B7280] line-clamp-2"
                      style={{ fontSize: "0.75rem" }}
                    >
                      {template.message
                        .replace(/{name}/g, "John")
                        .replace(/{business}/g, businessName)
                        .replace(/{link}/g, "[review link]")}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Preview + History */}
        <div className="space-y-6">
          {/* Message Preview */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-[#111827] mb-4" style={{ fontWeight: 600 }}>
              Message Preview
            </h3>
            <div className="bg-[#ECE5DD] rounded-xl p-4">
              <div className="flex justify-end">
                <div
                  className="bg-[#DCF8C6] rounded-xl rounded-tr-sm px-4 py-2.5 max-w-[85%] shadow-sm"
                  style={{ fontSize: "0.875rem" }}
                >
                  <p className="text-[#111827] whitespace-pre-wrap break-words">
                    {previewMessage}
                  </p>
                  <p
                    className="text-right text-[#6B7280] mt-1"
                    style={{ fontSize: "0.625rem" }}
                  >
                    {new Date().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            </div>
            <p
              className="text-[#6B7280] mt-3 text-center"
              style={{ fontSize: "0.75rem" }}
            >
              This is how the message will appear in WhatsApp
            </p>
          </div>

          {/* Send History */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-[#111827] mb-4" style={{ fontWeight: 600 }}>
              Send History
            </h3>
            {allLogs.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p
                  className="text-[#6B7280]"
                  style={{ fontSize: "0.875rem" }}
                >
                  No messages sent yet.
                </p>
                <p
                  className="text-[#9CA3AF]"
                  style={{ fontSize: "0.75rem" }}
                >
                  Send your first review request above!
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto">
                {allLogs.slice(0, 50).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between py-3 px-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-[#25D366]/10 rounded-lg flex items-center justify-center shrink-0">
                        <MessageCircle className="w-4 h-4 text-[#25D366]" />
                      </div>
                      <div className="min-w-0">
                        <p
                          className="text-[#111827] truncate"
                          style={{
                            fontSize: "0.8125rem",
                            fontWeight: 500,
                          }}
                        >
                          {log.name}
                        </p>
                        <p
                          className="text-[#6B7280]"
                          style={{ fontSize: "0.6875rem" }}
                        >
                          +{log.phone}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span
                        className="inline-flex items-center gap-1 text-[#25D366]"
                        style={{ fontSize: "0.6875rem", fontWeight: 500 }}
                      >
                        <ExternalLink className="w-3 h-3" />
                        Sent
                      </span>
                      <p
                        className="text-[#9CA3AF]"
                        style={{ fontSize: "0.625rem" }}
                      >
                        {new Date(log.sentAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        {new Date(log.sentAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tips */}
          <div className="bg-[#25D366]/5 rounded-xl border border-[#25D366]/20 p-6">
            <h3 className="text-[#166534] mb-3" style={{ fontWeight: 600 }}>
              WhatsApp Tips
            </h3>
            <ul
              className="space-y-2 text-[#166534]"
              style={{ fontSize: "0.875rem" }}
            >
              <li className="flex items-start gap-2">
                <span className="mt-0.5">*</span>
                Include the country code (e.g. +1 for US, +44 for UK)
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">*</span>
                Send requests within 24 hours of the customer's visit
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">*</span>
                Personalize with the customer's name for higher response rates
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">*</span>
                Use "Request Our Team" tab if you'd rather we handle it
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}