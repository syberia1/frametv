/**
 * frameXTV — Kino plugin 1.2.1
 * Contract: apiVersion 6, capabilities search/home/browse/episodes/resolve/download
 * Backend: https://api.framextv.cc (mirrors .xyz/.tech/.pro)
 */
const DEFAULT_API = "https://api.framextv.cc";
const API_FALLBACKS = [
  "https://api.framextv.cc",
  "https://api.framextv.xyz",
  "https://api.framextv.tech",
  "https://api.framextv.pro"
];
const SITE = "https://framextv.cc";
const UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
const ID_RE = /^[A-Za-z0-9._~-]{1,128}$/;

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
  "little_prince"
];

const PROVIDER_LABEL = {
  bowler: "Bowler",
  executioner: "Executioner",
  titan: "Titan",
  giant: "Giant",
  grand_warden: "Grand Warden",
  root_rider: "Root Rider",
  archer_queen: "Archer Queen",
  hog_rider: "Hog Rider",
  lavahound: "Lava Hound",
  sparky: "Sparky",
  super_barbarian: "Super Barbarian",
  barbarian_king: "Barbarian King",
  battle_copter: "Battle Copter",
  little_prince: "Little Prince"
};

const RAILS = [
  { id: "trending_movies", title: "Tendencias" },
  { id: "popular_movies", title: "Peliculas populares" },
  { id: "popular_tv", title: "Series populares" },
  { id: "popular_anime", title: "Anime popular" },
  { id: "airing_anime", title: "Anime en emision" },
  { id: "new_releases", title: "Estrenos" },
  { id: "action_movies", title: "Accion" },
  { id: "scifi_movies", title: "Ciencia ficcion" },
  { id: "thriller_movies", title: "Thriller" },
  { id: "comedy_movies", title: "Comedia" }
];

function log() {
  try {
    const parts = [];
    for (let i = 0; i < arguments.length; i++) parts.push(String(arguments[i]));
    kino.log(parts.join(" "));
  } catch (e) {}
}

function cfg(key, fallback) {
  try {
    if (kino.config && typeof kino.config.get === "function") {
      const v = kino.config.get(key);
      if (v !== undefined && v !== null && String(v) !== "") return v;
    }
  } catch (e) {}
  return fallback;
}

function apiBase() {
  const v = String(cfg("apiBase", DEFAULT_API) || DEFAULT_API).replace(/\/+$/, "");
  for (let i = 0; i < API_FALLBACKS.length; i++) {
    if (v === API_FALLBACKS[i]) return v;
  }
  return DEFAULT_API;
}

function preferredProvider() {
  const v = String(cfg("provider", "auto") || "auto");
  return v !== "auto" ? v : "";
}

function err(code, detail, userMessage) {
  return kino.error(code, String(detail || "").slice(0, 200), {
    userMessage: String(userMessage || detail || "").slice(0, 200)
  });
}

function bodyText(r) {
  if (!r) return "";
  try {
    if (typeof r.text === "function") return String(r.text() || "");
  } catch (e) {}
  try {
    if (typeof r.text === "string") return r.text;
  } catch (e) {}
  return "";
}

async function fetchJson(url) {
  const r = await kino.fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      Origin: SITE,
      Referer: SITE + "/"
    }
  });
  if (!r || !r.ok) {
    throw new Error("HTTP " + (r ? r.status : 0) + " " + url);
  }
  const text = bodyText(r).trim();
  if (!text) throw new Error("empty body " + url);
  return JSON.parse(text);
}

async function apiGet(path) {
  const bases = [apiBase()];
  for (let i = 0; i < API_FALLBACKS.length; i++) {
    if (API_FALLBACKS[i] !== bases[0]) bases.push(API_FALLBACKS[i]);
  }
  let last = null;
  for (let i = 0; i < bases.length; i++) {
    try {
      const data = await fetchJson(bases[i] + path);
      return data;
    } catch (e) {
      last = e;
      log("apiGet fail", bases[i] + path, (e && e.message) || e);
    }
  }
  throw last || new Error("api down");
}

