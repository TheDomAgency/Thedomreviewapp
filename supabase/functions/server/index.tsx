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
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  })
);

// Helper: get authenticated user — returns { user, error }
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

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const authHeader = c.req.header("Authorization") || "";
  const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!accessToken) {
    console.log("getAuthUser: No access token in Authorization header");
    return { user: null, error: "No access token provided" };
  }

  // Don't try to auth with the anon key
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (accessToken === anonKey) {
    console.log("getAuthUser: Received anon key instead of user token");
    return { user: null, error: "Anonymous key sent instead of user token" };
  }

  console.log("getAuthUser: Validating token, length:", accessToken.length);

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);

    if (error) {
      console.log("getAuthUser: auth.getUser error:", error.message, "| status:", error.status);
      return { user: null, error: `Auth validation failed: ${error.message}` };
    }

    if (!user) {
      console.log("getAuthUser: No user returned from auth.getUser (no error either)");
      return { user: null, error: "Token valid but no user found" };
    }

    console.log("getAuthUser: Authenticated user:", user.id);
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

  // Check if auth header is a user JWT
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
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
      balance: 10.0,
    });

    console.log("Signup success: user", userId, "gets $10.00 free credit");
    return c.json({ success: true, userId, balance: 10.0 });
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
        balance: 10.0,
      };
      await kv.set(`user:${user.id}`, profile);
    }
    // Ensure balance field exists for older profiles
    if (profile.balance === undefined || profile.balance === null) {
      profile.balance = 10.0;
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
        balance: 10.0,
      };
    }
    // Ensure balance exists for older profiles
    if (existing.balance === undefined || existing.balance === null) {
      existing.balance = 10.0;
    }

    const updated = { ...existing, ...updates };
    await kv.set(`user:${user.id}`, updated);
    console.log("PUT /profile: Successfully updated profile for user", user.id);
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
      estimatedCost: ((body.contacts || []).length * 0.49).toFixed(2),
    });

    console.log(
      `Team request from ${user.email}: ${(body.contacts || []).length} contacts, est $${((body.contacts || []).length * 0.49).toFixed(2)}`
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

    const allProfiles = await kv.getByPrefix("user:");
    const users = allProfiles.map((p: any) => ({
      email: p.email || "",
      name: p.name || "",
      businessName: p.businessName || "",
      plan: p.plan || "trial",
      balance: p.balance ?? 0,
      setupComplete: p.setupComplete || false,
      createdAt: p.createdAt || "",
      reviewLink: p.reviewLink || "",
    }));

    return c.json({ users, total: users.length });
  } catch (err) {
    console.log("Admin get users error:", err);
    return c.json({ error: `Admin get users error: ${err}` }, 500);
  }
});

// ─── ADMIN: GET OVERVIEW STATS ───
app.get("/make-server-6cea9865/admin/stats", async (c) => {
  try {
    const { user, error: authError } = await getAuthUser(c);
    if (!user) return c.json({ error: `Unauthorized: ${authError}` }, 401);
    if (!isAdmin(user)) return c.json({ error: "Forbidden: admin only" }, 403);

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

Deno.serve(app.fetch);