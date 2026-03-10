import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";

const app = new Hono();

app.use("*", logger(console.log));

app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-User-Token"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  })
);

// Create singleton Supabase client for auth validation
let _supabaseAuthClient: any = null;
function getAuthClient() {
  if (!_supabaseAuthClient) {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    _supabaseAuthClient = createClient(url, key);
  }
  return _supabaseAuthClient;
}

// Helper: get authenticated user — returns { user, error }
// Reads the user JWT from X-User-Token header (primary) or Authorization header (fallback).
// The frontend sends the anon key in Authorization (to pass the Supabase gateway's JWT check)
// and the real user token in X-User-Token (to avoid "Invalid JWT" from the gateway).
async function getAuthUser(c: any): Promise<{ user: any; error: string | null }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    const missing = [
      !supabaseUrl && "SUPABASE_URL",
      !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean).join(", ");
    console.log("getAuthUser: Missing env vars:", missing);
    return { user: null, error: `Server config error: missing ${missing}` };
  }

  // Priority: X-User-Token header > Authorization header
  const userTokenHeader = c.req.header("X-User-Token") || "";
  const authHeader = c.req.header("Authorization") || "";
  const authToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  // Use X-User-Token if present, otherwise fall back to Authorization
  const accessToken = userTokenHeader || authToken;

  if (!accessToken) {
    console.log("getAuthUser: No access token in X-User-Token or Authorization header");
    return { user: null, error: "No access token provided" };
  }

  // Don't try to auth with the anon key
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (accessToken === anonKey) {
    console.log("getAuthUser: Received anon key instead of user token");
    return { user: null, error: "Anonymous key sent instead of user token. Please sign in." };
  }

  console.log("getAuthUser: Validating token from", userTokenHeader ? "X-User-Token" : "Authorization", "first 20 chars:", accessToken.substring(0, 20) + "...");

  try {
    const supabase = getAuthClient();
    
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);

    if (error) {
      console.log("getAuthUser: auth.getUser error:", error.message);
      return { user: null, error: `Auth validation failed: ${error.message}` };
    }

    if (!user) {
      console.log("getAuthUser: No user returned from auth.getUser");
      return { user: null, error: "Token valid but no user found" };
    }

    console.log("getAuthUser: Authenticated user:", user.id, user.email);
    return { user, error: null };
  } catch (err: any) {
    console.log("getAuthUser: Exception during auth.getUser:", err?.message || err);
    return { user: null, error: `Auth exception: ${err?.message || "unknown"}` };
  }
}

// Health check
app.get("/make-server-6cea9865/health", (c) => {
  return c.json({ status: "ok" });
});

// ─── DEBUG: AUTH DIAGNOSTICS ───
app.get("/make-server-6cea9865/auth-check", async (c) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  const diagnostics: Record<string, any> = {
    SUPABASE_URL: supabaseUrl ? "set" : "MISSING",
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey ? `set (${serviceRoleKey.length} chars)` : "MISSING",
    SUPABASE_ANON_KEY: anonKey ? `set (${anonKey.length} chars)` : "MISSING",
  };

  // Check X-User-Token first (new dual-header pattern), then fall back to Authorization
  const userTokenHeader = c.req.header("X-User-Token") || "";
  const authHeader = c.req.header("Authorization") || "";
  const authToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const token = userTokenHeader || authToken;

  diagnostics.tokenSource = userTokenHeader ? "X-User-Token" : (authToken ? "Authorization" : "none");
  diagnostics.tokenProvided = !!token;
  diagnostics.tokenLength = token.length;
  diagnostics.isAnonKey = token === anonKey;

  if (token && token !== anonKey && supabaseUrl && serviceRoleKey) {
    try {
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const { data, error } = await supabase.auth.getUser(token);
      diagnostics.authResult = error
        ? { error: error.message, status: error.status }
        : { userId: data?.user?.id || "none" };
    } catch (err: any) {
      diagnostics.authResult = { exception: err?.message || "unknown" };
    }
  }

  return c.json({ diagnostics });
});

// ─── AUTH: SIGNUP ───
app.post("/make-server-6cea9865/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if user already exists in Supabase Auth to prevent duplicates
    const { data: { users: existingUsers } } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.find((u: any) => u.email === email);
    if (existingUser) {
      console.log("Signup: user already exists:", email, "id:", existingUser.id);
      // Make sure they have a KV profile too
      const existingProfile = await kv.get(`user:${existingUser.id}`);
      if (!existingProfile) {
        await kv.set(`user:${existingUser.id}`, {
          email,
          name: name || "",
          businessName: "",
          reviewLink: "",
          plan: "trial",
          createdAt: new Date().toISOString(),
          trialStartDate: new Date().toISOString(),
          setupComplete: false,
          balance: 0,
        });
        console.log("Signup: created missing KV profile for existing user:", existingUser.id);
      }
      return c.json({ error: "An account with this email already exists. Please sign in instead." }, 409);
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name: name || "" },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true,
    });
    if (error) {
      console.log("Signup error:", error.message);
      return c.json({ error: `Signup error: ${error.message}` }, 400);
    }

    // Initialize user profile in KV
    const userId = data.user.id;
    await kv.set(`user:${userId}`, {
      email,
      name: name || "",
      businessName: "",
      reviewLink: "",
      plan: "trial",
      createdAt: new Date().toISOString(),
      trialStartDate: new Date().toISOString(),
      setupComplete: false,
      balance: 0,
    });

    console.log("Signup success: user", userId, "— 10-day free trial started");
    return c.json({ success: true, userId, balance: 0 });
  } catch (err) {
    console.log("Signup exception:", err);
    return c.json({ error: `Signup exception: ${err}` }, 500);
  }
});

