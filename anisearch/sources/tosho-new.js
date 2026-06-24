import AbstractSource from './abstract.js'

const QUALITIES = ['2160', '1080', '720', '540', '480']

export default new class ToshoNew extends AbstractSource {
  url = atob('aHR0cHM6Ly9mZWVkLmFuaW1ldG9zaG8ueHl6L2pzb24vdjE=')
  endpoint = atob('c2hpcnU=')

  /**
   * @param {import('./types.d.ts').ToshoNew[]} entries
   * @param {string[]} [exclusions=[]]
   * @returns {import('./types.d.ts').ToshoNew[]}
   */
  #filter(entries, exclusions = []) {
    if (!exclusions.length) return entries
    const terms = exclusions.map(exclusion => exclusion.trim().toLowerCase()).filter(Boolean)
    return entries.filter(({ title }) => !terms.some(term => title.toLowerCase().includes(term)))
  }

  /**
   * @param {import('./types.d.ts').ToshoNew[]} entries
   * @param {boolean} [batch=false]
   * @param {number|null} [anidb_fid=null] Results do not include the anidb id, but we can infer for now.
   * @returns {import('../').TorrentResult[]}
   **/
  #map(entries, batch = false, anidb_fid = null) {
    return entries.map(({
      title,
      link,
      seeders = 0,
      leechers = 0,
      downloads = 0,
      hash = '',
      size,
      date
    }) => ({
      title,
      link,
      seeders: seeders >= 30_000 ? 0 : seeders,
      leechers: leechers >= 30_000 ? 0 : leechers,
      downloads,
      hash: hash.toLowerCase(),
      size,
      accuracy: (anidb_fid && !batch) ? 'high' : 'medium',
      type: batch ? 'batch' : undefined,
      date: new Date(date ?? 0)
    }))
  }

  /**
   * @param {string} queryString
   * @param {{ resolution?: string, exclusions?: string[], episodeCount?: number, anidb_fid: number }} options
   * @param {boolean} [batch=false]
   * @returns {Promise<import('../').TorrentResult[]>}
   */
  async #query(queryString, { resolution, exclusions, episodeCount, anidb_fid }, batch = false) {
    const params = new URLSearchParams({
      limit: '100',
      ...(resolution && QUALITIES.includes(resolution) && { resolution: `${resolution}` })
    })
    const res = await fetch(`${this.url}/${this.endpoint}${queryString}&${params}`)

    if (!res?.ok) throw new Error(`Failed to query source for results: HTTP ${res?.status} ${res?.statusText}`)
    /** @type {{ data: import('../types').ToshoNew[], ok: boolean }} */
    const json = await res.json()
    /** @type {import('../types').ToshoNew[]} */
    const data = Array.isArray(json?.data) ? json.data : []

    const filteredData = this.#filter(!episodeCount ? data : data.filter(entry => entry.file_count > 1 || entry.is_batch), exclusions)
    return filteredData.length ? this.#map(filteredData, batch, anidb_fid) : []
  }

  /** @type {import('../').SearchFunction} */
  async single({ anidbEid, resolution, exclusions }) {
    if (!anidbEid) throw new Error('No anidbEid provided')
    return this.#query('?eid=' + anidbEid, { resolution, exclusions, anidb_fid: anidbEid })
  }

  /** @type {import('../').SearchFunction} */
  async batch({ anidbAid, resolution, episodeCount, exclusions }) {
    if (!anidbAid) throw new Error('No anidbAid provided')
    if (episodeCount == null) throw new Error('No episodeCount provided')
    return this.#query('?aid=' + anidbAid, { resolution, exclusions, episodeCount, anidb_fid: anidbAid }, true)
  }

  /** @type {import('../').SearchFunction} */
  async movie({ anidbAid, resolution, exclusions }) {
    if (!anidbAid) throw new Error('No anidbAid provided')
    return this.#query('?aid=' + anidbAid, { resolution, exclusions, anidb_fid: anidbAid })
  }

  /** @returns {Promise<boolean>} */
  async validate() {
    const res = await fetch(this.url)
    if (!res?.ok) return false
    return !!(await res.json().catch(() => null))?.ok
  }
}()