function absImg(u) {
  u = String(u || "").trim();
  if (!u) return "";
  if (u.indexOf("//") === 0) return "https:" + u;
  if (/^https?:\/\//i.test(u)) return u.slice(0, 2048);
  if (u.charAt(0) === "/") return ("https://image.tmdb.org" + u).slice(0, 2048);
  return "";
}

function resultsOf(data) {
  if (!data) return [];
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
}

/** Catalog item — fields allowed by the contract. */
function toItem(row) {
  if (!row) return null;
  const id = String(row.id == null ? "" : row.id).trim();
  if (!ID_RE.test(id)) return null;
  const type = String(row.type || "movie").toLowerCase();
  const title = String(row.title || id).replace(/\s+/g, " ").trim().slice(0, 200);
  if (!title) return null;
  const kind = type === "movie" ? "movie" : "series";
  // item.id: contract itemIdPattern ^[A-Za-z0-9._~-]{1,128}$  (NO colon)
  const ref = "a:" + type + ":" + id;
  const item = {
    id: type + "-" + id,
    ref: ref,
    title: title,
    kind: kind
  };
  const poster = absImg(row.poster || row.image || "");
  if (poster) item.poster = poster;
  if (row.year) item.year = String(row.year).slice(0, 9);
  if (row.overview) item.overview = String(row.overview).replace(/<[^>]*>/g, "").slice(0, 400);
  if (row.rating != null && row.rating !== "") {
    const n = parseFloat(row.rating);
    if (!isNaN(n) && n >= 0 && n <= 10) item.rating = n;
  }
  if (type === "anime") {
    try {
      kino.storage.set("animeTitle:" + id, title, { ttlMs: 14 * 86400000 });
    } catch (e) {}
  }
  return item;
}

function mapItems(rows, limit) {
  const out = [];
  const list = rows || [];
  const max = limit || 40;
  for (let i = 0; i < list.length && out.length < max; i++) {
    const it = toItem(list[i]);
    if (it) out.push(it);
  }
  return out;
}

/** search(query: KinoSearchQuery) → Item[] */
export async function search(query) {
  let q = "";
  try {
    if (typeof query === "string") q = query;
    else if (query && typeof query === "object") {
      q = String(query.q || query.originalTitle || "");
      if (!q && query.altTitles && query.altTitles[0]) q = String(query.altTitles[0]);
    }
  } catch (e) {}
  q = String(q || "").replace(/\s+/g, " ").trim().slice(0, 100);
  if (q.length < 1) return [];

  log("search", q);
  try {
    const data = await apiGet("/api/search?q=" + encodeURIComponent(q) + "&page=1");
    const items = mapItems(resultsOf(data), 40);
    log("search ok", items.length);
    return items;
  } catch (e) {
    log("search err", (e && e.message) || e);
    return [];
  }
}

/**
 * home() → HomeRow[]
 * Each row needs id, title, ref (for browse / "Ver más"), items.
 */
export async function home() {
  const out = [];
  log("home start", apiBase());

  try {
    const data = await apiGet("/api/home");
    const rails = (data && data.rails) || {};
    for (let i = 0; i < RAILS.length; i++) {
      const meta = RAILS[i];
      const rail = rails[meta.id];
      if (!rail) continue;
      const items = mapItems(resultsOf(rail), 24);
      if (!items.length) continue;
      // Contract/archive pattern: id + title + ref + items
      out.push({
        id: meta.id,
        title: meta.title,
        ref: meta.id,
        items: items
      });
    }
    log("home rails", out.length);
  } catch (e) {
    log("home err", (e && e.message) || e);
  }

  if (!out.length) {
    try {
      const tr = await apiGet("/api/trending?page=1");
      const items = mapItems(resultsOf(tr), 24);
      if (items.length) {
        out.push({ id: "trending", title: "Tendencias", ref: "trending", items: items });
      }
      log("home trending", items.length);
    } catch (e) {
      log("home trending err", (e && e.message) || e);
    }
  }

  if (!out.length) {
    try {
      const s = await apiGet("/api/search?q=movie&page=1");
      const items = mapItems(resultsOf(s), 24);
      if (items.length) {
        out.push({ id: "catalog", title: "Catalogo", ref: "catalog", items: items });
      }
      log("home catalog", items.length);
    } catch (e) {
      log("home catalog err", (e && e.message) || e);
    }
  }

  return out;
}

/** browse(ref, cursor) → { items, next } */
export async function browse(ref, cursor) {
  await null; // never throw before first await (archive pattern)
  const key = String(ref || "");
  const page = cursor ? parseInt(cursor, 10) : 1;
  const pageNum = page >= 1 && page <= 100 ? page : 1;

  const railMeta = RAILS.filter(function (r) {
    return r.id === key;
  })[0];
  if (railMeta || key === "catalog") {
    try {
      const data = await apiGet("/api/home");
      const rail = ((data && data.rails) || {})[key];
      return { items: mapItems(resultsOf(rail), 40), next: null };
    } catch (e) {
      throw err("unavailable", String((e && e.message) || e), "No se pudo cargar el catalogo.");
    }
  }

  try {
    const data = await apiGet("/api/trending?page=" + pageNum);
    const items = mapItems(resultsOf(data), 40);
    const total = parseInt(data.totalPages || 1, 10) || 1;
    return { items: items, next: pageNum < total ? String(pageNum + 1) : null };
  } catch (e) {
    throw err("unavailable", String((e && e.message) || e), "No se pudo cargar el catalogo.");
  }
}

async function mapAnimeToTv(anilistId, title) {
  try {
    const cached = kino.storage.get("animeMap:" + anilistId);
    if (cached) return String(cached);
  } catch (e) {}
  const q = String(title || "").trim();
  if (!q) return null;
  try {
    const data = await apiGet("/api/search?q=" + encodeURIComponent(q));
    const rows = resultsOf(data);
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i].type).toLowerCase() === "tv") {
        const tid = String(rows[i].id);
        try {
          kino.storage.set("animeMap:" + anilistId, tid, { ttlMs: 30 * 86400000 });
        } catch (e) {}
        return tid;
      }
    }
  } catch (e) {}
  return null;
}