// ─── PROFILE: GET ───
app.get("/make-server-6cea9865/profile", async (c) => {
  try {
    const { user, error: authError } = await getAuthUser(c);
    if (!user) {
      console.log("GET /profile: Unauthorized -", authError);
      return c.json({ error: `Unauthorized: ${authError}` }, 401);
    }

    let profile = await kv.get(`user:${user.id}`);
    if (!profile) {
      // Create default profile if missing
      profile = {
        email: user.email || "",
        name: user.user_metadata?.name || "",
        businessName: "",
        reviewLink: "",
        plan: "trial",
        createdAt: new Date().toISOString(),
        trialStartDate: new Date().toISOString(),
        setupComplete: false,
        balance: 0,
        qrCodes: [],
      };
      await kv.set(`user:${user.id}`, profile);
    }
    // Ensure balance field exists for older profiles
    if (profile.balance === undefined || profile.balance === null) {
      profile.balance = 0;
    }
    // Migrate: ensure qrCodes array exists (backwards compat)
    if (!profile.qrCodes) {
      if (profile.businessName || profile.reviewLink) {
        profile.qrCodes = [{
          id: "qr_1",
          businessName: profile.businessName || "",
          reviewLink: profile.reviewLink || "",
        }];
      } else {
        profile.qrCodes = [];
      }
      await kv.set(`user:${user.id}`, profile);
    }
    return c.json({ profile, userId: user.id });
  } catch (err) {
    console.log("Get profile error:", err);
    return c.json({ error: `Get profile error: ${err}` }, 500);
  }
});

// ─── PROFILE: UPDATE ───
app.put("/make-server-6cea9865/profile", async (c) => {
  try {
    const { user, error: authError } = await getAuthUser(c);
    if (!user) {
      console.log("PUT /profile: Unauthorized -", authError);
      return c.json({ error: `Unauthorized: ${authError}` }, 401);
    }

    const updates = await c.req.json();
    console.log("PUT /profile: Updating user", user.id, "with:", JSON.stringify(updates));
    let existing = await kv.get(`user:${user.id}`);
    if (!existing) {
      console.log("PUT /profile: Profile not found for user", user.id, "- creating default");
      existing = {
        email: user.email || "",
        name: user.user_metadata?.name || "",
        businessName: "",
        reviewLink: "",
        plan: "trial",
        createdAt: new Date().toISOString(),
        trialStartDate: new Date().toISOString(),
        setupComplete: false,
        balance: 0,
        qrCodes: [],
      };
    }
    // Ensure balance exists for older profiles
    if (existing.balance === undefined || existing.balance === null) {
      existing.balance = 0;
    }

    // Validate qrCodes limits based on plan + extra purchased slots
    if (updates.qrCodes) {
      const plan = updates.plan || existing.plan || "trial";
      const baseLimitMap: Record<string, number> = { pro: 5, starter: 1, trial: 1 };
      const baseLimit = baseLimitMap[plan] || 1;
      const extraSlots = existing.extraQrSlots || 0;
      const maxQR = baseLimit + extraSlots;
      if (updates.qrCodes.length > maxQR) {
        return c.json({ error: `You can have up to ${maxQR} QR code${maxQR > 1 ? "s" : ""} (${baseLimit} from plan + ${extraSlots} purchased). Buy more add-on QR slots for $5 each.` }, 400);
      }
    }

    const updated = { ...existing, ...updates };
    // Keep businessName/reviewLink in sync with first QR code for backwards compat
    if (updated.qrCodes && updated.qrCodes.length > 0) {
      updated.businessName = updated.qrCodes[0].businessName || updated.businessName;
      updated.reviewLink = updated.qrCodes[0].reviewLink || updated.reviewLink;
    }
    console.log("PUT /profile: About to save updated profile:", JSON.stringify(updated));
    await kv.set(`user:${user.id}`, updated);
    console.log("PUT /profile: kv.set completed successfully");
    
    // Verify the save by reading back
    const verified = await kv.get(`user:${user.id}`);
    console.log("PUT /profile: Verified saved profile:", JSON.stringify(verified));
    
    console.log("PUT /profile: Returning updated profile to client, setupComplete =", updated.setupComplete);
    return c.json({ profile: updated });
  } catch (err) {
    console.log("Update profile error:", err);
    return c.json({ error: `Update profile error: ${err}` }, 500);
  }
});

// ─── QR SCAN: RECORD (public endpoint) ───
app.post("/make-server-6cea9865/scan/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const userAgent = c.req.header("User-Agent") || "Unknown";
    const device = /iPhone|iPad/i.test(userAgent)
      ? "iPhone"
      : /Android/i.test(userAgent)
      ? "Android"
      : "Desktop";

    const scanId = `scan:${userId}:${Date.now()}`;
    await kv.set(scanId, {
      userId,
      timestamp: new Date().toISOString(),
      device,
      userAgent: userAgent.substring(0, 200),
    });

    // Increment total scan count
    const statsKey = `scan_stats:${userId}`;
    const stats = (await kv.get(statsKey)) || { total: 0 };
    stats.total = (stats.total || 0) + 1;
    await kv.set(statsKey, stats);

    // Get user's review link and redirect info
    const profile = await kv.get(`user:${userId}`);
    const reviewLink = profile?.reviewLink || "";

    return c.json({ success: true, reviewLink });
  } catch (err) {
    console.log("Scan recording error:", err);
    return c.json({ error: `Scan recording error: ${err}` }, 500);
  }
});

// ─── QR SCAN: REDIRECT (public endpoint for QR codes) ───
app.get("/make-server-6cea9865/r/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const userAgent = c.req.header("User-Agent") || "Unknown";
    const device = /iPhone|iPad/i.test(userAgent)
      ? "iPhone"
      : /Android/i.test(userAgent)
      ? "Android"
      : "Desktop";

    // Record scan
    const scanId = `scan:${userId}:${Date.now()}`;
    await kv.set(scanId, {
      userId,
      timestamp: new Date().toISOString(),
      device,
      userAgent: userAgent.substring(0, 200),
    });

    const statsKey = `scan_stats:${userId}`;
    const stats = (await kv.get(statsKey)) || { total: 0 };
    stats.total = (stats.total || 0) + 1;
    await kv.set(statsKey, stats);

    // Redirect to Google review
    const profile = await kv.get(`user:${userId}`);
    const reviewLink =
      profile?.reviewLink ||
      "https://search.google.com/local/writereview?placeid=EXAMPLE";

    return c.redirect(reviewLink, 302);
  } catch (err) {
    console.log("Scan redirect error:", err);
    return c.json({ error: `Scan redirect error: ${err}` }, 500);
  }
});

