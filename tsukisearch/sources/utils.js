/**
 * @typedef {Object} MediaCacheEntry
 * @property {number|undefined} anilistId
 * @property {number|undefined} malId
 * @property {number|undefined} anidbId
 * @property {number} cachedAt
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
const persistCache = debounce(async () => set('tsukiMedia', Object.fromEntries(mediaCache)), 3_000)
/** @type {Map<string, MediaCacheEntry>} Keyed by TsukiHime media ID e.g. '243' */
const mediaCache = new Map()

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
 *
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
  const stored = await get('tsukiMedia')
  if (stored) {
    const now = Date.now()
    for (const [key, value] of Object.entries(stored)) {
      const age = now - (value.cachedAt)
      if (age < TTL_MS) mediaCache.set(key, value)
    }
    persistCache()
  }
}

await loadCache() // load cache

/**
 * Finds a cached entry by any of its external IDs.
 *
 * @param {number|undefined} id
 * @param {'anidb'|'anilist'|'mal'} type
 * @returns {{ tsukiId: string, entry: MediaCacheEntry }|undefined}
 */
function findCached(id, type) {
  for (const [tsukiId, entry] of mediaCache) {
    if ((id && (type === 'anilist' ? entry.anilistId === id : type === 'anidb' ? entry.anidbId === id : entry.malId === id))) {
      return { tsukiId, entry }
    }
  }
}

/**
 * Resolves the TsukiHime internal media ID from an anilist, anidb or myanimelist ID.
 *
 * @param {string} url
 * @param {number} id
 * @param {'anidb'|'anilist'|'mal'} type
 * @returns {Promise<string|null>}
 */
export async function resolveMediaId(url, id, type) {
  const cached = findCached(id, type)
  if (cached) return cached.tsukiId

  const res = await _fetch(`${url}/animes/${type}/${id}`)
  if (!res.ok) {
    if (res.status === 404) return null
    throw new Error(`Failed to resolve media ID: HTTP ${res.status} ${res.statusText}`)
  }
  /** @type {import('./types.d.ts').TsukiAnime} */
  const data = await res.json()
  if (!data?.id) return null

  mediaCache.set(String(data.id), {
    anilistId: data.anilist || undefined,
    malId: data.mal || undefined,
    anidbId: data.anidb || undefined,
    cachedAt: Date.now()
  })
  persistCache()
  return String(data.id)
}

/**
 * Gets the TsukiHime internal media ID from an anilist, anidb or myanimelist ID.
 *
 * @param {string} url
 * @param {number} [anilistId]
 * @param {number} [anidbAid]
 * @param {number} [malId]
 * @returns {Promise<string|null>}
 */
export async function getTsukiId(url, anilistId, anidbAid, malId) {
  let tsukiId = null
  const candidates = [
    anilistId && { id: anilistId, type: 'anilist' },
    anidbAid && { id: anidbAid, type: 'anidb' },
    malId && { id: malId, type: 'mal' }
  ].filter(Boolean)
  for (const { id, type } of candidates) {
    tsukiId = await resolveMediaId(url, id, type)
    if (tsukiId) break
  }
  return tsukiId
}

/**
 * Stability of the API responses is currently VERY poor, we can only retry...
 *
 * @param {string} url
 * @param {number} [retries=6]
 * @returns {Promise<Response>}
 */
export const _fetch = async (url, retries = 6) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url)
      if ((res.status !== 500 && res.status !== 502) || attempt === retries - 1) return res
    } catch (err) {
      if (attempt === retries - 1) throw err
    }
  }
}