import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { QRCodeSVG } from "qrcode.react";
import {
  QrCode,
  Search,
  Star,
  MapPin,
  ArrowRight,
  CheckCircle,
  Loader2,
  X,
} from "lucide-react";
import { useAuth } from "./auth-context";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const SUPABASE_URL = `https://${projectId}.supabase.co`;
const API_BASE = `${SUPABASE_URL}/functions/v1/make-server-6cea9865`;

interface GooglePlace {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  types: string[];
  rating: number | null;
  ratingCount: number;
  googleMapsUri: string;
}

export function SetupWizard() {
  const { profile, updateProfile, refreshProfile, apiCall } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState(
    profile?.businessName || ""
  );
  const [reviewLink, setReviewLink] = useState(profile?.reviewLink || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GooglePlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<GooglePlace | null>(null);
  const [searchCity, setSearchCity] = useState("");
  const [searchError, setSearchError] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Sync from profile when it loads
  useEffect(() => {
    if (profile) {
      if (profile.businessName && !businessName)
        setBusinessName(profile.businessName);
      if (profile.reviewLink && !reviewLink) setReviewLink(profile.reviewLink);
    }
  }, [profile]);

  // Search for businesses via our backend (Google Places API — key stays server-side)
  const searchBusiness = useCallback(
    async (query: string, city: string) => {
      if (query.length < 2) {
        setSearchResults([]);
        setSearchError("");
        return;
      }

      setSearching(true);
      setSearchError("");
      try {
        // Use direct fetch with anon key — places-search is a public proxy endpoint
        const res = await fetch(`${API_BASE}/places-search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ query, city }),
        });

        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.places || []);
          if ((data.places || []).length === 0) {
            setSearchError("No businesses found. Try a different name or city.");
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.error || `Server error: ${res.status}`;
          console.log("Places search error:", errMsg);
          setSearchError(errMsg);
          setSearchResults([]);
        }
      } catch (err: any) {
        console.log("Search error:", err);
        setSearchError(`Connection error: ${err.message || "Could not reach server"}`);
        setSearchResults([]);
      }
      setSearching(false);
    },
    []
  );

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (searchQuery.length >= 2) {
      searchTimeout.current = setTimeout(() => {
        searchBusiness(searchQuery, searchCity);
      }, 400);
    } else {
      setSearchResults([]);
    }
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery, searchCity, searchBusiness]);

  const formatType = (types: string[]) => {
    // Show a human-readable type label
    const typeMap: Record<string, string> = {
      restaurant: "Restaurant",
      cafe: "Cafe",
      bar: "Bar",
      store: "Store",
      hair_care: "Hair Salon",
      beauty_salon: "Beauty Salon",
      spa: "Spa",
      gym: "Gym",
      dentist: "Dentist",
      doctor: "Doctor",
      hospital: "Hospital",
      pharmacy: "Pharmacy",
      car_repair: "Auto Repair",
      car_dealer: "Car Dealer",
      lodging: "Hotel",
      real_estate_agency: "Real Estate",
      lawyer: "Lawyer",
      accounting: "Accounting",
      plumber: "Plumber",
      electrician: "Electrician",
      veterinary_care: "Veterinarian",
      pet_store: "Pet Store",
      bakery: "Bakery",
      meal_takeaway: "Takeaway",
      meal_delivery: "Delivery",
    };
    for (const t of types) {
      if (typeMap[t]) return typeMap[t];
    }
    // Fallback: clean up the first type
    if (types.length > 0) {
      return types[0].replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return "Business";
  };

  const handleSelectPlace = (place: GooglePlace) => {
    setSelectedPlace(place);
    setBusinessName(place.name);

    // Generate the direct Google review link using the Place ID
    // Format: the placeId from Places API (New) is like "places/ChIJ..."
    // We need just the ChIJ... part for the writereview URL
    const cleanPlaceId = place.placeId.replace("places/", "");
    const directReviewLink = `https://search.google.com/local/writereview?placeid=${cleanPlaceId}`;
    setReviewLink(directReviewLink);

    setSearchResults([]);
    setSearchQuery(place.name);
  };

  const handleNext = async () => {
    if (step === 1) {
      if (!businessName.trim() && !selectedPlace) {
        setError("Please search for and select your business");
        return;
      }
      if (!businessName.trim()) {
        setError("Please enter your business name");
        return;
      }
      setError("");
      setStep(2);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    setError("");
    try {
      // Use updateProfile() — it calls setProfile(data.profile) directly from the
      // server response, so local state is guaranteed correct before we navigate.
      const result = await updateProfile({
        businessName: businessName.trim(),
        reviewLink: reviewLink.trim(),
        setupComplete: true,
      });

      if (!result.error) {
        console.log("handleFinish: Profile updated successfully, navigating to dashboard");
        navigate("/dashboard", { state: { fromSetup: true }, replace: true });
      } else {
        console.log("handleFinish: updateProfile error:", result.error);
        // If 401-style error, redirect to login
        if (
          result.error.includes("401") ||
          result.error.toLowerCase().includes("unauthorized") ||
          result.error.toLowerCase().includes("no access token")
        ) {
          navigate("/login", { replace: true });
        } else {
          setError(result.error);
        }
      }
    } catch (err: any) {
      console.log("handleFinish exception:", err);
      setError(err.message || "An unexpected error occurred. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-[#10B981] rounded-xl flex items-center justify-center">
              <QrCode className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1
            className="text-[#111827] mb-2"
            style={{ fontSize: "1.5rem", fontWeight: 700 }}
          >
            Let's set up your QR code
          </h1>
          <p className="text-[#6B7280]">
            Find your business on Google and we'll create your review link
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8 max-w-xs mx-auto">
          {[1, 2].map((s) => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${
                  step >= s
                    ? "bg-[#10B981] text-white"
                    : "bg-gray-200 text-[#6B7280]"
                }`}
                style={{ fontWeight: 600 }}
              >
                {step > s ? <CheckCircle className="w-4 h-4" /> : s}
              </div>
              {s < 2 && (
                <div
                  className={`flex-1 h-1 rounded-full ${
                    step > s ? "bg-[#10B981]" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-5">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="w-14 h-14 bg-[#10B981]/10 rounded-2xl flex items-center justify-center mx-auto mb-2">
                <Search className="w-7 h-7 text-[#10B981]" />
              </div>
              <div className="text-center">
                <h2
                  className="text-[#111827] mb-1"
                  style={{ fontWeight: 600 }}
                >
                  Find your business on Google
                </h2>
                <p
                  className="text-[#6B7280]"
                  style={{ fontSize: "0.875rem" }}
                >
                  We'll use your Google listing to create a direct review link
                </p>
              </div>

              {/* City input */}
              <div>
                <label
                  className="block text-[#111827] mb-1.5"
                  style={{ fontSize: "0.8125rem", fontWeight: 500 }}
                >
                  City / Location
                </label>
                <input
                  type="text"
                  value={searchCity}
                  onChange={(e) => setSearchCity(e.target.value)}
                  placeholder="e.g. New York, London, Dubai"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 outline-none transition-all"
                  style={{ fontSize: "0.9375rem" }}
                />
              </div>

              {/* Business search */}
              <div className="relative">
                <label
                  className="block text-[#111827] mb-1.5"
                  style={{ fontSize: "0.8125rem", fontWeight: 500 }}
                >
                  Business Name
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#9CA3AF]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSelectedPlace(null);
                    }}
                    placeholder="e.g. Joe's Pizza, Main Street Salon"
                    className="w-full pl-11 pr-10 py-3 border border-gray-200 rounded-xl bg-white focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 outline-none transition-all"
                    style={{ fontSize: "0.9375rem" }}
                    autoFocus
                  />
                  {searching && (
                    <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#10B981] animate-spin" />
                  )}
                  {!searching && searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSearchResults([]);
                        setSelectedPlace(null);
                      }}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Search Results Dropdown */}
                {searchResults.length > 0 && !selectedPlace && (
                  <div className="absolute z-20 left-0 right-0 top-full mt-2 bg-white rounded-xl border border-gray-200 shadow-xl max-h-[320px] overflow-y-auto">
                    {searchResults.map((place) => (
                      <button
                        key={place.placeId}
                        onClick={() => handleSelectPlace(place)}
                        className="w-full text-left px-4 py-3 hover:bg-[#10B981]/5 transition-colors border-b border-gray-50 last:border-b-0 flex items-start gap-3"
                      >
                        <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                          <MapPin className="w-4 h-4 text-[#10B981]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-[#111827]"
                            style={{
                              fontSize: "0.875rem",
                              fontWeight: 500,
                            }}
                          >
                            {place.name}
                          </p>
                          <p
                            className="text-[#6B7280] truncate"
                            style={{ fontSize: "0.75rem" }}
                          >
                            {place.address}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className="inline-block text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full capitalize"
                              style={{ fontSize: "0.625rem" }}
                            >
                              {formatType(place.types)}
                            </span>
                            {place.rating && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[#F59E0B]"
                                style={{ fontSize: "0.625rem" }}
                              >
                                <Star className="w-3 h-3 fill-[#F59E0B]" />
                                {place.rating.toFixed(1)}
                                {place.ratingCount > 0 && (
                                  <span className="text-[#9CA3AF] ml-0.5">
                                    ({place.ratingCount.toLocaleString()})
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Search error feedback */}
                {searchError && !searching && !selectedPlace && searchQuery.length >= 2 && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm">
                    {searchError}
                  </div>
                )}
              </div>

              {/* Selected Place Confirmation */}
              {selectedPlace && (
                <div className="bg-[#10B981]/5 border border-[#10B981]/20 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-[#10B981]/10 rounded-lg flex items-center justify-center shrink-0">
                      <CheckCircle className="w-5 h-5 text-[#10B981]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[#111827]"
                        style={{ fontWeight: 600, fontSize: "0.9375rem" }}
                      >
                        {selectedPlace.name}
                      </p>
                      <p
                        className="text-[#6B7280] mt-0.5"
                        style={{ fontSize: "0.8125rem" }}
                      >
                        {selectedPlace.address}
                      </p>
                      {selectedPlace.rating && (
                        <div className="flex items-center gap-1 mt-1.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${
                                s <= Math.round(selectedPlace.rating!)
                                  ? "text-[#F59E0B] fill-[#F59E0B]"
                                  : "text-gray-200"
                              }`}
                            />
                          ))}
                          <span
                            className="text-[#6B7280] ml-1"
                            style={{ fontSize: "0.75rem" }}
                          >
                            {selectedPlace.rating.toFixed(1)} ({selectedPlace.ratingCount.toLocaleString()} reviews)
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-2">
                        <CheckCircle className="w-3.5 h-3.5 text-[#10B981]" />
                        <p
                          className="text-[#10B981]"
                          style={{ fontSize: "0.75rem", fontWeight: 500 }}
                        >
                          Direct Google review link ready
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedPlace(null);
                        setSearchQuery("");
                        setBusinessName("");
                        setReviewLink("");
                      }}
                      className="text-gray-400 hover:text-gray-600 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Manual entry fallback */}
              {searchQuery.length >= 2 &&
                searchResults.length === 0 &&
                !searching &&
                !selectedPlace && (
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <p
                      className="text-[#6B7280] text-center"
                      style={{ fontSize: "0.8125rem" }}
                    >
                      Can't find your business? You can paste your Google review link manually on the next step.
                    </p>
                    <div>
                      <label
                        className="block text-[#111827] mb-1"
                        style={{ fontSize: "0.8125rem", fontWeight: 500 }}
                      >
                        Business Name
                      </label>
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="Your business name"
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 outline-none transition-all"
                        style={{ fontSize: "0.875rem" }}
                      />
                    </div>
                    <button
                      onClick={() => {
                        if (businessName.trim()) {
                          setSelectedPlace({
                            placeId: "manual",
                            name: businessName,
                            address: "",
                            lat: 0,
                            lng: 0,
                            types: [],
                            rating: null,
                            ratingCount: 0,
                            googleMapsUri: "",
                          });
                        }
                      }}
                      disabled={!businessName.trim()}
                      className="w-full bg-[#10B981]/10 text-[#10B981] py-2.5 rounded-lg hover:bg-[#10B981]/20 transition-colors disabled:opacity-50"
                      style={{ fontSize: "0.875rem", fontWeight: 500 }}
                    >
                      Use this business name
                    </button>
                  </div>
                )}

              <button
                onClick={handleNext}
                disabled={!selectedPlace && !businessName.trim()}
                className="w-full flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#047857] disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl transition-colors"
                style={{ fontWeight: 600 }}
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center">
                <h2
                  className="text-[#111827] mb-1"
                  style={{ fontWeight: 600 }}
                >
                  Your QR code is ready!
                </h2>
                <p
                  className="text-[#6B7280]"
                  style={{ fontSize: "0.875rem" }}
                >
                  Here's a preview — customers scan to leave a Google review
                </p>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center gap-1.5 mb-3">
                  <Star className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
                  <Star className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
                  <Star className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
                  <Star className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
                  <Star className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
                </div>
                <p
                  className="text-[#111827] mb-1"
                  style={{ fontWeight: 600, fontSize: "1.125rem" }}
                >
                  {businessName}
                </p>
                <p
                  className="text-[#6B7280] mb-4"
                  style={{ fontSize: "0.875rem" }}
                >
                  Scan to leave a Google Review
                </p>
                <div className="inline-block p-4 bg-white rounded-2xl border-2 border-[#10B981]/20 shadow-lg shadow-[#10B981]/10 mb-4">
                  <QRCodeSVG
                    value={reviewLink || "https://google.com"}
                    size={180}
                    fgColor="#111827"
                    bgColor="#ffffff"
                    level="H"
                  />
                </div>
                {reviewLink && reviewLink.includes("placeid=") && (
                  <div className="flex items-center justify-center gap-1.5 mb-3">
                    <CheckCircle className="w-3.5 h-3.5 text-[#10B981]" />
                    <span
                      className="text-[#10B981]"
                      style={{ fontSize: "0.75rem", fontWeight: 500 }}
                    >
                      Direct Google review link (Place ID verified)
                    </span>
                  </div>
                )}
                <div className="bg-gray-50 rounded-lg px-4 py-2.5 max-w-xs mx-auto">
                  <p
                    className="text-[#6B7280] truncate"
                    style={{ fontSize: "0.6875rem" }}
                  >
                    {reviewLink || "Review link will be set up"}
                  </p>
                </div>
              </div>

              {/* Edit review link option */}
              <details className="group">
                <summary
                  className="flex items-center justify-center gap-1 text-[#6B7280] hover:text-[#10B981] cursor-pointer transition-colors"
                  style={{ fontSize: "0.8125rem" }}
                >
                  Have your own Google review link? Click to enter it
                </summary>
                <div className="mt-3 space-y-2">
                  <input
                    type="url"
                    value={reviewLink}
                    onChange={(e) => setReviewLink(e.target.value)}
                    placeholder="https://search.google.com/local/writereview?placeid=..."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 outline-none transition-all"
                    style={{ fontSize: "0.8125rem" }}
                  />
                  <p
                    className="text-[#9CA3AF] text-center"
                    style={{ fontSize: "0.6875rem" }}
                  >
                    Paste your direct Google review link here for best results
                  </p>
                </div>
              </details>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 border border-gray-200 text-[#111827] py-3 rounded-xl hover:bg-gray-50 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  Back
                </button>
                <button
                  onClick={handleFinish}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#047857] disabled:opacity-50 text-white py-3 rounded-xl transition-colors"
                  style={{ fontWeight: 600 }}
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Go to Dashboard
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-6 mt-6">
          <div className="flex items-center gap-1.5 text-[#6B7280]">
            <CheckCircle className="w-3.5 h-3.5 text-[#10B981]" />
            <span style={{ fontSize: "0.75rem" }}>Free 10-day trial</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#6B7280]">
            <CheckCircle className="w-3.5 h-3.5 text-[#10B981]" />
            <span style={{ fontSize: "0.75rem" }}>No credit card</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#6B7280]">
            <CheckCircle className="w-3.5 h-3.5 text-[#10B981]" />
            <span style={{ fontSize: "0.75rem" }}>Setup in 30 seconds</span>
          </div>
        </div>
      </div>
    </div>
  );
}