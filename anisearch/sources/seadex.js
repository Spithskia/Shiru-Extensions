import AbstractSource from './abstract.js'

const URLS = [
  atob('aHR0cHM6Ly9zZWFkZXgubW9lL2FwaS9jb2xsZWN0aW9ucy9lbnRyaWVzL3JlY29yZHM='),
  atob('aHR0cHM6Ly9yZWxlYXNlcy5tb2UvYXBpL2NvbGxlY3Rpb25zL2VudHJpZXMvcmVjb3Jkcw==')
]

export default new class SeaDex extends AbstractSource {
  url = URLS[0]

  /** @type {import('../').SearchFunction} */
  async single({ anilistId, titles, episodeCount }) {
    if (!anilistId) throw new Error('No anilistId provided')
    if (!titles?.length) throw new Error('No titles provided')

    const query = new URLSearchParams({
      page: '1',
      perPage: '1',
      filter: `alID="${anilistId}"`,
      skipTotal: '1',
      expand: 'trs'
    })
    const res = await fetch(`${this.url}?${query}`)
    if (!res?.ok) throw new Error(`Failed to query source for results: HTTP ${res?.status} ${res?.statusText}`)

    /** @type {import('./types.d.ts').SeaDex} */
    const { items } = await res.json()

    const trs = items?.[0]?.expand?.trs
    if (!trs?.length || !Array.isArray(trs)) return []

    return trs.filter(({ infoHash, files }) => !(infoHash === '<redacted>' || (episodeCount > 1 && files?.length === 1)))
        .map(({ infoHash, files, releaseGroup, dualAudio, isBest, created }) => ({
          hash: infoHash,
          link: infoHash,
          title: files.length === 1 ? files[0].name : `[${releaseGroup}] ${titles[0]}${dualAudio ? ' Dual Audio' : ''}`,
          size: files.reduce((total, { length }) => total + length, 0),
          type: isBest ? 'best' : 'alt',
          date: new Date(created),
          seeders: 0,
          leechers: 0,
          downloads: 0,
          accuracy: 'high'
        }))
  }

  /** @type {import('../').SearchFunction} */
  async batch(opts) {
    return [] // single already gets batches from the anilistId
  }

  /** @type {import('../').SearchFunction} */
  async movie(opts) {
    return [] // single already gets movies from the anilistId
  }

  /** @returns {Promise<boolean>} */
  async validate() {
    for (const url of URLS) {
      try {
        if (!(await fetch(`${url}?perPage=1`))?.ok) continue

        this.url = url
        return true
      } catch {}
    }
    return false
  }
}()