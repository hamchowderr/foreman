import { createZapierSdk } from "@zapier/zapier-sdk";
import { getSupabase } from "../db";
import { indexAppCatalog } from "./vector";

interface SeedOptions {
  /** Max apps to pull (for testing). Default: all. */
  limit?: number;
  /** Skip action lookups — only pull app metadata. */
  appsOnly?: boolean;
  /** Only embed existing DB rows — skip SDK fetch. */
  embedOnly?: boolean;
  /** Log progress. */
  verbose?: boolean;
}

/**
 * Pull the Zapier app catalog from SDK and store in app_catalog table.
 * Optionally fetches action descriptions per app for richer embeddings.
 */
export async function seedCatalog(options: SeedOptions = {}): Promise<{
  appsInserted: number;
  appsEmbedded: number;
}> {
  const { limit, appsOnly = false, embedOnly = false, verbose = true } = options;
  const log = verbose ? console.log.bind(console) : () => {};

  let appsInserted = 0;

  if (!embedOnly) {
    log("Fetching app catalog from Zapier SDK...");
    const sdk = createZapierSdk({});

    // listApps returns max ~100 apps per call. To get broader coverage,
    // we also search by category keywords and aggregate unique results.
    const seen = new Map<string, any>();

    // 1. Default list (top 100)
    const defaultApps = await sdk.listApps({ maxItems: 200 });
    for (const app of defaultApps.data) seen.set(app.key, app);
    log(`  Default list: ${defaultApps.data.length} apps`);

    // 2. Search by category keywords to discover more
    if (!limit) {
      const searchTerms = [
        // Single letters
        ..."abcdefghijklmnopqrstuvwxyz".split(""),
        // Two-character combos (high yield — catches apps that share no single-letter prefix)
        "ab", "ac", "ad", "ag", "al", "am", "an", "ap", "ar", "as", "at", "au",
        "ba", "be", "bi", "bl", "bo", "br", "bu",
        "ca", "ce", "ch", "ci", "cl", "co", "cr", "cu",
        "da", "de", "di", "do", "dr", "du",
        "ea", "el", "em", "en", "ev", "ex",
        "fa", "fi", "fl", "fo", "fr", "fu",
        "ga", "ge", "gl", "go", "gr", "gu",
        "ha", "he", "hi", "ho", "hu", "hy",
        "in", "io", "is", "it",
        "ja", "je", "ji", "jo", "ju",
        "ka", "ke", "ki", "kl", "ko",
        "la", "le", "li", "lo", "lu",
        "ma", "me", "mi", "mo", "mu", "my",
        "na", "ne", "ni", "no", "nu",
        "ob", "of", "on", "op", "or", "ou", "ov",
        "pa", "pe", "ph", "pi", "pl", "po", "pr", "pu",
        "qu",
        "ra", "re", "ri", "ro", "ru",
        "sa", "sc", "se", "sh", "si", "sl", "sm", "sn", "so", "sp", "sq", "st", "su", "sw", "sy",
        "ta", "te", "th", "ti", "to", "tr", "tu", "tw",
        "un", "up", "ur", "us",
        "va", "ve", "vi", "vo",
        "wa", "we", "wh", "wi", "wo", "wr",
        "xe", "xi",
        "ya", "yo",
        "za", "ze", "zi", "zo",
        // Numbers and number combos
        "1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
        "10", "11", "12", "24", "36", "360", "365",
        // Common app name suffixes/patterns
        "pro", "hub", "cloud", "app", "bot", "flow", "desk", "stack",
        "ly", "ify", "io", "ize", "ful", "ment", "tion",
        "smart", "auto", "easy", "fast", "quick", "simple", "super",
        "one", "plus", "max", "go", "now", "live", "work",
        "team", "group", "crew", "staff", "people",
        "data", "base", "link", "net", "web", "site", "page",
        "mail", "send", "push", "ping", "alert", "notify",
        "pay", "bill", "cash", "money", "fund",
        "book", "meet", "plan", "track", "log", "note",
        "ship", "box", "drop", "store", "cart",
        "sign", "doc", "form", "pdf", "file",
        "lead", "deal", "pipe", "close", "sell",
        "hire", "talent", "recruit", "apply", "job",
        "learn", "teach", "train", "skill", "class",
        "health", "care", "med", "fit", "well",
        "build", "make", "craft", "create", "forge",
        // Missing two-letter combos — vowel-starting gaps
        "ai", "id", "il", "im", "ip", "ir", "iv", "ix", "iz",
        "eb", "ec", "ed", "ef", "eg", "ei", "ek", "ep", "eq", "et", "ew", "ey", "ez",
        "ob", "oc", "od", "og", "oh", "oi", "oj", "ok", "ol", "om", "os", "ot",
        "ub", "uc", "ud", "uf", "ug", "uh", "uj", "uk", "ul", "um", "uo", "uq", "uu", "uv", "uw", "ux", "uy", "uz",
        // Missing two-letter combos — consonant gaps
        "by", "cy", "dy", "fy", "gy", "ky", "ly", "ny", "ry", "ty", "vy", "wy", "xy", "zy",
        "bm", "bn", "bp", "bq", "bs", "bt", "bv", "bw", "bx", "bz",
        "cj", "ck", "cn", "cp", "cq", "cs", "ct", "cv", "cw", "cx", "cy", "cz",
        "df", "dg", "dh", "dj", "dk", "dl", "dm", "dn", "dp", "dq", "ds", "dt", "dv", "dw", "dx", "dy", "dz",
        "ef", "eg", "ej", "ek", "ep", "eq", "et", "ew", "ey", "ez",
        "fb", "fc", "fd", "fe", "ff", "fg", "fh", "fj", "fk", "fm", "fn", "fp", "fq", "fs", "ft", "fv", "fw", "fx", "fy", "fz",
        "gd", "gf", "gh", "gj", "gk", "gm", "gn", "gp", "gq", "gs", "gt", "gv", "gw", "gx", "gy", "gz",
        "hb", "hc", "hd", "hf", "hg", "hh", "hj", "hk", "hl", "hm", "hn", "hp", "hq", "hr", "hs", "ht", "hv", "hw", "hx", "hy", "hz",
        "ib", "ic", "if", "ig", "ij", "ik",
        "jb", "jc", "jd", "je", "jf", "jg", "jh", "jk", "jl", "jm", "jn", "jp", "jr", "js", "jt", "jv", "jw", "jx", "jy", "jz",
        "kb", "kc", "kd", "ke", "kf", "kg", "kh", "kj", "km", "kn", "kp", "kq", "kr", "ks", "kt", "ku", "kv", "kw", "kx", "ky", "kz",
        "lb", "lc", "ld", "lf", "lg", "lh", "lj", "lk", "ll", "lm", "ln", "lp", "lq", "lr", "ls", "lt", "lv", "lw", "lx", "ly", "lz",
        "mb", "mc", "md", "mf", "mg", "mh", "mj", "mk", "ml", "mm", "mn", "mp", "mq", "mr", "ms", "mt", "mv", "mw", "mx",
        "nb", "nc", "nd", "nf", "ng", "nh", "nj", "nk", "nl", "nm", "nn", "np", "nq", "nr", "ns", "nt", "nv", "nw", "nx", "ny", "nz",
        "pb", "pc", "pd", "pf", "pg", "pj", "pk", "pm", "pn", "pp", "pq", "ps", "pt", "pv", "pw", "px", "py", "pz",
        "rb", "rc", "rd", "rf", "rg", "rh", "rj", "rk", "rl", "rm", "rn", "rp", "rq", "rr", "rs", "rt", "rv", "rw", "rx", "ry", "rz",
        "sb", "sd", "sf", "sg", "sj", "sk", "ss", "st", "sv", "sw", "sx", "sy", "sz",
        "tb", "tc", "td", "tf", "tg", "tj", "tk", "tl", "tm", "tn", "tp", "tq", "ts", "tt", "tv", "tw", "tx", "ty", "tz",
        "vb", "vc", "vd", "vf", "vg", "vh", "vj", "vk", "vl", "vm", "vn", "vp", "vq", "vr", "vs", "vt", "vv", "vw", "vx", "vy", "vz",
        "wb", "wc", "wd", "wf", "wg", "wj", "wk", "wl", "wm", "wn", "wp", "wq", "wr", "ws", "wt", "wv", "ww", "wx", "wy", "wz",
        "xb", "xc", "xd", "xf", "xg", "xh", "xj", "xk", "xl", "xm", "xn", "xo", "xp", "xq", "xr", "xs", "xt", "xu", "xv", "xw", "xx", "xy", "xz",
        "yb", "yc", "yd", "ye", "yf", "yg", "yh", "yi", "yj", "yk", "yl", "ym", "yn", "yo", "yp", "yq", "yr", "ys", "yt", "yu", "yv", "yw", "yx", "yy", "yz",
        "zb", "zc", "zd", "zf", "zg", "zh", "zj", "zk", "zl", "zm", "zn", "zp", "zq", "zr", "zs", "zt", "zu", "zv", "zw", "zx", "zy", "zz",
        // Three-char high-value prefixes
        "api", "crm", "erp", "cms", "pos", "seo", "sms", "gps", "iot",
        "app", "bot", "pdf", "csv", "xml", "sql",
        // More three-char prefixes (high yield for app names)
        "acc", "act", "add", "adv", "age", "agr", "aid", "air", "all", "alt",
        "amp", "ana", "and", "ani", "ann", "any", "arc", "arm", "art", "ask",
        "att", "aud", "aut", "avg", "aws",
        "biz", "blu", "bro", "bud",
        "cab", "cir", "cod", "col", "com", "con", "cor", "cus",
        "dig", "dis", "div", "doc",
        "eco", "eff", "ele", "emp", "enc", "eng", "ent", "env", "est", "eve", "exp", "ext",
        "fac", "flo", "fly", "for",
        "gen", "geo", "get", "gig", "gov", "gro",
        "har", "hel", "her", "hig", "hop", "hot",
        "ide", "ima", "imp", "inc", "ind", "inf", "inn", "ins", "int", "inv",
        "lab", "lan", "lat", "lib", "lit", "loc",
        "man", "map", "mar", "mas", "mat", "mes", "mix", "mob", "mod", "mon",
        "neo", "net", "new", "nex",
        "obj", "off", "omn", "ope", "opt", "ord", "org", "out",
        "pac", "par", "pas", "pat", "per", "pit", "pix", "pla", "pod", "por", "pow", "pre", "pri", "pro", "pub",
        "que",
        "rad", "ran", "rap", "raw", "ray", "rec", "red", "ref", "rel", "rem", "rep", "res", "ret", "rev",
        "sam", "sec", "sel", "ser", "set", "sig", "sim", "six", "sky", "soc", "sol", "son", "sop", "sou", "spe", "spo", "sta", "str", "sub", "sum", "sup", "sur",
        "tal", "tap", "tar", "tek", "ten", "ter", "tex", "tic", "tim", "tip", "tog", "top", "tot", "tri", "tru",
        "uni", "use",
        "val", "ver", "vid", "vis",
        "web", "win", "wit", "wor",
        "zer", "zip", "zoo",
        // SaaS brand names (surface related/competing apps)
        "pipedrive", "basecamp", "clickup", "linear", "figma", "canva", "adobe",
        "oracle", "sap", "workday", "concur", "bamboohr", "greenhouse", "lever",
        "workable", "deel", "rippling", "gusto", "justworks", "paychex", "adp",
        "docusign", "hellosign", "pandadoc", "proposify",
        "klaviyo", "activecampaign", "drip", "convertkit", "aweber", "moosend",
        "brevo", "omnisend", "getresponse", "campaign monitor",
        "hootsuite", "buffer", "sprout", "later", "loomly", "planoly",
        "miro", "lucidchart", "whimsical", "draw",
        "loom", "vidyard", "wistia", "vimeo", "youtube",
        "helpscout", "groove", "kayako", "liveagent", "tidio",
        "heap", "mixpanel", "amplitude", "segment", "pendo", "fullstory",
        "datadog", "splunk", "newrelic", "sentry", "rollbar", "bugsnag",
        "supabase", "firebase", "neon", "planetscale", "cockroachdb", "mongodb",
        "twilio", "vonage", "bandwidth", "plivo", "messagebird",
        "plaid", "finix", "adyen", "braintree", "square", "paypal", "mollie",
        "shipstation", "shipbob", "easyship", "aftership", "shippo",
        "zenoti", "mindbody", "acuity", "booksy", "vagaro",
        "procore", "buildertrend", "corecon", "fieldwire", "plangrid",
        "veeva", "saleslogix", "netsuite", "dynamics", "epicor",
        "lattice", "leapsome", "15five", "betterworks", "perdoo",
        "culture amp", "glint", "peakon", "tinypulse", "officevibe",
        "expensify", "ramp", "brex", "airbase", "spendesk", "pleo",
        "carta", "captable", "pulley", "angellist",
        "legalzoom", "clerky", "ironclad", "clio", "mycase", "smokeball",
        "opendental", "eaglesoft", "dentrix", "carestream",
        "brightree", "theranest", "therapynotes", "simplepractice",
        "toast", "square", "lightspeed", "revel", "breadcrumb", "touchbistro",
        "mindbody", "pushpress", "wodify", "trainerize", "ptdistinction",
        // Tech & integration terms
        "saas", "paas", "fintech", "proptech", "edtech", "insurtech",
        "legaltech", "regtech", "martech", "adtech", "hrtech", "healthtech",
        "webhook", "rest", "graphql", "grpc", "oauth", "jwt", "saml", "sso",
        "slack bot", "discord bot", "telegram bot",
        "chrome extension", "firefox extension", "vscode",
        "ios app", "android app", "mobile app",
        // Geographic / language-specific apps (often missed)
        "wechat", "weibo", "baidu", "alipay", "wepay", "paytm", "razorpay",
        "line", "kakao", "viber", "zalo",
        "mercado", "rappi", "nubank", "itau", "bradesco",
        "xero", "myob", "sage", "kashflow", "freeagent", "clearbooks",
        // Official Zapier categories (from zapier.com/apps)
        "ai agents", "ai assistants", "ai chatbots", "ai content generation",
        "ai document extraction", "ai meeting assistants", "ai models",
        "ai safety", "ai sales tools", "ai web scraping", "mcp",
        "business intelligence", "dashboards", "reviews",
        "ecommerce", "fundraising", "payment processing", "proposal", "invoice", "taxes",
        "call tracking", "fax", "team chat", "team collaboration", "video conferencing",
        "file management", "storage", "images", "transcription", "audio",
        "talent", "recruitment",
        "devices", "printing",
        "developer tools", "online courses", "security", "identity tools", "server monitoring",
        "drip emails", "email newsletters", "event management", "marketing automation",
        "social media accounts", "social media marketing", "transactional email",
        "url shortener", "webinars",
        "bookmark managers", "product management", "spreadsheets", "task management",
        "contact management", "forms", "surveys", "signatures",
        "customer appreciation", "customer support",
        "app builder", "website builders",
        // Popular app names (to find related/competing apps)
        "google", "microsoft", "amazon", "facebook", "wordpress", "zoho",
        "hubspot", "salesforce", "slack", "notion", "airtable", "trello",
        "mailchimp", "stripe", "calendly", "typeform", "discord", "webflow",
        "asana", "monday", "jira", "github", "gitlab", "bitbucket",
        "shopify", "woocommerce", "squarespace", "wix",
        "quickbooks", "xero", "freshbooks", "wave",
        "zendesk", "intercom", "freshdesk", "drift",
        "twilio", "sendgrid", "mailgun", "postmark",
        "dropbox", "box", "onedrive",
        "zoom", "teams", "meet",
        "openai", "anthropic", "gemini", "llama", "mistral",
        "zapier", "make", "ifttt", "n8n", "power automate",
        // Core categories
        "email", "crm", "database", "spreadsheet", "calendar", "accounting",
        "project management", "social media", "ecommerce", "payment",
        "marketing", "analytics", "automation", "forms", "documents",
        "chat", "video", "invoicing", "hr", "support", "helpdesk",
        "sms", "notifications", "file storage", "cloud", "ai",
        "surveys", "scheduling", "recruiting", "shipping", "inventory",
        "sales", "finance", "education", "healthcare", "real estate",
        "legal", "restaurant", "construction", "travel", "fitness",
        "music", "gaming", "news", "weather", "maps", "translation",
        "design", "photo", "podcast", "webinar", "membership",
        // Niche categories
        "agriculture", "church", "veterinary", "dental", "nonprofit",
        "event", "ticketing", "printing", "insurance", "logistics",
        "warehouse", "manufacturing", "erp", "pos", "booking",
        "appointment", "signature", "contract", "proposal", "quote",
        "lead", "affiliate", "seo", "ads", "conversion",
        "feedback", "review", "loyalty", "reward", "referral",
        "backup", "monitoring", "devops", "cicd", "testing",
        "api", "webhook", "integration", "connector", "sync",
        "task", "todo", "kanban", "gantt", "scrum",
        "wiki", "knowledge base", "faq", "documentation", "notes",
        "time tracking", "timesheet", "payroll", "expense", "billing",
        "donation", "fundraising", "volunteer", "petition", "advocacy",
        "learning", "lms", "course", "quiz", "certification",
        "telecom", "voip", "phone", "call center", "ivr",
        "iot", "smart home", "sensor", "gps", "fleet",
        "crypto", "blockchain", "nft", "wallet", "exchange",
        "security", "password", "identity", "compliance", "audit",
        "media", "press", "journalism", "publishing", "content",
        "animation", "render", "cad", "architecture", "engineering",
        "pharmacy", "lab", "clinical", "patient", "telemedicine",
        "property", "tenant", "lease", "mortgage", "appraisal",
        "catering", "recipe", "food", "delivery", "grocery",
        "salon", "spa", "beauty", "tattoo", "barber",
        "pet", "animal", "breeding", "kennel", "grooming",
        "sports", "coaching", "gym", "yoga", "martial arts",
        "photography", "studio", "gallery", "portfolio", "model",
        "wedding", "planner", "dj", "florist", "venue",
        "cleaning", "landscaping", "plumbing", "hvac", "electrical",
        "auto", "mechanic", "dealer", "rental", "carwash",
        "aviation", "marine", "railroad", "trucking", "courier",
      ];

      for (const term of searchTerms) {
        try {
          const result = await sdk.listApps({ search: term, maxItems: 100 });
          let newCount = 0;
          for (const app of result.data) {
            if (!seen.has(app.key)) {
              seen.set(app.key, app);
              newCount++;
            }
          }
          if (newCount > 0) {
            log(`  Search "${term}": +${newCount} new (${seen.size} total)`);
          }
        } catch {
          // Some searches may fail — continue
        }
        await sleep(200); // Rate limit between searches
      }
    }

    const apps = [...seen.values()];
    if (limit) apps.splice(limit);
    log(`  Total unique apps: ${apps.length}`);

    // Process apps in batches
    const BATCH = 20;
    for (let i = 0; i < apps.length; i += BATCH) {
      const batch = apps.slice(i, i + BATCH);

      for (const app of batch) {
        let actionDescriptions: string[] = [];
        let actionCount = 0;

        if (!appsOnly) {
          try {
            const actions = await sdk.listActions({
              app: app.key,
              maxItems: 50,
            });
            actionCount = actions.data.length;
            actionDescriptions = actions.data
              .map((a: any) => a.description || a.title)
              .filter(Boolean)
              .slice(0, 10); // Top 10 descriptions for embedding
          } catch {
            // Some apps may not have actions or may error
          }
        }

        const categoryNames = (app.categories ?? [])
          .map((c: any) => c.name ?? c.slug)
          .filter(Boolean);

        const embeddingText = buildEmbeddingText(
          app.title,
          categoryNames,
          actionDescriptions,
        );

        // Upsert into app_catalog
        const supabase = getSupabase();
        await supabase.from("app_catalog").upsert(
          {
            app_key: app.key,
            slug: app.slug ?? app.key.toLowerCase(),
            title: app.title,
            categories: JSON.stringify(app.categories ?? []),
            auth_type: app.auth_type ?? null,
            action_count: actionCount,
            embedding_text: embeddingText,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "app_key" }
        );

        appsInserted++;
      }

      log(`  Processed ${Math.min(i + BATCH, apps.length)}/${apps.length} apps`);

      // Rate limit if fetching actions
      if (!appsOnly && i + BATCH < apps.length) {
        await sleep(500);
      }
    }

    log(`Inserted/updated ${appsInserted} apps in app_catalog`);
  }

  // Embed all apps in DB — paginate to avoid Supabase's 1000-row default cap
  log("Embedding app catalog into vector index...");
  const supabaseEmbed = getSupabase();
  const PAGE = 1000;
  let offset = 0;
  const appsWithText: any[] = [];
  while (true) {
    const { data: page } = await supabaseEmbed
      .from("app_catalog")
      .select("*")
      .not("embedding_text", "is", null)
      .range(offset, offset + PAGE - 1);
    if (!page || page.length === 0) break;
    appsWithText.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }

  await indexAppCatalog(
    appsWithText.map((a: any) => ({
      appKey: a.app_key,
      title: a.title,
      categories: a.categories,
      embeddingText: a.embedding_text,
    })),
  );

  log(`Embedded ${appsWithText.length} apps into vector index`);

  return { appsInserted, appsEmbedded: appsWithText.length };
}

function buildEmbeddingText(
  title: string,
  categories: string[],
  actionDescriptions: string[],
): string {
  const parts = [title];
  if (categories.length > 0) {
    parts.push(`Categories: ${categories.join(", ")}`);
  }
  if (actionDescriptions.length > 0) {
    parts.push(`Actions: ${actionDescriptions.join(". ")}`);
  }
  return parts.join(". ");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
