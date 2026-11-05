// frameXTV Kino plugin 1.0.0 — https://framextv.cc
// API: api.framextv.*  |  streams via /api/stream?id=&type=&provider=
// QuickJS: r.text() method, no setTimeout/fetch/URL as globals.

const DEFAULT_API = "https://api.framextv.cc";
const SITE = "https://framextv.cc";
const UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
const ID_OK = /^[A-Za-z0-9._~-]{1,128}$/;

// Providers known from /api/providers (order = preference when auto)
const PROVIDERS = [
  "bowler",
  "executioner",
  "titan",
  "giant",
  "grand_warden",
  "root_rider",
  "archer_queen",
  "hog_rider",
  "lavahound",
  "sparky",
  "super_barbarian",
  "barbarian_king",
  "battle_copter",
  "little_prince",
  "headhunter",
  "miner",
  "valkyrie",
  "druid",
  "monk",
  "skeleton_king",
];

const PROVIDER_LABEL = {
  bowler: "Bowler XVIII",
  executioner: "Executioner I",
  titan: "Titan VII",
  giant: "Giant XI",
  grand_warden: "Grand Warden I",
  root_rider: "Root Rider I",
  archer_queen: "Archer Queen I",
  hog_rider: "Hog Rider XI",
  lavahound: "Lava Hound XII",
  sparky: "Sparky I",
  super_barbarian: "Super Barbarian XVI",
  barbarian_king: "Barbarian King I",
  battle_copter: "Battle Copter I",
  little_prince: "Little Prince I",
  headhunter: "Headhunter",
  miner: "Miner",
  valkyrie: "Valkyrie",
  druid: "Druid",
  monk: "Monk",
  skeleton_king: "Skeleton King",
  royal_champion: "Royal Champion",
  dragon_rider: "Dragon Rider",
  electro_dragon: "Electro Dragon",
  minion_prince: "Minion Prince",
  bandit: "Bandit",
};

const RAIL_TITLES = {
  trending_movies: "Tendencias",
  popular_movies: "Peliculas populares",
  popular_tv: "Series populares",
  popular_anime: "Anime popular",
  new_releases: "Estrenos",
  action_movies: "Accion",
  scifi_movies: "Ciencia ficcion",
  thriller_movies: "Thriller",
  comedy_movies: "Comedia",
  airing_anime: "Anime en emision",
};

const TXT = {
  notFound: { es: "No encontramos esto en frameXTV.", en: "We could not find this on frameXTV." },
  siteDown: { es: "frameXTV no responde ahora. Intenta mas tarde.", en: "frameXTV is not answering now. Try again later." },
  noServers: { es: "No hay servidores disponibles para este titulo.", en: "No servers available for this title." },
  serverFailed: { es: "No se pudo abrir el video. Prueba otro en el menu Servidor.", en: "Could not open the video. Try another one in the Servidor menu." },
  badRef: { es: "Este titulo ya no es valido. Buscalo otra vez.", en: "This title is no longer valid. Search again." },
  noEpisodes: { es: "No se pudieron cargar los capitulos.", en: "Could not load the episodes." },
  episode: { es: "Capitulo ", en: "Episode " },
};

function lang() {
  return String(kino.lang || "es").toLowerCase().indexOf("en") === 0 ? "en" : "es";
}
function t(key) {
  const row = TXT[key];
  return row ? row[lang()] || row.es : key;
}
function fail(code, detail, key) {
  return kino.error(code, String(detail || "").slice(0, 200), { userMessage: t(key) });
}

function bodyText(r) {
  if (!r) return "";
  try {
    if (typeof r.text === "function") return String(r.text() || "");
  } catch (e) {}
  if (typeof r.text === "string") return r.text;
  return "";
}

function apiBase() {
  try {
    const c = kino.config && (kino.config.apiBase || (kino.config.get && kino.config.get("apiBase")));
    if (c && /^https:\/\/api\.framextv\.(cc|xyz|tech|pro)$/.test(String(c))) return String(c).replace(/\/+$/, "");
  } catch (e) {}
  return DEFAULT_API;
}

function preferredProvider() {
  try {
    const c = kino.config && (kino.config.provider || (kino.config.get && kino.config.get("provider")));
    if (c && c !== "auto") return String(c);
  } catch (e) {}
  return "";
}

async function apiGet(path, timeoutMs) {
  const url = apiBase() + path;
  const r = await kino.fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      Origin: SITE,
      Referer: SITE + "/",
    },
    timeoutMs: timeoutMs || 15000,
  });
  if (!r || !r.ok) {
    throw fail("unavailable", "HTTP " + (r ? r.status : 0) + " " + path, "siteDown");
  }
  const text = bodyText(r).trim();
  if (!text) throw fail("unavailable", "empty " + path, "siteDown");
  try {
    return JSON.parse(text);
  } catch (e) {
    throw fail("unavailable", "JSON " + path, "siteDown");
  }
}