// ─── QR CODE ADD-ON: PURCHASE EXTRA QR SLOT ($5 each) ───
app.post("/make-server-6cea9865/purchase-qr-slot", async (c) => {
  try {
    const { user, error: authError } = await getAuthUser(c);
    if (!user) return c.json({ error: `Unauthorized: ${authError}` }, 401);

    const QR_SLOT_PRICE = 5;

    const profile = await kv.get(`user:${user.id}`);
    if (!profile) return c.json({ error: "Profile not found" }, 404);

    // Ensure balance exists
    if (profile.balance === undefined || profile.balance === null) {
      profile.balance = 0;
    }

    // Check balance
    if (profile.balance < QR_SLOT_PRICE) {
      return c.json({
        error: `Insufficient balance. You need $${QR_SLOT_PRICE.toFixed(2)} but only have $${profile.balance.toFixed(2)}. Please top up your account first.`,
        needsTopUp: true,
        required: QR_SLOT_PRICE,
        current: profile.balance,
      }, 400);
    }

    // Deduct balance and add slot
    profile.balance = Number((profile.balance - QR_SLOT_PRICE).toFixed(2));
    profile.extraQrSlots = (profile.extraQrSlots || 0) + 1;

    await kv.set(`user:${user.id}`, profile);

    // Log the purchase
    const purchaseKey = `qr_purchase:${user.id}:${Date.now()}`;
    await kv.set(purchaseKey, {
      userId: user.id,
      email: user.email || "",
      price: QR_SLOT_PRICE,
      newTotal: profile.extraQrSlots,
      balanceBefore: profile.balance + QR_SLOT_PRICE,
      balanceAfter: profile.balance,
      createdAt: new Date().toISOString(),
    });

    console.log(`QR slot purchased by ${user.email}: slot #${profile.extraQrSlots}, balance now $${profile.balance.toFixed(2)}`);
    return c.json({
      success: true,
      extraQrSlots: profile.extraQrSlots,
      balance: profile.balance,
      profile,
    });
  } catch (err) {
    console.log("Purchase QR slot error:", err);
    return c.json({ error: `Purchase QR slot error: ${err}` }, 500);
  }
});

// ─── WHATSAPP: LOG MESSAGE ───
app.post("/make-server-6cea9865/whatsapp-log", async (c) => {
  try {
    const { user, error: authError } = await getAuthUser(c);
    if (!user) return c.json({ error: `Unauthorized: ${authError}` }, 401);

    const log = await c.req.json();
    const logKey = `wa_log:${user.id}:${Date.now()}`;
    await kv.set(logKey, {
      ...log,
      userId: user.id,
      sentAt: log.sentAt || new Date().toISOString(),
    });

    return c.json({ success: true });
  } catch (err) {
    console.log("WhatsApp log error:", err);
    return c.json({ error: `WhatsApp log error: ${err}` }, 500);
  }
});

// ─── WHATSAPP: GET LOGS ───
app.get("/make-server-6cea9865/whatsapp-logs", async (c) => {
  try {
    const { user, error: authError } = await getAuthUser(c);
    if (!user) return c.json({ error: `Unauthorized: ${authError}` }, 401);

    const logs = await kv.getByPrefix(`wa_log:${user.id}:`);
    const sorted = logs
      .filter((l: any) => l && l.sentAt)
      .sort(
        (a: any, b: any) =>
          new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
      );

    return c.json({ logs: sorted });
  } catch (err) {
    console.log("Get WhatsApp logs error:", err);
    return c.json({ error: `Get WhatsApp logs error: ${err}` }, 500);
  }
});

// ─── WHATSAPP: TEAM REQUEST ───
app.post("/make-server-6cea9865/whatsapp-team-request", async (c) => {
  try {
    const { user, error: authError } = await getAuthUser(c);
    if (!user) return c.json({ error: `Unauthorized: ${authError}` }, 401);

    const body = await c.req.json();
    const requestKey = `wa_team_req:${user.id}:${Date.now()}`;
    await kv.set(requestKey, {
      userId: user.id,
      email: user.email || "",
      contacts: body.contacts || [],
      notes: body.notes || "",
      template: body.template || "",
      businessName: body.businessName || "",
      reviewLink: body.reviewLink || "",
      status: "pending",
      createdAt: new Date().toISOString(),
      contactCount: (body.contacts || []).length,
      estimatedCost: ((body.contacts || []).length * 0.0001).toFixed(4),
    });

    console.log(
      `Team request from ${user.email}: ${(body.contacts || []).length} contacts, est $${((body.contacts || []).length * 0.0001).toFixed(4)}`
    );

    return c.json({ success: true, requestId: requestKey });
  } catch (err) {
    console.log("WhatsApp team request error:", err);
    return c.json({ error: `WhatsApp team request error: ${err}` }, 500);
  }
});