/** episodes(ref) → { series, episodes } */
export async function episodes(ref) {
  await null;
  const m = /^a:(movie|tv|anime):([A-Za-z0-9._~-]+)$/.exec(String(ref || ""));
  if (!m) throw err("not_found", "ref " + ref, "Titulo no valido.");
  const origType = m[1];
  let type = m[1];
  let id = m[2];

  if (type === "movie") {
    const data = await apiGet("/api/movies/" + encodeURIComponent(id));
    const series = {
      title: String(data.title || id).slice(0, 200),
      overview: String(data.overview || "").slice(0, 2000),
      poster: absImg(data.poster || ""),
      backdrop: absImg(data.backdrop || data.poster || "")
    };
    return {
      series: series,
      episodes: [
        {
          season: 1,
          number: 1,
          ref: "e:movie:" + id + ":1:1",
          title: series.title,
          still: series.poster || ""
        }
      ]
    };
  }

  let tvId = id;
  if (type === "anime") {
    let title = "";
    try {
      title = kino.storage.get("animeTitle:" + id) || "";
    } catch (e) {}
    const mapped = await mapAnimeToTv(id, title);
    if (mapped) {
      tvId = mapped;
      type = "tv";
    }
  }

  let detail;
  try {
    detail = await apiGet("/api/tv/" + encodeURIComponent(tvId));
  } catch (e) {
    if (origType === "anime") {
      return {
        series: { title: String(id), overview: "", poster: "", backdrop: "" },
        episodes: [
          {
            season: 1,
            number: 1,
            ref: "e:anime:" + id + ":1:1",
            title: "Capitulo 1",
            still: ""
          }
        ]
      };
    }
    throw err("not_found", "tv " + tvId, "No se encontro la serie.");
  }

  const series = {
    title: String(detail.title || tvId).slice(0, 200),
    overview: String(detail.overview || "").slice(0, 2000),
    poster: absImg(detail.poster || ""),
    backdrop: absImg(detail.backdrop || detail.poster || "")
  };

  const seasons = Array.isArray(detail.seasons) ? detail.seasons : [];
  const list = [];
  const started = Date.now();
  for (let i = 0; i < seasons.length; i++) {
    if (Date.now() - started > 16000) break;
    const sn = parseInt(seasons[i].season_number, 10);
    if (!sn || sn < 1) continue;
    try {
      const season = await apiGet("/api/tv/" + encodeURIComponent(tvId) + "/season/" + sn);
      const eps = Array.isArray(season.episodes) ? season.episodes : [];
      for (let j = 0; j < eps.length; j++) {
        const ep = eps[j];
        const num = parseInt(ep.episode_number || ep.number, 10);
        if (!num) continue;
        list.push({
          season: sn,
          number: num,
          ref: "e:tv:" + tvId + ":" + sn + ":" + num,
          title: ep.name ? String(ep.name).slice(0, 200) : "Capitulo " + num,
          still: absImg(ep.still || ep.still_path || series.poster || "")
        });
      }
    } catch (e) {
      log("season fail", sn, (e && e.message) || e);
    }
  }

  if (!list.length) {
    list.push({
      season: 1,
      number: 1,
      ref: "e:" + type + ":" + tvId + ":1:1",
      title: "Capitulo 1",
      still: series.poster || ""
    });
  }

  list.sort(function (a, b) {
    return a.season === b.season ? a.number - b.number : a.season - b.season;
  });
  log("episodes", type + ":" + tvId, list.length);
  return { series: series, episodes: list };
}

