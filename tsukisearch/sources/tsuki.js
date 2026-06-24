import AbstractSource from './abstract.js'
import { _fetch, resolveMediaId } from './utils.js'

const QUALITIES = ['2160', '1080', '720', '540', '480']

export default new class TsukiHime extends AbstractSource {
  url = atob('aHR0cHM6Ly9hcGkudHN1a2loaW1lLm9yZy92MQ==')

  /**
   * @param {import('../').TorrentResult[]} results
   * @param {{ resolution?: string, exclusions?: string[] }} opts
   * @returns {import('../').TorrentResult[]}
   */
  #filter(results, { resolution, exclusions } = {}) {
    return results.filter(({ title }) => {
      const _title = title.toLowerCase()
      if (exclusions?.some(exclusion => _title.includes(exclusion.toLowerCase()))) return false
      return !(resolution && QUALITIES.filter(quality => quality !== resolution).some(quality => _title.includes(quality)))
    })
  }

  /**
   * @param {import('./types.d.ts').TsukiTorrent[]} results
   * @param {{ batch?: boolean }} opts
   * @returns {import('../').TorrentResult[]}
   */
  #map(results, { batch = false } = {}) {
    return results.map(({
      name,
      btih,
      totalsize,
      audiolangs,
      sublangs,
      filecount,
      source_date
    }) => ({
      title: (() => {
        let _title = name
        if (audiolangs.length > 1 && !/DUAL/i.test(_title)) _title += ' Dual Audio'
        //if (!sublangs?.length && !/RAW/i.test(_title.slice(10))) _title += ' RAW' // this data is highly unreliable...
        return _title
      })(),
      link: `magnet:?xt=urn:btih:${btih}&dn=${encodeURIComponent(name)}`,
      hash: btih,
      seeders: 0, // Currently not available, requires scraping.
      leechers: 0, // Currently not available, requires scraping.
      downloads: 0, // Currently not available, requires scraping.
      size: totalsize,
      sub_lang: sublangs ?? [],
      audio_lang: audiolangs ?? [],
      dual_audio: (audiolangs ?? []).length > 1,
      accuracy: batch ? 'medium' : 'low',
      type: batch || ((filecount > 1 || filecount === 0) && /BATCH/i.test(name)) ? 'batch' : undefined,
      date: new Date(source_date * 1_000)
    }))
  }

  /**
   * @param {string} tsukiId
   * @param {{ episode?: number, resolution?: string, exclusions?: string[], batch?: boolean, movie?: boolean }} opts
   * @returns {Promise<import('../').TorrentResult[]>}
   */
  async #query(tsukiId, { episode, resolution, exclusions, batch = false, movie = false } = {}) {
    const url = episode != null ? `${this.url}/animes/${tsukiId}/episodes/${episode}` : `${this.url}/animes/${tsukiId}`
    const res = await _fetch(`${url}?limit=100`)
    if (!res.ok) throw new Error(`Failed to query source for results: HTTP ${res.status} ${res.statusText}`)

    /** @type {import('./types.d.ts').TsukiResponse} */
    const data = await res.json()
    if (data?.error || !data?.results?.length) return []

    /** @type {import('../').TorrentResult[]} */
    const mappedData = this.#map(batch ? data.results.filter(({ filecount }) => filecount > 1) : movie ? data.results.filter(({ filecount }) => filecount <= 1) : data.results, { batch })
    return this.#filter(mappedData, { resolution, exclusions })
  }

  /** @type {import('../').SearchFunction} */
  async single({ anidbAid, anilistId, episode, resolution, exclusions }) {
    if (!anidbAid && !anilistId) throw new Error('No anidbAid or anilistId provided')
    const tsukiId = await resolveMediaId(this.url, anidbAid || anilistId, !anidbAid)
    if (!tsukiId || episode == null) return []
    return this.#query(tsukiId, { episode, resolution, exclusions })
  }

  /** @type {import('../').SearchFunction} */
  async batch({ anidbAid, anilistId, resolution, exclusions }) {
    if (!anidbAid && !anilistId) throw new Error('No anidbAid or anilistId provided')
    const tsukiId = await resolveMediaId(this.url, anidbAid || anilistId, !anidbAid)
    if (!tsukiId) return []
    return this.#query(tsukiId, { resolution, exclusions, batch: true })
  }

  /** @type {import('../').SearchFunction} */
  async movie({ anidbAid, anilistId, episodeCount, resolution, exclusions }) {
    if (episodeCount > 1) return []
    if (!anidbAid && !anilistId) throw new Error('No anidbAid or anilistId provided')
    const tsukiId = await resolveMediaId(this.url, anidbAid || anilistId, !anidbAid)
    if (!tsukiId) return []
    return this.#query(tsukiId, { resolution, exclusions, movie: true })
  }

  /** @returns {Promise<boolean>} */
  async validate() {
    return (await _fetch(`${this.url}/stats`))?.ok
  }
}()