// ─── SCANS: GET RECENT ───
app.get("/make-server-6cea9865/scans", async (c) => {
  try {
    const { user, error: authError } = await getAuthUser(c);
    if (!user) return c.json({ error: `Unauthorized: ${authError}` }, 401);

    const scans = await kv.getByPrefix(`scan:${user.id}:`);
    // Sort by timestamp descending
    const sorted = scans
      .filter((s: any) => s && s.timestamp)
      .sort(
        (a: any, b: any) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

    return c.json({ scans: sorted });
  } catch (err) {
    console.log("Get scans error:", err);
    return c.json({ error: `Get scans error: ${err}` }, 500);
  }
});

// ─── STATS: GET ───
app.get("/make-server-6cea9865/stats", async (c) => {
  try {
    const { user, error: authError } = await getAuthUser(c);
    if (!user) return c.json({ error: `Unauthorized: ${authError}` }, 401);

    const scans = await kv.getByPrefix(`scan:${user.id}:`);
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    let total = 0;
    let today = 0;
    let thisWeek = 0;
    const dailyCounts: Record<string, number> = {};
    const deviceCounts: Record<string, number> = {};

    for (const scan of scans) {
      if (!scan || !scan.timestamp) continue;
      total++;
      const scanDate = new Date(scan.timestamp);
      const dateKey = scanDate.toISOString().split("T")[0];

      if (scanDate >= todayStart) today++;
      if (scanDate >= weekStart) thisWeek++;

      dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
      const dev = scan.device || "Unknown";
      deviceCounts[dev] = (deviceCounts[dev] || 0) + 1;
    }

    // Build last 30 days chart data
    const chartData = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(todayStart);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      chartData.push({
        date: key,
        scans: dailyCounts[key] || 0,
      });
    }

    const daysSinceFirst = scans.length > 0 ? Math.max(1, Math.ceil((now.getTime() - new Date(scans[scans.length - 1]?.timestamp || now).getTime()) / (1000 * 60 * 60 * 24))) : 1;
    const avgDaily = total > 0 ? (total / daysSinceFirst).toFixed(1) : "0";

    return c.json({
      stats: { total, today, thisWeek, avgDaily },
      chartData,
      deviceCounts,
    });
  } catch (err) {
    console.log("Get stats error:", err);
    return c.json({ error: `Get stats error: ${err}` }, 500);
  }
});

// ─── GOOGLE PLACES: SEARCH (proxied, API key stays server-side) ───
app.post("/make-server-6cea9865/places-search", async (c) => {
  try {
    // No user auth required — this is a search proxy only.
    // The Google API key stays server-side, which is the security goal.

    const { query, city } = await c.req.json();
    if (!query || query.length < 2) {
      return c.json({ error: "Search query too short (min 2 characters)" }, 400);
    }

    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      console.log("GOOGLE_PLACES_API_KEY is not set in environment");
      return c.json({ error: "Google Places API key not configured. Please add your API key in project settings." }, 500);
    }

    const textQuery = city ? `${query} in ${city}` : query;
    console.log("Places search: querying Google for:", textQuery);

    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.googleMapsUri",
        },
        body: JSON.stringify({
          textQuery,
          maxResultCount: 8,
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.log("Google Places API error - status:", res.status, "body:", errText);
      
      // Provide user-friendly messages for common errors
      if (res.status === 403) {
        return c.json({ error: "Google Places API access denied. Please check that the Places API (New) is enabled and the API key is valid." }, 502);
      }
      if (res.status === 400) {
        return c.json({ error: `Google Places API request error: ${errText}` }, 502);
      }
      return c.json(
        { error: `Google Places API error (${res.status}). Check server logs for details.` },
        502
      );
    }

    const data = await res.json();
    console.log("Places search: got", (data.places || []).length, "results");
    
    // Return only safe fields — no API key exposure
    const places = (data.places || []).map((p: any) => ({
      placeId: p.id,
      name: p.displayName?.text || "",
      address: p.formattedAddress || "",
      lat: p.location?.latitude || 0,
      lng: p.location?.longitude || 0,
      types: p.types || [],
      rating: p.rating || null,
      ratingCount: p.userRatingCount || 0,
      googleMapsUri: p.googleMapsUri || "",
    }));

    return c.json({ places });
  } catch (err) {
    console.log("Places search exception:", err);
    return c.json({ error: `Places search failed: ${err}` }, 500);
  }
});

// ─── GOOGLE PLACES: GET DETAILS (proxied, API key stays server-side) ───
app.get("/make-server-6cea9865/places-details/:placeId", async (c) => {
  try {
    // No user auth required — this is a search proxy only.
    // The Google API key stays server-side, which is the security goal.

    const placeId = c.req.param("placeId");
    if (!placeId) return c.json({ error: "Place ID required" }, 400);

    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      console.log("GOOGLE_PLACES_API_KEY not set");
      return c.json({ error: "Google Places API not configured" }, 500);
    }

    const res = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "id,displayName,formattedAddress,location,types,rating,userRatingCount,googleMapsUri,websiteUri",
        },
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.log("Google Places details error:", res.status, errText);
      return c.json(
        { error: `Google Places API error: ${res.status}` },
        502
      );
    }

    const p = await res.json();
    return c.json({
      place: {
        placeId: p.id,
        name: p.displayName?.text || "",
        address: p.formattedAddress || "",
        lat: p.location?.latitude || 0,
        lng: p.location?.longitude || 0,
        types: p.types || [],
        rating: p.rating || null,
        ratingCount: p.userRatingCount || 0,
        googleMapsUri: p.googleMapsUri || "",
        websiteUri: p.websiteUri || "",
      },
    });
  } catch (err) {
    console.log("Places details exception:", err);
    return c.json({ error: `Places details exception: ${err}` }, 500);
  }
});

