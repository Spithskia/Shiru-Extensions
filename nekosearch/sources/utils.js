/**
 * @typedef {Object} EpisodeCacheEntry
 * @property {string} nekoId nekoBT internal episode ID
 * @property {number|undefined} tvdbId
 * @property {number|undefined} season
 * @property {number|undefined} episode
 * @property {number|undefined} absolute
 */

/**
 * @typedef {Object} MediaCacheEntry
 * @property {string} nekoId nekoBT internal media ID
 * @property {number|undefined} tvdbId
 * @property {number|undefined} tmdbId
 * @property {string|undefined} imdbId
 * @property {EpisodeCacheEntry[]} episodes
 * @property {number} cachedAt
 * @property {number|undefined} updatedAt
 */

/** @type {number} */
const DB_VERSION = 1
/** @type {string} */
const STORE_NAME = 'keyval'
/** @type {string} */
const DB_NAME = 'keyval-store'
/** @type {number} */
const TTL_MS = 60 * 24 * 60 * 60 * 1_000 // 60 days
/** @type {Function} */
const persistCache = debounce(async () => set('nekoBTMedia', Object.fromEntries(mediaCache)), 3_000)
/** @type {Map<string, MediaCacheEntry>} Keyed by nekoBT media ID e.g. 's1234' or 'm1234' */
const mediaCache = new Map()
/** @type {Set<string>} nekoBT media IDs that were matched by similarity, not verified IDs */
const similarityMatches = new Set()
/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms).unref?.())

/**
 * @param {Function} fn
 * @param {number} [time]
 * @returns {Function}
 */
function debounce(fn, time = 0) {
  let timeout
  return (...args) => {
    const later = () => {
      timeout = null
      fn(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, time)
    timeout.unref?.()
  }
}

/**
 * Shared IndexedDB connection promise, opened once at module load.
 * @type {Promise<IDBDatabase>}
 */
const open = new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION)
  request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

/**
 * @param {string} key
 * @returns {Promise<any>}
 */
function get(key) {
  return open.then(database => new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME).objectStore(STORE_NAME).get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }))
}

/**
 * @param {string} key
 * @param {any} value
 * @returns {Promise<void>}
 */
function set(key, value) {
  return open.then(database => new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(value, key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  }))
}

/**
 * Loads the persisted media cache from IndexedDB into memory,
 * clearing out entries older than the TTL.
 *
 * @returns {Promise<void>}
 */
async function loadCache() {
  const stored = await get('nekoBTMedia')
  if (stored) {
    const now = Date.now()
    for (const [key, value] of Object.entries(stored)) {
      const age = now - (value.updatedAt ?? value.cachedAt)
      if (age < TTL_MS) mediaCache.set(key, value)
    }
    persistCache()
  }
}

await loadCache() // load cache

/**
 * Finds a cached media entry by any of its external IDs.
 *
 * @param {number|undefined} tvdbId
 * @param {number|undefined} tmdbId
 * @param {string|undefined} imdbId
 * @returns {MediaCacheEntry|undefined}
 */
function findCached(tvdbId, tmdbId, imdbId) {
  for (const entry of mediaCache.values()) {
    if ((tvdbId && entry.tvdbId === tvdbId) || (tmdbId && entry.tmdbId === tmdbId) || (imdbId && entry.imdbId === imdbId)) {
      return entry
    }
  }
}

/**
 * Resolves a nekoBT media_id from available mapping IDs.
 * Checks cache first, then queries the API by title and matches on external IDs.
 *
 * @param {string} url
 * @param {number|undefined} tvdbAid
 * @param {number|undefined} mvdbAid
 * @param {string|undefined} imdbAid
 * @param {string[]} titles
 * @returns {Promise<string|null>}
 */