function parsePlayRef(ref) {
  let m = /^s:([a-z0-9_]+):e:(movie|tv|anime):([A-Za-z0-9._~-]+):(\d+):(\d+)$/.exec(
    String(ref || "")
  );
  if (m) {
    return {
      provider: m[1],
      type: m[2],
      id: m[3],
      season: parseInt(m[4], 10),
      episode: parseInt(m[5], 10)
    };
  }
  m = /^e:(movie|tv|anime):([A-Za-z0-9._~-]+):(\d+):(\d+)$/.exec(String(ref || ""));
  if (m) {
    return {
      provider: "",
      type: m[1],
      id: m[2],
      season: parseInt(m[3], 10),
      episode: parseInt(m[4], 10)
    };
  }
  return null;
}

function pickSources(data) {
  const out = [];
  const rows = (data && data.sources) || [];
  for (let i = 0; i < rows.length; i++) {
    const s = rows[i];
    if (!s || !s.url) continue;
    const url = String(s.url).trim();
    if (!/^https?:\/\//i.test(url)) continue;
    const quality = String(s.quality || "").trim();
    const server = String(s.server || data.provider || "Server").trim();
    let label = server;
    if (quality && label.toLowerCase().indexOf(quality.toLowerCase()) < 0) {
      label = label + " · " + quality;
    }
    const isMp4 = /\.mp4(\?|$)/i.test(url) || /mp4/i.test(quality);
    out.push({
      url: url,
      label: label.slice(0, 80),
      quality: quality,
      mime: isMp4 ? "video/mp4" : undefined,
      headers: { "User-Agent": UA, Referer: SITE + "/" }
    });
  }
  out.sort(function (a, b) {
    return (a.mime ? 0 : 1) - (b.mime ? 0 : 1);
  });
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
  const data = await apiGet(path);
  return {
    provider: data.provider || provider || "",
    sources: pickSources(data),
    alternates: Array.isArray(data.alternates) ? data.alternates : [],
    subtitles: Array.isArray(data.subtitles) ? data.subtitles : []
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
      label: String(s.label || s.language || "Subs").slice(0, 60)
    });
    if (out.length >= 8) break;
  }
  return out;
}