// ─── BRAND SYNC: EXTRACT LOGO & COLORS FROM WEBSITE ───
app.post("/make-server-6cea9865/sync-brand", async (c) => {
  try {
    const { user, error: authError } = await getAuthUser(c);
    if (!user) return c.json({ error: `Unauthorized: ${authError}` }, 401);

    const { websiteUrl } = await c.req.json();
    if (!websiteUrl) return c.json({ error: "Website URL is required" }, 400);

    // Normalize URL
    let url = websiteUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    console.log(`sync-brand: Fetching website: ${url}`);

    // Fetch the website HTML
    let html = "";
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; DomReviewBot/1.0)",
          "Accept": "text/html,application/xhtml+xml",
        },
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeout);
      if (!res.ok) {
        return c.json({ error: `Failed to fetch website (${res.status})` }, 502);
      }
      html = await res.text();
      // Limit HTML size for AI processing
      html = html.substring(0, 15000);
    } catch (fetchErr: any) {
      console.log("sync-brand: Fetch error:", fetchErr?.message);
      return c.json({ error: `Could not reach website: ${fetchErr?.message || "timeout"}` }, 502);
    }

    // Extract metadata directly from HTML first (fast path)
    const extractedData: { logoUrl?: string; brandColor?: string; favicon?: string } = {};

    // Try to find favicon
    const faviconMatches = html.match(/<link[^>]*rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*href=["']([^"']+)["']/i);
    if (faviconMatches?.[1]) {
      let faviconUrl = faviconMatches[1];
      if (faviconUrl.startsWith("//")) faviconUrl = "https:" + faviconUrl;
      else if (faviconUrl.startsWith("/")) {
        const urlObj = new URL(url);
        faviconUrl = urlObj.origin + faviconUrl;
      } else if (!faviconUrl.startsWith("http")) {
        const urlObj = new URL(url);
        faviconUrl = urlObj.origin + "/" + faviconUrl;
      }
      extractedData.favicon = faviconUrl;
    }

    // Try to find OG image
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (ogImageMatch?.[1]) {
      let ogUrl = ogImageMatch[1];
      if (ogUrl.startsWith("//")) ogUrl = "https:" + ogUrl;
      else if (ogUrl.startsWith("/")) {
        const urlObj = new URL(url);
        ogUrl = urlObj.origin + ogUrl;
      }
      extractedData.logoUrl = ogUrl;
    }

    // Try to find theme-color
    const themeColorMatch = html.match(/<meta[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']theme-color["']/i);
    if (themeColorMatch?.[1]) {
      extractedData.brandColor = themeColorMatch[1];
    }

    // Use OpenRouter AI to analyze the HTML and extract brand info
    // Fallback chain: try each free model in order until one succeeds.
    // The customer never sees which model runs — it's fully transparent.
    const FREE_MODELS = [
      // Priority: reliable structured JSON output + high token availability
      "qwen/qwen3-next-80b-a3b-instruct:free",   // 837M tokens, 262K ctx — "fast stable responses without thinking traces"
      "google/gemma-3-27b-it:free",                // 534M tokens, 131K ctx — "structured outputs and function calling"
      "nvidia/nemotron-nano-9b-v2:free",           // 7.24B tokens, 128K ctx — massive availability, unified reasoning
      "stepfun/step-3.5-flash:free",               // 1.03T tokens, 256K ctx — largest free pool
      "openai/gpt-oss-120b:free",                  // 2.24B tokens, 131K ctx — OpenAI open-source, general purpose
      "meta-llama/llama-3.3-70b-instruct:free",    // 1.59B tokens, 128K ctx — reliable workhorse
      "mistralai/mistral-small-3.1-24b-instruct:free", // 315M tokens, 128K ctx — good structured output
      "arcee-ai/arcee-ai-trinity-mini:free",       // 9.01B tokens, 131K ctx — function calling, last resort
    ];

    const systemPrompt = "You are a brand analysis assistant. Given website HTML, extract the brand's primary color (as a hex code) and logo URL. Respond ONLY with valid JSON: {\"brandColor\": \"#hex\", \"logoUrl\": \"https://...\"}. If you can't find one, use null for that field. Do not include any other text.";
    const userPrompt = `Analyze this website HTML and extract the primary brand color and logo image URL. The website URL is: ${url}\n\nHTML (truncated):\n${html.substring(0, 8000)}`;

    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
    if (openrouterKey) {
      let aiSuccess = false;
      for (const model of FREE_MODELS) {
        if (aiSuccess) break;
        try {
          console.log(`sync-brand: Trying model ${model}...`);
          const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${openrouterKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              max_tokens: 200,
              temperature: 0.1,
            }),
          });

          if (!aiRes.ok) {
            const errText = await aiRes.text();
            console.log(`sync-brand: Model ${model} failed (${aiRes.status}): ${errText.substring(0, 200)}`);
            continue; // Try next model
          }

          const aiData = await aiRes.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          console.log(`sync-brand: Model ${model} responded:`, content.substring(0, 300));

          if (!content.trim()) {
            console.log(`sync-brand: Model ${model} returned empty response, trying next...`);
            continue;
          }

          // Parse JSON from the response
          const jsonMatch = content.match(/\{[^}]+\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.brandColor && /^#[0-9a-fA-F]{3,8}$/.test(parsed.brandColor)) {
                extractedData.brandColor = parsed.brandColor;
              }
              if (parsed.logoUrl && parsed.logoUrl.startsWith("http")) {
                extractedData.logoUrl = parsed.logoUrl;
              }
              aiSuccess = true;
              console.log(`sync-brand: Successfully extracted brand data using ${model}`);
            } catch {
              console.log(`sync-brand: Model ${model} returned unparseable JSON, trying next...`);
              continue;
            }
          } else {
            console.log(`sync-brand: Model ${model} response had no JSON, trying next...`);
            continue;
          }
        } catch (aiErr: any) {
          console.log(`sync-brand: Model ${model} exception: ${aiErr?.message}, trying next...`);
          continue;
        }
      }
      if (!aiSuccess) {
        console.log("sync-brand: All AI models failed, falling back to HTML extraction only");
      }
    } else {
      console.log("sync-brand: No OPENROUTER_API_KEY set, using HTML extraction only");
    }

    // Use favicon as fallback if no logo found
    if (!extractedData.logoUrl && extractedData.favicon) {
      extractedData.logoUrl = extractedData.favicon;
    }

    // Default fallback: construct a Google favicon URL
    if (!extractedData.logoUrl) {
      try {
        const domain = new URL(url).hostname;
        extractedData.logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      } catch {}
    }

    console.log("sync-brand: Final result:", JSON.stringify(extractedData));
    return c.json({
      success: true,
      logoUrl: extractedData.logoUrl || null,
      brandColor: extractedData.brandColor || null,
      websiteUrl: url,
    });
  } catch (err) {
    console.log("sync-brand error:", err);
    return c.json({ error: `Brand sync error: ${err}` }, 500);
  }
});