export async function resolveMediaId(url, tvdbAid, mvdbAid, imdbAid, titles) {
  const cached = findCached(tvdbAid, mvdbAid, imdbAid)
  if (cached) return cached.nekoId

  for (let i = 0; i < Math.min(titles.length, 6); i++) {
    if (i > 0) await sleep(i <= 2 ? 200 : 500)
    const res = await fetch(`${url}/media/search?${new URLSearchParams({ query: titles[i], limit: '50' })}`)
    if (!res.ok) {
      const error = await res.json().catch(() => null)
      throw new Error(`Failed to query source for media id: HTTP ${res.status} ${res.statusText}${error?.message ? ` - ${error.message}` : ''}`)
    }
    /** @type { import('./types.d.ts').nekoBTSearch } */
    const data = await res.json()
    if (data.error || !data.data?.results?.length) continue
    const match = data.data.results.find(media => (tvdbAid && media.tvdbId === tvdbAid) || (mvdbAid && media.tmdbId === mvdbAid) || (imdbAid && media.imdbId === imdbAid))
    const similarMatch = data.data.results.find(media => media.similarity === 1)
    if (!match?.id && !similarMatch?.id) continue

    mediaCache.set((match || similarMatch).id, {
      nekoId: (match || similarMatch).id,
      tvdbId: (match || similarMatch).tvdbId || undefined,
      tmdbId: (match || similarMatch).tmdbId || undefined,
      imdbId: (match || similarMatch).imdbId || undefined,
      episodes: [],
      cachedAt: Date.now()
    })
    if (match?.id) persistCache() // do not persist similarity matches since they are not verified
    else similarityMatches.add((similarMatch).id)
    return (match || similarMatch).id
  }
  return null
}

/**
 * Resolves a nekoBT episode ID from a TVDB episode ID or season and absolute episode number.
 *
 * @param {string} url
 * @param {string} mediaId
 * @param {number|undefined} tvdbEid
 * @param {number|undefined} season
 * @param {number|undefined} absoluteEpisode
 * @returns {Promise<{ id: string|undefined, episodes: EpisodeCacheEntry[] }|null>}
 */
export async function resolveEpisodeId(url, mediaId, tvdbEid, season, absoluteEpisode) {
  const entry = mediaCache.get(mediaId)
  if (entry?.episodes.length) {
    const match = entry.episodes.find(_episode => (tvdbEid && _episode.tvdbId === tvdbEid))
      || (season != null && absoluteEpisode != null && (entry.episodes.find(_episode => (_episode.season === season && _episode.absolute === absoluteEpisode))
      || entry.episodes.find(_episode => (_episode.season === season && (_episode.absolute == null && _episode.episode === absoluteEpisode)))))
    if (match) return { id: match.nekoId, episodes: entry.episodes }
  }

  const res = await fetch(`${url}/media/${mediaId}`)
  if (!res.ok) {
    const error = await res.json().catch(() => null)
    throw new Error(`Failed to query source for episode id: HTTP ${res.status} ${res.statusText}${error?.message ? ` - ${error.message}` : ''}`)
  }
  /** @type {{ error: boolean, data: import('./types.d.ts').nekoBTMedia }} */
  const data = await res.json()
  if (data.error || !data.data?.episodes?.length) return null

  const episodes = data.data.episodes.map(_episode => ({ nekoId: String(_episode.id), tvdbId: _episode.tvdbId, season: _episode.season, episode: _episode.episode, absolute: _episode.absolute }))
  if (entry) {
    entry.episodes = episodes
    entry.tvdbId ??= data.data.tvdbId || undefined
    entry.tmdbId ??= data.data.tmdbId || undefined
    entry.imdbId ??= data.data.imdbId || undefined
    entry.updatedAt = Date.now()
  } else {
    mediaCache.set(mediaId, {
      nekoId: mediaId,
      tvdbId: data.data.tvdbId || undefined,
      tmdbId: data.data.tmdbId || undefined,
      imdbId: data.data.imdbId || undefined,
      episodes,
      cachedAt: Date.now()
    })
  }
  persistCache()
  const match = episodes.find(_episode => tvdbEid && _episode.tvdbId === tvdbEid)
    || (season != null && absoluteEpisode != null && (episodes.find(_episode => (_episode.season === season && _episode.absolute === absoluteEpisode))
    || episodes.find(_episode => (_episode.season === season && (_episode.absolute == null && _episode.episode === absoluteEpisode)))))
  return { id: match?.nekoId ?? null, episodes }
}