import AbstractSource from './abstract.js'
import { parseNyaaFeed, episodePatterns, batchPatterns, convertSizeToBytes } from './utils.js'

const QUALITIES = ['2160', '1080', '720', '540', '480']

export default new class Nyaa extends AbstractSource {
    url = atob('aHR0cHM6Ly9ueWFhLnNpLz9wYWdlPXJzcw==')
    tracker = encodeURIComponent(atob('aHR0cDovL255YWEudHJhY2tlci53Zjo3Nzc3L2Fubm91bmNl'))

    /**
     * @param {string[]} titles
     * @param {Object} params
     * @param {string} [params.resolution]
     * @param {string[]} [params.exclusions]
     * @param {number} [params.episode]
     * @param {number} [params.episodeCount]
     * @param {boolean} [batch=false]
     * @returns {string}
     */
    #buildQuery(titles, { resolution, exclusions, episode, episodeCount }, batch = false) {
        const queryParts = [
            `(${titles.join(')|(')})`,
            episodeCount > 1 ? batch ? batchPatterns(episodeCount).join("|") : episodePatterns(episode).join('|') : '',
            resolution ? `-(${QUALITIES.filter(q => q !== resolution).join('|')})` : '',
            exclusions?.length ? `-(${exclusions.join('|')})` : ''
        ]
        return `&c=1_0&f=0&s=seeders&o=desc&q=${queryParts.join('')}`
    }

    /**
     * @param {import('./types').Nyaa[]} nodes
     * @param {boolean} batch
     * @returns {import('./').TorrentResult[]}
     **/
    map (nodes, batch = false) {
        return nodes.map(item => {
            return {
                title: item.title,
                link: item.link,
                hash: item['nyaa:infoHash'],
                seeders: Number(item['nyaa:seeders']),
                leechers: Number(item['nyaa:leechers']),
                downloads: Number(item['nyaa:downloads']),
                size: convertSizeToBytes(item['nyaa:size']),
                accuracy: (item['nyaa:trusted'] === 'Yes' || item['nyaa:remake'] === 'Yes') ? 'medium' : 'low',
                type: batch ? 'batch' : undefined,
                date: item.pubDate ? new Date(item.pubDate) : undefined
            }
        })
    }

    /**
     * @param {string[]} titles
     * @param {{ resolution?: string, exclusions?: string[], episodeCount?: number }} options
     * @param {boolean} [batch=false]
     * @returns {Promise<import('./').TorrentResult[]>}
     */
    async #query(titles, { resolution, exclusions, episode, episodeCount }, batch = false) {
        const query = this.#buildQuery(titles, { resolution, exclusions, episode, episodeCount }, batch)
        const res = await fetch(this.url + query)
        if (res?.ok) {
            const xml = await res.text()

            /** @type {import('./types').Nyaa[]} */
            const data = [...parseNyaaFeed(this.tracker, xml)]
            return this.map(data, batch)
        }
        return []
    }

    /** @type {import('./').SearchFunction} */
    async single ({ anilistId, episode, episodeCount, titles, exclusions, resolution }) {
        return this.#query(titles, { resolution, exclusions, episode, episodeCount })
    }

    /** @type {import('./').SearchFunction} */
    async batch ({ anilistId, episode, episodeCount, titles, exclusions, resolution }) {
        return this.#query(titles, { resolution, exclusions, episode, episodeCount }, true)
    }

    /** @type {import('./').SearchFunction} */
    async movie (opts) {
        return [] // not really applicable for this type of search
    }

    /**
     * Checks if the source URL is reachable.
     * @returns {() => Promise<boolean>} True if fetch succeeds.
     */
    async validate () {
        return (await fetch(this.url))?.ok
    }
}()