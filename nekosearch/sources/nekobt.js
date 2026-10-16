import AbstractSource from './abstract.js'

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
      if (episode_ids && !torrent.media_episode_ids?.some(id => id === episode_ids)) return false
      if (exclusions?.length && exclusions.some(exclusion => title.includes(exclusion.toLowerCase()))) return false
      if (excludeDual && torrent.audio_lang?.split(',').filter(Boolean).length > 1) return false
      return !(resolution && QUALITIES.filter(quality => quality !== resolution).some(quality => {
        const pattern = new RegExp(`(?:^|[^a-z0-9])(?:(?:\\d{3,4}\\s*[x\\u00d7]\\s*|(?:full)?hd\\s*)?${quality}[pi](?:\\d{2})?|\\d{3,4}\\s*[x\\u00d7]\\s*${quality})(?=$|[^a-z0-9])|[\\[(]\\s*${quality}\\s*[\\])]`)
        return pattern.test(title) || (quality === '2160' && /(?:^|[^a-z0-9])(?:4k|uhd)(?=$|[^a-z0-9])/.test(title))
      }))
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
      params.set('fansub_lang', sub_lang)
    }
    if (audio_lang) params.set('audio_lang', audio_lang)
    return params
  }

  /**
   * @param {import('./types.d.ts').nekoBTTorrent} torrent
   * @param {{ highAccuracy?: boolean }} opts
   * @returns {import('../').TorrentResult}
   */
  #map(torrent, { highAccuracy } = {}) {
    const audioLanguages = torrent.audio_lang?.split(',').filter(Boolean) ?? []
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
      sub_lang: torrent.sub_lang?.split(',').map(language => language.trim()).filter(Boolean) ?? [],
      audio_lang: audioLanguages,
      dual_audio: audioLanguages.length > 1,
      accuracy: highAccuracy && (torrent.media_episode_ids ?? []).length === 1 ? 'high' : torrent.batch ? 'medium' : 'low',
      type: torrent.batch && (torrent.media_episode_ids ?? []).length > 1 ? 'batch' : undefined,
      date: new Date(Number(torrent.uploaded_at))
    }
  }

  /**
   * @param {import('./types.d.ts').nekoBTEpisode[]} episodes
   * @param {number|undefined} tvdbEid
   * @param {number|undefined} season
   * @param {number|undefined} absoluteEpisode
   * @param {number|undefined} episode
   * @param {import('./types.d.ts').nekoBTAnilistMapping[]} mappings
   * @param {boolean} wholeSeason
   * @returns {import('./types.d.ts').nekoBTEpisode|undefined}
   */
  #resolveEpisodeId(episodes, tvdbEid, season, absoluteEpisode, episode, mappings = [], wholeSeason = false) {
    const exact = episodes.find(entry => tvdbEid && entry.tvdbId === tvdbEid)
    if (exact) return exact
    if (!tvdbEid && season == null && absoluteEpisode == null && episode != null) {
      if (mappings.length) {
        const ranges = mappings.filter(entry => episode >= entry.dst_start && (entry.dst_end == null || episode <= entry.dst_end))
        const seasonFallback = !ranges.length && wholeSeason && episode >= 1
        if (ranges.length !== 1 && !seasonFallback) return undefined
        const mapping = seasonFallback ? mappings[0] : ranges[0]
        if (mapping.season == null || !Number.isInteger(mapping.src_start) || !Number.isInteger(mapping.dst_start)
          || (mapping.ratio != null && mapping.ratio !== 1)) return undefined
        const mappedEpisode = mapping.src_start + episode - mapping.dst_start
        if (!seasonFallback && mapping.src_end != null && mappedEpisode > mapping.src_end) return undefined
        const matches = episodes.filter(entry => entry.season === mapping.season && entry.episode === mappedEpisode)
        return matches.length === 1 ? matches[0] : undefined
      }
      // validate only numbering fields present in the metadata
      const seasons = new Set(episodes.map(entry => entry.season).filter(value => value != null))
      if (seasons.size > 1) return undefined
      const absolute = episodes.filter(entry => entry.absolute === episode)
      const numbered = episodes.filter(entry => entry.episode === episode)
      if (episodes.some(entry => entry.absolute != null) && absolute.length !== 1) return undefined
      if (episodes.some(entry => entry.episode != null) && numbered.length !== 1) return undefined
      if (absolute.length && numbered.length && absolute[0] !== numbered[0]) return undefined
      return absolute[0] ?? numbered[0]
    }
    const candidates = episodes.filter(entry => season == null || entry.season === season)
    if (absoluteEpisode != null) {
      const absolute = candidates.filter(entry => entry.absolute === absoluteEpisode)
      if (absolute.length === 1) return absolute[0]
      if (absolute.length > 1) return undefined
    }
    const numbered = candidates.filter(entry => episode != null
      ? entry.episode === episode
      : season != null && absoluteEpisode != null && entry.absolute == null && entry.episode === absoluteEpisode)
    return numbered.length === 1 ? numbered[0] : undefined
  }

  /**
   * @param {string} url
   * @param {number|undefined} tvdbAid
   * @param {number|undefined} mvdbAid
   * @param {number|undefined} anidbAid
   * @param {string|undefined} imdbAid
   * @param {number|null|undefined} anilistId
   * @param {number|null|undefined} myanimelistId
   * @param {string[]} titles
   * @returns {Promise<string|null>}
   */
  async #resolveMediaId(url, tvdbAid, mvdbAid, anidbAid, imdbAid, anilistId, myanimelistId, titles = []) {
    if (tvdbAid) return `tvdb_show-${tvdbAid}`
    if (mvdbAid) return `tmdb_movie-${mvdbAid}`
    if (anidbAid) return `anidb-${anidbAid}`
    if (imdbAid) return `imdb-${imdbAid}`
    if (anilistId) return `anilist-${anilistId}`
    if (myanimelistId) return `mal-${myanimelistId}`

    for (const title of titles.slice(0, 6)) {
      const res = await fetch(`${url}/media/search?${new URLSearchParams({ query: title, limit: '50' })}`)
      if (!res.ok) throw new Error(`Failed to query nekoBT: HTTP ${res.status} ${res.statusText}`)
      /** @type {import('./types.d.ts').nekoBTSearch} */
      const data = await res.json()
      if (data.error || !data.data || !Array.isArray(data.data.results)) throw new Error(`Failed to query nekoBT: ${data.message || 'Invalid media response'}`)
      const match = data.data.results.find(media => media.similarity === 1)
      if (match?.id) return match.id
    }
    return null
  }

  /**
   * @param {string} mediaId
   * @param {{ resolution?: string, exclusions?: string[], episode_ids?: string, highAccuracy?: boolean }} opts
   * @returns {Promise<NonNullable<import('./types.d.ts').nekoBT['data']>>}
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
    if (data.error || !data.data || !Array.isArray(data.data.results)) throw new Error(`Failed to query nekoBT: ${data.message || 'Invalid search response'}`)
    return data.data
  }

  /** @type {import('../').SearchFunction} */
  async single({ anilistId, anidbAid, media, tvdbAid, tvdbEid, mvdbAid, imdbAid, season, absoluteEpisode, episode, titles, resolution, exclusions }) {
    const _media = await this.#resolveMediaId(this.url, tvdbAid, mvdbAid, anidbAid, imdbAid, anilistId, media?.idMal, tvdbEid ? [] : titles)
    if (!_media) return []
    let data = await this.#query(_media)
    if (!tvdbEid && !data.results.length && _media.includes('-') && titles?.length) {
      const titleMedia = await this.#resolveMediaId(this.url, undefined, undefined, undefined, undefined, undefined, undefined, titles)
      if (!titleMedia) return []
      data = await this.#query(titleMedia)
    }
    if (!data.media && data.results.length) {
      const mediaIds = [...new Set(data.results.map(torrent => torrent.media_id))]
      if (mediaIds.length === 1 && /^[sm]\d+$/.test(mediaIds[0])) {
        data = await this.#query(mediaIds[0])
      }
    }
    const episodes = data.media?.episodes ?? []
    const mappings = data.media?.anilist?.entries?.filter(entry => entry.anilist_id === anilistId) ?? []
    const wholeSeason = mappings.length === 1 && mappings[0].season != null
      && mappings[0].src_start === 1 && mappings[0].dst_start === 1
      && data.media.anilist.entries.filter(entry => entry.season === mappings[0].season).length === 1
    const match = this.#resolveEpisodeId(episodes, tvdbEid, season, absoluteEpisode, episode, mappings, wholeSeason)
    if (!match && !data.media?.id?.startsWith('m')) return []
    const highAccuracy = Boolean(match && ((tvdbEid && match.tvdbId === tvdbEid)
      || (!tvdbEid && season == null && absoluteEpisode == null && episode != null)))
    const opts = { resolution, exclusions, highAccuracy, episode_ids: match ? String(match.id) : undefined }
    const outsideSearchScope = Boolean(match && data.search?.episode_ids && !data.search.episode_ids.split(',').includes(String(match.id)))
    if (match && (data.more || outsideSearchScope)) data = await this.#query(data.media.id, opts)
    const filtered = this.#filter(data.results, opts)
    return filtered.map(torrent => this.#map(torrent, opts))
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