function absImg(u) {
  u = String(u || "").trim();
  if (!u) return "";
  if (u.indexOf("//") === 0) return "https:" + u;
  if (/^https?:\/\//i.test(u)) return u;
  if (u.charAt(0) === "/") return "https://image.tmdb.org" + u;
  return u;
}

function kindOf(type) {
  const x = String(type || "").toLowerCase();
  if (x === "movie") return "movie";
  return "series"; // tv + anime
}

function mediaType(type) {
  const x = String(type || "").toLowerCase();
  if (x === "movie") return "movie";
  if (x === "anime") return "anime";
  return "tv";
}

function mkItem(row) {
  if (!row) return null;
  const id = String(row.id || "").trim();
  if (!id || !ID_OK.test(id)) return null;
  const type = String(row.type || "movie").toLowerCase();
  const title = String(row.title || id).slice(0, 200);
  const poster = absImg(row.poster || row.image || "");
  const item = {
    id: type + ":" + id,
    kind: kindOf(type),
    title: title,
    ref: "a:" + type + ":" + id,
  };
  if (poster) item.poster = poster;
  if (row.year) item.year = String(row.year).slice(0, 4);
  if (row.rating) {
    try {
      item.rating = parseFloat(row.rating);
    } catch (e) {}
  }
  // Cache anime title for later AniList→TMDB mapping in episodes()
  if (type === "anime" && title) {
    try {
      kino.storage.set("animeTitle:" + id, title, { ttlMs: 14 * 86400000 });
    } catch (e) {}
  }
  return item;
}

function resultsOf(data) {
  if (!data) return [];
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
}

export async function search(query) {
  const q = String((query && query.q) || "").replace(/\s+/g, " ").trim().slice(0, 100);
  if (q.length < 1) return [];
  const page = Math.max(1, parseInt((query && query.cursor) || "1", 10) || 1);
  try {
    const data = await apiGet("/api/search?q=" + encodeURIComponent(q) + "&page=" + page, 12000);
    const items = [];
    const rows = resultsOf(data);
    for (let i = 0; i < rows.length; i++) {
      const it = mkItem(rows[i]);
      if (it) items.push(it);
    }
    return items.slice(0, 40);
  } catch (e) {
    kino.log("search: " + ((e && e.message) || e));
    return [];
  }
}

export async function home() {
  const rows = [];
  let data;
  try {
    data = await apiGet("/api/home", 15000);
  } catch (e) {
    kino.log("home: " + ((e && e.message) || e));
    return rows;
  }

  const rails = (data && data.rails) || {};
  const order = [
    "trending_movies",
    "popular_movies",
    "popular_tv",
    "popular_anime",
    "airing_anime",
    "new_releases",
    "action_movies",
    "scifi_movies",
    "thriller_movies",
    "comedy_movies",
  ];

  for (let i = 0; i < order.length; i++) {
    const key = order[i];
    const rail = rails[key];
    if (!rail) continue;
    const list = resultsOf(rail);
    if (!list.length) continue;
    const items = [];
    for (let j = 0; j < list.length && items.length < 24; j++) {
      const it = mkItem(list[j]);
      if (it) items.push(it);
    }
    if (items.length) {
      rows.push({
        id: key,
        title: RAIL_TITLES[key] || key,
        items: items,
      });
    }
  }

  // Fallback trending if rails empty
  if (!rows.length) {
    try {
      const tr = await apiGet("/api/trending?page=1", 12000);
      const items = resultsOf(tr)
        .map(mkItem)
        .filter(Boolean)
        .slice(0, 24);
      if (items.length) rows.push({ id: "trending", title: "Tendencias", items: items });
    } catch (e) {
      kino.log("home trending: " + ((e && e.message) || e));
    }
  }

  kino.log("home rows=" + rows.length);
  return rows;
}

export async function browse(ref, cursor) {
  const page = Math.max(1, parseInt(cursor || "1", 10) || 1);
  let path = "/api/trending?page=" + page;
  if (ref === "trending_movies" || ref === "trending") path = "/api/trending?page=" + page;
  else if (ref === "popular_movies" || ref === "movies") path = "/api/search?q=a&page=" + page;
  else if (ref && RAIL_TITLES[ref]) {
    // Re-fetch home and slice that rail; pagination limited
    try {
      const home = await apiGet("/api/home", 12000);
      const rail = ((home && home.rails) || {})[ref];
      const items = resultsOf(rail).map(mkItem).filter(Boolean);
      return { items: items, next: null };
    } catch (e) {
      throw fail("unavailable", String(e && e.message), "siteDown");
    }
  }

  const data = await apiGet(path, 12000);
  const items = resultsOf(data).map(mkItem).filter(Boolean);
  const totalPages = parseInt(data.totalPages || 1, 10) || 1;
  const next = page < totalPages ? String(page + 1) : null;
  return { items: items, next: next };
}

async function resolveAnimeToTv(anilistId, title) {
  // popular_anime uses AniList ids; map to TMDB tv via search
  const q = String(title || "").trim();
  if (q) {
    try {
      const data = await apiGet("/api/search?q=" + encodeURIComponent(q), 10000);
      const rows = resultsOf(data);
      for (let i = 0; i < rows.length; i++) {
        if (String(rows[i].type).toLowerCase() === "tv") {
          try {
            kino.storage.set("animeMap:" + anilistId, String(rows[i].id), { ttlMs: 30 * 86400000 });
          } catch (e) {}
          return String(rows[i].id);
        }
      }
    } catch (e) {}
  }
  try {
    const cached = kino.storage.get("animeMap:" + anilistId);
    if (cached) return String(cached);
  } catch (e) {}
  // Optional: Kino's TMDB (0.9.53+) when title is known
  if (q && typeof kino.tmdb === "function") {
    try {
      const res = await kino.tmdb("/search/tv?query=" + encodeURIComponent(q));
      const results = (res && res.results) || [];
      if (results[0] && results[0].id) {
        const tid = String(results[0].id);
        try {
          kino.storage.set("animeMap:" + anilistId, tid, { ttlMs: 30 * 86400000 });
        } catch (e) {}
        return tid;
      }
    } catch (e) {}
  }
  return null;
}

export async function episodes(ref) {
  const m = /^a:(movie|tv|anime):([A-Za-z0-9._~-]+)$/.exec(String(ref || ""));
  if (!m) throw fail("not_found", "ref " + ref, "badRef");
  let type = m[1];
  let id = m[2];

  // Movies: single playable item
  if (type === "movie") {
    const data = await apiGet("/api/movies/" + encodeURIComponent(id), 14000);
    const series = {
      title: String(data.title || id).slice(0, 200),
      overview: String(data.overview || "").slice(0, 2000),
      poster: absImg(data.poster || ""),
      backdrop: absImg(data.backdrop || data.poster || ""),
    };
    return {
      series: series,
      episodes: [
        {
          season: 1,
          number: 1,
          ref: "e:movie:" + id + ":1:1",
          title: series.title,
          still: series.poster || "",
        },
      ],
    };
  }

  // Anime rails use AniList ids — map to TMDB TV via cached title + search
  let tvId = id;
  let detail = null;
  if (type === "anime") {
    let animeTitle = "";
    try {
      animeTitle = kino.storage.get("animeTitle:" + id) || "";
    } catch (e) {}
    const mapped = await resolveAnimeToTv(id, animeTitle);
    if (mapped) {
      tvId = mapped;
      type = "tv";
      try {
        detail = await apiGet("/api/tv/" + encodeURIComponent(tvId), 12000);
      } catch (e) {
        detail = null;
      }
    }
  }

  if (!detail) {
    try {
      detail = await apiGet("/api/tv/" + encodeURIComponent(tvId), 14000);
    } catch (e) {
      throw fail("not_found", "tv " + tvId, "notFound");
    }
  }

  const series = {
    title: String(detail.title || tvId).slice(0, 200),
    overview: String(detail.overview || "").slice(0, 2000),
    poster: absImg(detail.poster || ""),
    backdrop: absImg(detail.backdrop || detail.poster || ""),
  };

  const seasons = Array.isArray(detail.seasons) ? detail.seasons : [];
  const list = [];
  const T = Date.now();

  for (let i = 0; i < seasons.length; i++) {
    if (Date.now() - T > 16000) break;
    const sn = parseInt(seasons[i].season_number, 10);
    if (!sn || sn < 1) continue; // skip specials (0)
    try {
      const season = await apiGet(
        "/api/tv/" + encodeURIComponent(tvId) + "/season/" + sn,
        10000
      );
      const eps = Array.isArray(season.episodes) ? season.episodes : [];
      for (let j = 0; j < eps.length; j++) {
        const ep = eps[j];
        const num = parseInt(ep.episode_number || ep.number, 10);
        if (!num) continue;
        list.push({
          season: sn,
          number: num,
          ref: "e:tv:" + tvId + ":" + sn + ":" + num,
          title: ep.name ? String(ep.name).slice(0, 200) : t("episode") + num,
          still: absImg(ep.still || ep.still_path || series.poster || ""),
        });
      }
    } catch (e) {
      kino.log("season " + sn + ": " + ((e && e.message) || e));
    }
  }

  // Anime fallback: no seasons → one playable entry (episode 1)
  if (!list.length && m[1] === "anime") {
    list.push({
      season: 1,
      number: 1,
      ref: "e:anime:" + id + ":1:1",
      title: t("episode") + "1",
      still: series.poster || "",
    });
  }

  if (!list.length) throw fail("not_found", "0 episodes", "noEpisodes");
  list.sort(function (a, b) {
    return a.season === b.season ? a.number - b.number : a.season - b.season;
  });

  kino.log("episodes " + type + ":" + tvId + " -> " + list.length);
  return { series: series, episodes: list };
}

function parsePlayRef(ref) {
  // e:movie:550:1:1 | e:tv:1396:1:1 | e:anime:16498:1:1
  // s:bowler:e:movie:550:1:1  (specific provider)
  let m = /^s:([a-z0-9_]+):e:(movie|tv|anime):([A-Za-z0-9._~-]+):(\d+):(\d+)$/.exec(String(ref || ""));
  if (m) {
    return {
      provider: m[1],
      type: m[2],
      id: m[3],
      season: parseInt(m[4], 10),
      episode: parseInt(m[5], 10),
    };
  }
  m = /^e:(movie|tv|anime):([A-Za-z0-9._~-]+):(\d+):(\d+)$/.exec(String(ref || ""));
  if (m) {
    return {
      provider: "",
      type: m[1],
      id: m[2],
      season: parseInt(m[3], 10),
      episode: parseInt(m[4], 10),
    };
  }
  return null;
}

function streamHeaders(src) {
  const h = { "User-Agent": UA };
  // Workers proxy already embeds origin/ref; still send a sensible Referer
  h.Referer = SITE + "/";
  if (src && src.headers && typeof src.headers === "object") {
    for (const k in src.headers) {
      if (Object.prototype.hasOwnProperty.call(src.headers, k)) h[k] = src.headers[k];
    }
  }
  return h;
}

function pickSources(data) {
  const out = [];
  const rows = (data && data.sources) || [];
  for (let i = 0; i < rows.length; i++) {
    const s = rows[i];
    if (!s || !s.url) continue;
    let url = String(s.url).trim();
    if (!/^https?:\/\//i.test(url)) continue;
    const quality = String(s.quality || "").trim();
    const server = String(s.server || data.provider || "Server").trim();
    let label = server;
    if (quality && label.toLowerCase().indexOf(quality.toLowerCase()) < 0) {
      label = label + " · " + quality;
    }
    out.push({
      url: url,
      label: label.slice(0, 80),
      quality: quality,
      type: String(s.type || "hls"),
      headers: streamHeaders(s),
    });
  }
  return out;
}

async function fetchProviderStream(type, id, season, episode, provider) {
  let path =
    "/api/stream?id=" +
    encodeURIComponent(id) +
    "&type=" +
    encodeURIComponent(type === "anime" ? "anime" : type === "movie" ? "movie" : "tv");
  if (type !== "movie") {
    path += "&season=" + encodeURIComponent(String(season || 1));
    path += "&episode=" + encodeURIComponent(String(episode || 1));
  }
  if (provider) path += "&provider=" + encodeURIComponent(provider);

  const data = await apiGet(path, 18000);
  const sources = pickSources(data);
  const alts = Array.isArray(data.alternates) ? data.alternates : [];
  const errors = Array.isArray(data.errors) ? data.errors : [];
  const subs = Array.isArray(data.subtitles) ? data.subtitles : [];
  return {
    provider: data.provider || provider || "",
    sources: sources,
    alternates: alts,
    errors: errors,
    subtitles: subs,
  };
}

function subtitleTracks(subs) {
  const out = [];
  const seen = {};
  for (let i = 0; i < (subs || []).length; i++) {
    const s = subs[i];
    if (!s || !s.url) continue;
    const url = String(s.url);
    if (seen[url]) continue;
    seen[url] = true;
    out.push({
      url: url,
      lang: String(s.language || s.lang || "und").slice(0, 16),
      label: String(s.label || s.language || "Subs").slice(0, 60),
    });
    if (out.length >= 8) break;
  }
  return out;
}

export async function resolve(ref) {
  const p = parsePlayRef(ref);
  if (!p) throw fail("not_found", "ref " + ref, "badRef");

  const pref = p.provider || preferredProvider();
  kino.log(
    "resolve " + p.type + ":" + p.id + " s" + p.season + "e" + p.episode + (pref ? " provider=" + pref : "")
  );

  // Specific provider requested (lazy alternative)
  if (p.provider) {
    const one = await fetchProviderStream(p.type, p.id, p.season, p.episode, p.provider);
    if (!one.sources.length) {
      throw fail("unavailable", p.provider + " sin video", "serverFailed");
    }
    const main = one.sources[0];
    const stream = {
      url: main.url,
      headers: main.headers,
      label: main.label || PROVIDER_LABEL[p.provider] || p.provider,
      expiresInSeconds: 1800,
    };
    if (one.sources.length > 1) {
      stream.alternatives = one.sources.slice(1, 6).map(function (s) {
        return { url: s.url, headers: s.headers, label: s.label };
      });
    }
    const tracks = subtitleTracks(one.subtitles);
    if (tracks.length) stream.subtitles = tracks;
    return stream;
  }

  // First pass: preferred or auto (API picks)
  let primary = null;
  let usedProvider = "";
  let subtitles = [];
  let alternateProviders = [];
  try {
    const first = await fetchProviderStream(p.type, p.id, p.season, p.episode, pref || "");
    if (first.sources.length) {
      primary = first.sources[0];
      usedProvider = first.provider || pref || "auto";
      subtitles = first.subtitles || [];
      // Extra qualities from same provider as immediate alternatives
      primary._extras = first.sources.slice(1, 4);
    }
    alternateProviders = (first.alternates || []).filter(function (name) {
      return name && name !== usedProvider;
    });
    // Also try failed/pending list names that look available
  } catch (e) {
    kino.log("resolve first: " + ((e && e.message) || e));
  }

  // If nothing yet, walk preferred provider list
  if (!primary) {
    const order = PROVIDERS.slice();
    if (pref) {
      order.sort(function (a, b) {
        if (a === pref) return -1;
        if (b === pref) return 1;
        return 0;
      });
    }
    for (let i = 0; i < order.length && !primary; i++) {
      try {
        const got = await fetchProviderStream(p.type, p.id, p.season, p.episode, order[i]);
        if (got.sources.length) {
          primary = got.sources[0];
          usedProvider = got.provider || order[i];
          subtitles = got.subtitles || [];
          primary._extras = got.sources.slice(1, 4);
          alternateProviders = (got.alternates || []).filter(function (n) {
            return n && n !== usedProvider;
          });
          break;
        }
      } catch (e) {
        kino.log("resolve " + order[i] + ": " + ((e && e.message) || e));
      }
    }
  }

  if (!primary) throw fail("unavailable", "ningun servidor", "noServers");

  const stream = {
    url: primary.url,
    headers: primary.headers,
    label: primary.label || PROVIDER_LABEL[usedProvider] || usedProvider || "Servidor",
    expiresInSeconds: 1800,
  };

  const alternatives = [];
  // Same-provider quality variants
  const extras = primary._extras || [];
  for (let i = 0; i < extras.length; i++) {
    alternatives.push({
      url: extras[i].url,
      headers: extras[i].headers,
      label: extras[i].label,
    });
  }
  // Lazy other providers
  for (let i = 0; i < alternateProviders.length && alternatives.length < 10; i++) {
    const name = String(alternateProviders[i]);
    if (!name || name === usedProvider) continue;
    alternatives.push({
      label: PROVIDER_LABEL[name] || name,
      ref:
        "s:" +
        name +
        ":e:" +
        p.type +
        ":" +
        p.id +
        ":" +
        p.season +
        ":" +
        p.episode,
    });
  }
  // Ensure a few known providers are listed even if API omitted them
  for (let i = 0; i < PROVIDERS.length && alternatives.length < 12; i++) {
    const name = PROVIDERS[i];
    if (name === usedProvider) continue;
    let exists = false;
    for (let j = 0; j < alternatives.length; j++) {
      if (alternatives[j].ref && alternatives[j].ref.indexOf("s:" + name + ":") === 0) {
        exists = true;
        break;
      }
    }
    if (!exists) {
      alternatives.push({
        label: PROVIDER_LABEL[name] || name,
        ref: "s:" + name + ":e:" + p.type + ":" + p.id + ":" + p.season + ":" + p.episode,
      });
    }
  }

  if (alternatives.length) stream.alternatives = alternatives.slice(0, 12);

  const tracks = subtitleTracks(subtitles);
  if (tracks.length) stream.subtitles = tracks;

  kino.log("resolve OK " + stream.label + " + " + alternatives.length + " alts");
  return stream;
}