// ─── LOGO UPLOAD: PROXY URL (store external logo URL in profile) ───
app.post("/make-server-6cea9865/upload-logo", async (c) => {
  try {
    const { user, error: authError } = await getAuthUser(c);
    if (!user) return c.json({ error: `Unauthorized: ${authError}` }, 401);

    const { logoUrl, qrCodeId } = await c.req.json();
    if (!logoUrl) return c.json({ error: "Logo URL is required" }, 400);

    // Store the logo URL directly in the QR code entry
    const profile = await kv.get(`user:${user.id}`);
    if (!profile) return c.json({ error: "Profile not found" }, 404);

    if (qrCodeId && profile.qrCodes) {
      const idx = profile.qrCodes.findIndex((qr: any) => qr.id === qrCodeId);
      if (idx !== -1) {
        profile.qrCodes[idx].logoUrl = logoUrl;
        await kv.set(`user:${user.id}`, profile);
      }
    }

    console.log(`Logo URL saved for user ${user.email}, QR ${qrCodeId}: ${logoUrl.substring(0, 80)}`);
    return c.json({ success: true, logoUrl });
  } catch (err) {
    console.log("Upload logo error:", err);
    return c.json({ error: `Upload logo error: ${err}` }, 500);
  }
});

// ─── ADMIN: GET ALL USERS ───
const ADMIN_EMAIL = "sabbyzaman29@gmail.com";

// Helper: check if user is admin
function isAdmin(user: any): boolean {
  return user?.email === ADMIN_EMAIL;
}

app.get("/make-server-6cea9865/admin/users", async (c) => {
  try {
    const { user, error: authError } = await getAuthUser(c);
    if (!user) return c.json({ error: `Unauthorized: ${authError}` }, 401);
    if (!isAdmin(user)) return c.json({ error: "Forbidden: admin only" }, 403);

    // Query KV table directly to get both keys and values
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: rows, error: dbErr } = await supabase
      .from("kv_store_6cea9865")
      .select("key, value")
      .like("key", "user:%");

    if (dbErr) {
      console.log("Admin get users DB error:", dbErr.message);
      return c.json({ error: `DB error: ${dbErr.message}` }, 500);
    }

    const users = (rows || []).map((row: any) => {
      const p = row.value;
      const userId = row.key.replace("user:", "");
      return {
        userId,
        email: p.email || "",
        name: p.name || "",
        businessName: p.businessName || "",
        plan: p.plan || "trial",
        balance: p.balance ?? 0,
        setupComplete: p.setupComplete || false,
        createdAt: p.createdAt || "",
        reviewLink: p.reviewLink || "",
        qrCodesCount: (p.qrCodes || []).length,
      };
    });

    return c.json({ users, total: users.length });
  } catch (err) {
    console.log("Admin get users error:", err);
    return c.json({ error: `Admin get users error: ${err}` }, 500);
  }
});

// ─── ADMIN: GET OVERVIEW STATS ───
app.get("/make-server-6cea9865/admin/stats", async (c) => {
  try {
    console.log("ADMIN STATS: Request received, validating auth...");
    const { user, error: authError } = await getAuthUser(c);
    if (!user) {
      console.log("ADMIN STATS: Auth failed:", authError);
      return c.json({ error: `Unauthorized: ${authError}` }, 401);
    }
    console.log("ADMIN STATS: Auth OK, user:", user.email, "checking admin...");
    if (!isAdmin(user)) {
      console.log("ADMIN STATS: Not admin:", user.email);
      return c.json({ error: `Forbidden: admin only (got ${user.email})` }, 403);
    }
    console.log("ADMIN STATS: Admin confirmed, fetching data...");

    const allProfiles = await kv.getByPrefix("user:");
    const allScans = await kv.getByPrefix("scan:");
    const allWaLogs = await kv.getByPrefix("wa_log:");
    const allTeamReqs = await kv.getByPrefix("wa_team_req:");

    const totalUsers = allProfiles.length;
    const setupComplete = allProfiles.filter((p: any) => p.setupComplete).length;
    const trialUsers = allProfiles.filter((p: any) => p.plan === "trial").length;
    const starterUsers = allProfiles.filter((p: any) => p.plan === "starter").length;
    const proUsers = allProfiles.filter((p: any) => p.plan === "pro").length;
    const totalBalance = allProfiles.reduce((sum: number, p: any) => sum + (p.balance ?? 0), 0);
    const totalScans = allScans.filter((s: any) => s && s.timestamp).length;
    const totalWaMessages = allWaLogs.length;
    const pendingTeamReqs = allTeamReqs.filter((r: any) => r.status === "pending").length;

    // Signups per day (last 30 days)
    const now = new Date();
    const signupsByDay: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      signupsByDay[d.toISOString().split("T")[0]] = 0;
    }
    for (const p of allProfiles) {
      if (p.createdAt) {
        const day = new Date(p.createdAt).toISOString().split("T")[0];
        if (signupsByDay[day] !== undefined) signupsByDay[day]++;
      }
    }
    const signupChart = Object.entries(signupsByDay).map(([date, count]) => ({ date, signups: count }));

    // Scans per day (last 30 days)
    const scansByDay: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      scansByDay[d.toISOString().split("T")[0]] = 0;
    }
    for (const s of allScans) {
      if (s && s.timestamp) {
        const day = new Date(s.timestamp).toISOString().split("T")[0];
        if (scansByDay[day] !== undefined) scansByDay[day]++;
      }
    }
    const scanChart = Object.entries(scansByDay).map(([date, count]) => ({ date, scans: count }));

    return c.json({
      totalUsers,
      setupComplete,
      trialUsers,
      starterUsers,
      proUsers,
      totalBalance: totalBalance.toFixed(2),
      totalScans,
      totalWaMessages,
      pendingTeamReqs,
      signupChart,
      scanChart,
    });
  } catch (err) {
    console.log("Admin stats error:", err);
    return c.json({ error: `Admin stats error: ${err}` }, 500);
  }
});

// ─── ADMIN: GET TEAM REQUESTS ───
app.get("/make-server-6cea9865/admin/team-requests", async (c) => {
  try {
    const { user, error: authError } = await getAuthUser(c);
    if (!user) return c.json({ error: `Unauthorized: ${authError}` }, 401);
    if (!isAdmin(user)) return c.json({ error: "Forbidden: admin only" }, 403);

    const allReqs = await kv.getByPrefix("wa_team_req:");
    const sorted = allReqs
      .filter((r: any) => r && r.createdAt)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return c.json({ requests: sorted });
  } catch (err) {
    console.log("Admin team requests error:", err);
    return c.json({ error: `Admin team requests error: ${err}` }, 500);
  }
});

