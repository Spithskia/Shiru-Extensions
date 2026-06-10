import AbstractSource from './abstract.js'
import { resolveMediaId, resolveEpisodeId } from './utils.js'

const QUALITIES = ['2160', '1080', '720', '540', '480']

export default new class nekoBT extends AbstractSource {
  url = atob('aHR0cHM6Ly9uZWtvYnQudG8vYXBpL3Yx')
  settings = {
    subtitleLanguage: [],
    audioLanguage: []
  }

  /**
   * @param {import('./types.d.ts').nekoBTTorrent[]} results
   * @param {{ resolution?: string, exclusions?: string[], episode_ids?: string }} opts
   * @returns {import('./types.d.ts').nekoBTTorrent[]}
   */
  #filter(results, { resolution, exclusions, episode_ids } = {}) {
    const excludeDual = exclusions?.some(exclusion => exclusion === 'DUAL')
    return results.filter(torrent => {
      const title = (torrent.title || torrent.auto_title).toLowerCase()
      if (torrent.media_episode_ids?.length && !episode_ids?.length) return false // would only ever happen when searching for a movie
      if (exclusions?.length && exclusions.some(exclusion => title.includes(exclusion.toLowerCase()))) return false
      if (excludeDual && torrent.audio_lang?.split(',').filter(Boolean).length > 1) return false
      return !(resolution && QUALITIES.filter(quality => quality !== resolution).some(quality => title.includes(`${quality}`)))
    })
  }

  /**
   * @param {string} mediaId
   * @param {{ episode_ids?: string }} opts
   * @returns {URLSearchParams}
   */
  #buildQuery(mediaId, { episode_ids} = {}) {
    const sub_lang = this.settings.subtitleLanguage?.join(',') || undefined
    const audio_lang = this.settings.audioLanguage?.join(',') || undefined
    const params = new URLSearchParams({ media_id: mediaId, sort_by: 'seeders', limit: '100' })
    if (episode_ids?.length) params.set('episode_ids', episode_ids)
    if (sub_lang) {
      params.set('sub_lang', sub_lang)
      params.set('fsub_lang', sub_lang)
    }
    if (audio_lang) params.set('audio_lang', audio_lang)
    return params
  }

  /**
   * @param {import('./types.d.ts').nekoBTTorrent} torrent
   * @param {{ tvdbEid?: number }} opts
   * @returns {import('../').TorrentResult}
   */
  #map(torrent, { tvdbEid } = {}) {
    const audioLanguages = torrent.audio_lang?.split(',') ?? []
    const title = torrent.title ?? torrent.auto_title?.replace(/\s*\{Tags:[^}]*}/g, '')
    return {
      title: (() => {
        let _title = title
        if (audioLanguages.length > 1 && !/DUAL/i.test(_title)) _title += ' Dual Audio'
        if (!torrent.sub_lang?.length && !torrent.fsub_lang?.length && !/RAW/i.test(_title.slice(10))) _title += ' RAW'
        return _title
      })(),
      link: torrent.magnet,
      seeders: Number(torrent.seeders) || 0,
      leechers: Number(torrent.leechers) || 0,
      downloads: Number(torrent.completed) || 0,
      hash: torrent.infohash,
      size: Number(torrent.filesize) || 0,
      sub_lang: torrent.sub_lang?.split(',') ?? [],
      audio_lang: audioLanguages,
      dual_audio: audioLanguages.length > 1,
      accuracy: tvdbEid && (torrent.media_episode_ids ?? []).length === 1 ? 'high' : torrent.batch ? 'medium' : 'low',
      type: torrent.batch && (torrent.media_episode_ids ?? []).length > 1 ? 'batch' : undefined,
      date: new Date(Number(torrent.uploaded_at))
    }
  }

  /**
   * @param {string} mediaId
   * @param {{ resolution?: string, exclusions?: string[], episode_ids?: string, tvdbEid?: number }} opts
   * @returns {Promise<import('../').TorrentResult[]>}
   */
  async #query(mediaId, opts = {}) {
    const params = this.#buildQuery(mediaId, opts)
    const res = await fetch(`${this.url}/torrents/search?${params}`)
    if (!res.ok) {
      const error = await res.json().catch(() => null)
      throw new Error(`Failed to query source for results: HTTP ${res.status} ${res.statusText}${error?.message ? ` - ${error.message}` : ''}`)
    }
    /** @type {import('./types.d.ts').nekoBT} */
    const data = await res.json()
    if (data.error || !data.data?.results?.length) return []
    const filtered = this.#filter(data.data.results, opts)
    return filtered.map(torrent => this.#map(torrent, opts))
  }

  /** @type {import('../').SearchFunction} */
  async single({ tvdbAid, tvdbEid, mvdbAid, imdbAid, season, absoluteEpisode, episodeCount, titles, resolution, exclusions }) {
    const media = await resolveMediaId(this.url, tvdbAid, mvdbAid, imdbAid, titles)
    if (!media) return []
    const episode = (tvdbEid || absoluteEpisode != null) ? await resolveEpisodeId(this.url, media, tvdbEid, season, absoluteEpisode) : null
    if (!episode?.id && (episodeCount > 1 || episode?.episodes?.length)) return [] // movies typically are independent so episode list will be empty
    return this.#query(media, { resolution, exclusions, tvdbEid, episode_ids: episode?.id })
  }

  /** @type {import('../').SearchFunction} */
  async batch(opts) {
    return [] // single already gets batches with matching episode id
  }

  /** @type {import('../').SearchFunction} */
  async movie(opts) {
    return [] // single already gets movies with matching media id
  }

  /** @returns {Promise<boolean>} */
  async validate() {
    return (await fetch(`${this.url}/stats`))?.ok
  }
}()