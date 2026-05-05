import AbstractSource from './abstract.js'

const QUALITIES = ['2160', '1080', '720', '540', '480']

export default new class Tosho extends AbstractSource {
  url = atob('aHR0cHM6Ly9mZWVkLmFuaW1ldG9zaG8ub3JnL2pzb24=')

  /**
   * @param {Object} params
   * @param {string} [params.resolution]
   * @param {string[]} [params.exclusions]
   *
   * @returns {string}
   */
  #buildQuery({ resolution, exclusions }) {
    if (!exclusions?.length && !resolution) return ''
    const base = `&qx=1&q=!("${exclusions.join('"|"')}")`
    if (!resolution) return base
    return `${base}!(*${QUALITIES.filter(q => q !== resolution).join('*|*')}*)`
  }

  /**
   * @param {import('./types.d.ts').Tosho[]} entries
   * @param {boolean} [batch=false]
   * @returns {import('../').TorrentResult[]}
   **/
  #map(entries, batch = false) {
    return entries.map(({
      title,
      torrent_name,
      magnet_uri,
      seeders = 0,
      leechers = 0,
      torrent_downloaded_count = 0,
      info_hash,
      total_size,
      anidb_fid,
      timestamp
    }) => ({
      title: title || torrent_name,
      link: magnet_uri,
      seeders: seeders >= 30_000 ? 0 : seeders,
      leechers: leechers >= 30_000 ? 0 : leechers,
      downloads: torrent_downloaded_count,
      hash: info_hash,
      size: total_size,
      accuracy: (anidb_fid && !batch) ? 'high' : 'medium',
      type: batch ? 'batch' : undefined,
      date: new Date(timestamp * 1_000)
    }))
  }

  /**
   * @param {string} queryString
   * @param {{ resolution?: string, exclusions?: string[], episodeCount?: number }} options
   * @param {boolean} [batch=false]
   * @returns {Promise<import('../').TorrentResult[]>}
   */
  async #query(queryString, { resolution, exclusions, episodeCount }, batch = false) {
    const query = this.#buildQuery({ resolution, exclusions })
    const res = await fetch(this.url + queryString + query)
    if (!res?.ok) throw new Error(`Failed to query source for results: HTTP ${res?.status} ${res?.statusText}`)

    /** @type {import('../types').Tosho[]} */
    const data = await res.json()
    return data.length ? this.#map(!episodeCount ? data : data.filter(entry => entry.num_files > 1), batch) : []
  }

  /** @type {import('../').SearchFunction} */
  async single({ anidbEid, resolution, exclusions }) {
    if (!anidbEid) throw new Error('No anidbEid provided')
    return this.#query('?eid=' + anidbEid, { resolution, exclusions })
  }

  /** @type {import('../').SearchFunction} */
  async batch({ anidbAid, resolution, episodeCount, exclusions }) {
    if (!anidbAid) throw new Error('No anidbAid provided')
    if (episodeCount == null) throw new Error('No episodeCount provided')
    return this.#query('?order=size-d&aid=' + anidbAid, { resolution, exclusions, episodeCount }, true)
  }

  /** @type {import('../').SearchFunction} */
  async movie({ anidbAid, resolution, exclusions }) {
    if (!anidbAid) throw new Error('No anidbAid provided')
    return this.#query('?aid=' + anidbAid, { resolution, exclusions })
  }

  /** @returns {Promise<boolean>} */
  async validate() {
    return (await fetch(this.url))?.ok
  }
}()