// ─── ADMIN: UPDATE USER BALANCE ───
app.put("/make-server-6cea9865/admin/user-balance", async (c) => {
  try {
    const { user, error: authError } = await getAuthUser(c);
    if (!user) return c.json({ error: `Unauthorized: ${authError}` }, 401);
    if (!isAdmin(user)) return c.json({ error: "Forbidden: admin only" }, 403);

    const { email, balance } = await c.req.json();
    if (!email || balance === undefined) return c.json({ error: "email and balance required" }, 400);

    // Find user profile by email
    const allProfiles = await kv.getByPrefix("user:");
    // We need to find the key — getByPrefix only returns values
    // We'll iterate all users to find the matching one
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: { users: authUsers }, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) return c.json({ error: `Failed to list users: ${listErr.message}` }, 500);

    const targetUser = authUsers?.find((u: any) => u.email === email);
    if (!targetUser) return c.json({ error: `User not found: ${email}` }, 404);

    const profile = await kv.get(`user:${targetUser.id}`);
    if (!profile) return c.json({ error: `Profile not found for ${email}` }, 404);

    profile.balance = Number(balance);
    await kv.set(`user:${targetUser.id}`, profile);

    console.log(`Admin: Updated balance for ${email} to $${balance}`);
    return c.json({ success: true, email, balance: profile.balance });
  } catch (err) {
    console.log("Admin update balance error:", err);
    return c.json({ error: `Admin update balance error: ${err}` }, 500);
  }
});

// ─── ADMIN: UPDATE USER PLAN ───
app.put("/make-server-6cea9865/admin/user-plan", async (c) => {
  try {
    const { user, error: authError } = await getAuthUser(c);
    if (!user) return c.json({ error: `Unauthorized: ${authError}` }, 401);
    if (!isAdmin(user)) return c.json({ error: "Forbidden: admin only" }, 403);

    const { email, plan } = await c.req.json();
    const validPlans = ["trial", "starter", "pro"];
    if (!email || !plan) return c.json({ error: "email and plan required" }, 400);
    if (!validPlans.includes(plan)) return c.json({ error: `Invalid plan. Must be one of: ${validPlans.join(", ")}` }, 400);

    // Find user by email in Supabase Auth
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: { users: authUsers }, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) return c.json({ error: `Failed to list users: ${listErr.message}` }, 500);

    const targetUser = authUsers?.find((u: any) => u.email === email);
    if (!targetUser) return c.json({ error: `User not found: ${email}` }, 404);

    const profile = await kv.get(`user:${targetUser.id}`);
    if (!profile) return c.json({ error: `Profile not found for ${email}` }, 404);

    const oldPlan = profile.plan;
    profile.plan = plan;
    // If moving from trial to a paid plan, clear the trial expiry concern
    // If moving to trial, set a fresh trial start
    if (plan === "trial" && oldPlan !== "trial") {
      profile.trialStartedAt = new Date().toISOString();
    }
    await kv.set(`user:${targetUser.id}`, profile);

    console.log(`Admin: Changed plan for ${email} from ${oldPlan} to ${plan}`);
    return c.json({ success: true, email, oldPlan, newPlan: plan });
  } catch (err) {
    console.log("Admin update plan error:", err);
    return c.json({ error: `Admin update plan error: ${err}` }, 500);
  }
});