/**
 * resolve(ref) → Stream
 * download capability: same URL Kino uses to save offline.
 */
export async function resolve(ref) {
  await null;
  const p = parsePlayRef(ref);
  if (!p) throw err("not_found", "ref " + ref, "Enlace no valido.");

  const pref = p.provider || preferredProvider();
  log("resolve", p.type, p.id, "s" + p.season + "e" + p.episode, pref || "auto");

  if (p.provider) {
    const one = await fetchProviderStream(p.type, p.id, p.season, p.episode, p.provider);
    if (!one.sources.length) {
      throw err("unavailable", p.provider, "Este servidor no tiene video. Prueba otro.");
    }
    const main = one.sources[0];
    const stream = {
      url: main.url,
      headers: main.headers,
      label: main.label || PROVIDER_LABEL[p.provider] || p.provider,
      expiresInSeconds: 3600
    };
    if (main.mime) stream.mime = main.mime;
    if (one.sources.length > 1) {
      stream.alternatives = one.sources.slice(1, 6).map(function (s) {
        const a = { url: s.url, headers: s.headers, label: s.label };
        if (s.mime) a.mime = s.mime;
        return a;
      });
    }
    const tracks = subtitleTracks(one.subtitles);
    if (tracks.length) stream.subtitles = tracks;
    return stream;
  }

  let primary = null;
  let usedProvider = "";
  let subtitles = [];
  let alternateProviders = [];
  let extras = [];

  try {
    const first = await fetchProviderStream(p.type, p.id, p.season, p.episode, pref || "");
    if (first.sources.length) {
      primary = first.sources[0];
      usedProvider = first.provider || pref || "auto";
      subtitles = first.subtitles || [];
      extras = first.sources.slice(1, 4);
    }
    alternateProviders = (first.alternates || []).filter(function (n) {
      return n && n !== usedProvider;
    });
  } catch (e) {
    log("resolve first", (e && e.message) || e);
  }

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
          extras = got.sources.slice(1, 4);
          alternateProviders = (got.alternates || []).filter(function (n) {
            return n && n !== usedProvider;
          });
        }
      } catch (e) {
        log("resolve", order[i], (e && e.message) || e);
      }
    }
  }

  if (!primary) {
    throw err("unavailable", "no sources", "No hay servidores disponibles.");
  }

  const stream = {
    url: primary.url,
    headers: primary.headers,
    label: primary.label || PROVIDER_LABEL[usedProvider] || usedProvider || "Servidor",
    expiresInSeconds: 3600
  };
  if (primary.mime) stream.mime = primary.mime;

  const alternatives = [];
  for (let i = 0; i < extras.length; i++) {
    const a = {
      url: extras[i].url,
      headers: extras[i].headers,
      label: extras[i].label
    };
    if (extras[i].mime) a.mime = extras[i].mime;
    alternatives.push(a);
  }
  const names = alternateProviders.slice();
  for (let i = 0; i < PROVIDERS.length; i++) {
    if (PROVIDERS[i] !== usedProvider && names.indexOf(PROVIDERS[i]) < 0) {
      names.push(PROVIDERS[i]);
    }
  }
  for (let i = 0; i < names.length && alternatives.length < 12; i++) {
    const name = String(names[i]);
    if (!name || name === usedProvider) continue;
    alternatives.push({
      label: PROVIDER_LABEL[name] || name,
      ref: "s:" + name + ":e:" + p.type + ":" + p.id + ":" + p.season + ":" + p.episode
    });
  }
  if (alternatives.length) stream.alternatives = alternatives.slice(0, 12);

  const tracks = subtitleTracks(subtitles);
  if (tracks.length) stream.subtitles = tracks;

  log("resolve OK", stream.label, "alts", alternatives.length);
  return stream;
}