// ─── ADMIN: DELETE SINGLE USER ───
app.delete("/make-server-6cea9865/admin/user/:userId", async (c) => {
  try {
    const { user, error: authError } = await getAuthUser(c);
    if (!user) return c.json({ error: `Unauthorized: ${authError}` }, 401);
    if (!isAdmin(user)) return c.json({ error: "Forbidden: admin only" }, 403);

    const userId = c.req.param("userId");
    if (!userId) return c.json({ error: "userId required" }, 400);

    // Don't allow deleting your own account
    if (userId === user.id) {
      return c.json({ error: "Cannot delete your own admin account" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Delete from Supabase Auth
    const { error: authDeleteErr } = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteErr) {
      console.log(`Admin: Failed to delete auth user ${userId}:`, authDeleteErr.message);
      // Continue anyway — the auth user may already be deleted, but the KV entry remains
    }

    // Delete KV profile
    await kv.del(`user:${userId}`);

    // Also clean up related data (scans, scan_stats, wa_logs, wa_team_reqs)
    const supabaseDb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    // Delete scan entries
    await supabaseDb.from("kv_store_6cea9865").delete().like("key", `scan:${userId}:%`);
    await supabaseDb.from("kv_store_6cea9865").delete().eq("key", `scan_stats:${userId}`);
    await supabaseDb.from("kv_store_6cea9865").delete().like("key", `wa_log:${userId}:%`);
    await supabaseDb.from("kv_store_6cea9865").delete().like("key", `wa_team_req:${userId}:%`);

    console.log(`Admin: Deleted user ${userId} and all related data`);
    return c.json({ success: true, deletedUserId: userId });
  } catch (err) {
    console.log("Admin delete user error:", err);
    return c.json({ error: `Admin delete user error: ${err}` }, 500);
  }
});

// ─── ADMIN: CLEANUP DUPLICATE USERS ───
// Groups KV profiles by email, keeps the newest one per email, deletes the rest.
// Also removes orphaned KV profiles (no matching Supabase Auth user).
app.post("/make-server-6cea9865/admin/cleanup-duplicates", async (c) => {
  try {
    const { user, error: authError } = await getAuthUser(c);
    if (!user) return c.json({ error: `Unauthorized: ${authError}` }, 401);
    if (!isAdmin(user)) return c.json({ error: "Forbidden: admin only" }, 403);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all KV user entries with keys
    const { data: rows, error: dbErr } = await supabase
      .from("kv_store_6cea9865")
      .select("key, value")
      .like("key", "user:%");

    if (dbErr) return c.json({ error: `DB error: ${dbErr.message}` }, 500);

    // Get all Supabase Auth users
    const { data: { users: authUsers }, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) return c.json({ error: `Auth list error: ${listErr.message}` }, 500);

    const authUserIds = new Set((authUsers || []).map((u: any) => u.id));

    // Group KV entries by email
    const byEmail: Record<string, { key: string; userId: string; value: any }[]> = {};
    for (const row of (rows || [])) {
      const userId = row.key.replace("user:", "");
      const email = row.value?.email || "unknown";
      if (!byEmail[email]) byEmail[email] = [];
      byEmail[email].push({ key: row.key, userId, value: row.value });
    }

    const toDeleteKvKeys: string[] = [];
    const toDeleteAuthIds: string[] = [];
    const kept: string[] = [];

    for (const [email, entries] of Object.entries(byEmail)) {
      if (entries.length <= 1) {
        // Check if the single entry is orphaned (no auth user)
        const entry = entries[0];
        if (!authUserIds.has(entry.userId)) {
          console.log(`Cleanup: orphaned KV for ${email}, userId ${entry.userId}`);
          toDeleteKvKeys.push(entry.key);
          // Clean up related data too
          toDeleteKvKeys.push(`scan_stats:${entry.userId}`);
        } else {
          kept.push(`${email} (${entry.userId})`);
        }
        continue;
      }

      // Multiple entries for same email — sort by createdAt descending to keep newest
      entries.sort((a, b) => {
        const aDate = a.value?.createdAt ? new Date(a.value.createdAt).getTime() : 0;
        const bDate = b.value?.createdAt ? new Date(b.value.createdAt).getTime() : 0;
        return bDate - aDate;
      });

      // Also prefer the one that has a matching auth user
      let keepIdx = entries.findIndex((e) => authUserIds.has(e.userId));
      if (keepIdx === -1) keepIdx = 0; // If none match auth, keep the newest

      for (let i = 0; i < entries.length; i++) {
        if (i === keepIdx) {
          kept.push(`${email} (${entries[i].userId})`);
          continue;
        }
        const entry = entries[i];
        toDeleteKvKeys.push(entry.key);
        toDeleteKvKeys.push(`scan_stats:${entry.userId}`);
        // Delete the auth user if it exists and isn't the kept one
        if (authUserIds.has(entry.userId)) {
          toDeleteAuthIds.push(entry.userId);
        }
      }
    }

    // Perform deletions
    // Delete auth users (duplicates)
    for (const id of toDeleteAuthIds) {
      // Don't delete the admin's own auth account
      if (id === user.id) continue;
      const { error } = await supabase.auth.admin.deleteUser(id);
      if (error) console.log(`Cleanup: failed to delete auth user ${id}:`, error.message);
      else console.log(`Cleanup: deleted auth user ${id}`);
    }

    // Delete KV entries
    if (toDeleteKvKeys.length > 0) {
      await kv.mdel(toDeleteKvKeys);
      console.log(`Cleanup: deleted ${toDeleteKvKeys.length} KV entries`);
    }

    // Also clean up scan/wa_log/wa_team_req entries for deleted users
    const deletedUserIds = [...new Set([
      ...toDeleteKvKeys.filter(k => k.startsWith("user:")).map(k => k.replace("user:", "")),
    ])];
    for (const uid of deletedUserIds) {
      await supabase.from("kv_store_6cea9865").delete().like("key", `scan:${uid}:%`);
      await supabase.from("kv_store_6cea9865").delete().like("key", `wa_log:${uid}:%`);
      await supabase.from("kv_store_6cea9865").delete().like("key", `wa_team_req:${uid}:%`);
    }

    const summary = {
      totalBefore: (rows || []).length,
      duplicatesRemoved: toDeleteKvKeys.filter(k => k.startsWith("user:")).length,
      authUsersDeleted: toDeleteAuthIds.length,
      remaining: kept.length,
      kept,
    };

    console.log("Cleanup complete:", JSON.stringify(summary));
    return c.json({ success: true, ...summary });
  } catch (err) {
    console.log("Admin cleanup error:", err);
    return c.json({ error: `Admin cleanup error: ${err}` }, 500);
  }
});

// ─── TOP-UP: REQUEST (user-facing) ───
app.post("/make-server-6cea9865/topup-request", async (c) => {
  try {
    const { user, error: authError } = await getAuthUser(c);
    if (!user) return c.json({ error: `Unauthorized: ${authError}` }, 401);

    const { amount } = await c.req.json();
    if (!amount || amount <= 0) return c.json({ error: "Invalid top-up amount" }, 400);

    const requestKey = `topup_req:${user.id}:${Date.now()}`;
    await kv.set(requestKey, {
      userId: user.id,
      email: user.email || "",
      amount: Number(amount),
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    console.log(`Top-up request from ${user.email}: $${amount}`);
    return c.json({ success: true, requestId: requestKey, amount });
  } catch (err) {
    console.log("Top-up request error:", err);
    return c.json({ error: `Top-up request error: ${err}` }, 500);
  }
});

// ─── TOP-UP: GET USER'S REQUESTS ───
app.get("/make-server-6cea9865/topup-requests", async (c) => {
  try {
    const { user, error: authError } = await getAuthUser(c);
    if (!user) return c.json({ error: `Unauthorized: ${authError}` }, 401);

    const requests = await kv.getByPrefix(`topup_req:${user.id}:`);
    const sorted = requests
      .filter((r: any) => r && r.createdAt)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return c.json({ requests: sorted });
  } catch (err) {
    console.log("Get top-up requests error:", err);
    return c.json({ error: `Get top-up requests error: ${err}` }, 500);
  }
});

// ─── ADMIN: GET ALL TOP-UP REQUESTS ───
app.get("/make-server-6cea9865/admin/topup-requests", async (c) => {
  try {
    const { user, error: authError } = await getAuthUser(c);
    if (!user) return c.json({ error: `Unauthorized: ${authError}` }, 401);
    if (!isAdmin(user)) return c.json({ error: "Forbidden: admin only" }, 403);

    const requests = await kv.getByPrefix("topup_req:");
    const sorted = requests
      .filter((r: any) => r && r.createdAt)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return c.json({ requests: sorted });
  } catch (err) {
    console.log("Admin get top-up requests error:", err);
    return c.json({ error: `Admin get top-up requests error: ${err}` }, 500);
  }
});

Deno.serve(app.fetch);