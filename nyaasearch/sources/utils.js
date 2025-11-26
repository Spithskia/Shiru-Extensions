/**
 * Pads a value with leading zeros to ensure it meets a specified length, e.g: 1 => '01'
 *
 * @param {number|string} [v=1]
 * @param {number} [l=2]
 * @returns {string}
 */
function zeroPad (v = 1, l = 2) {
    return (typeof v === 'string' ? v : v.toString()).padStart(l, '0')
}

/**
 * @param {string} size
 * @returns {number}
 */
export function convertSizeToBytes(size) {
    const match = size.match(/^([\d.]+)\s*(TiB|GiB|MiB|KiB|B)$/)
    if (!match) return 0
    const value = parseFloat(match[1])
    switch (match[2]) {
        case 'TiB':
            return value * 1024 * 1024 * 1024 * 1024 // TiB to bytes
        case 'GiB':
            return value * 1024 * 1024 * 1024 // GiB to bytes
        case 'MiB':
            return value * 1024 * 1024 // MiB to bytes
        case 'KiB':
            return value * 1024 // KiB to bytes
        case 'B':
            return value // already in bytes
        default:
            return 0 // In case of an unrecognized unit
    }
}

/**
 * @param {number} episode
 * @returns {string[]}
 */
export function episodePatterns(episode) {
    return [...new Set([
        `"EP${zeroPad(episode)}+"`,
        `"EP${episode}+"`,
        `"E${zeroPad(episode)}+"`,
        `"E${episode}+"`,
        `"E${zeroPad(episode)}v"`,
        `"E${episode}v"`,
        `"EP${zeroPad(episode)}v"`,
        `"EP${episode}v"`,
        `"+${zeroPad(episode)}+"`,
        `"+${zeroPad(episode)}v"`,
        `"_EP${zeroPad(episode)}_"`,
        `"_EP${episode}_"`,
        `"_E${zeroPad(episode)}_"`,
        `"_E${episode}_"`,
        `"_${zeroPad(episode)}_"`
    ])]
}

/**
 * @param {number} episodeCount
 * @returns {string[]}
 */
export function batchPatterns(episodeCount) {
    const digits = Math.max(2, Math.log(episodeCount) * Math.LOG10E + 1 | 0)
    return [...new Set([
        `"${zeroPad(1, digits)}-${zeroPad(episodeCount, digits)}"`,
        `"${1}-${zeroPad(episodeCount, digits)}"`,
        `"${zeroPad(1, digits)}-${episodeCount}"`,
        `"${1}-${episodeCount}"`,
        `"${zeroPad(1, digits)} ~ ${zeroPad(episodeCount, digits)}"`,
        `"${1} ~ ${zeroPad(episodeCount, digits)}"`,
        `"${zeroPad(1, digits)} ~ ${episodeCount}"`,
        `"${1} ~ ${episodeCount}"`,
        `"${zeroPad(1, digits)}~${zeroPad(episodeCount, digits)}"`,
        `"${1}~${zeroPad(episodeCount, digits)}"`,
        `"${zeroPad(1, digits)}~${episodeCount}"`,
        `"${1}~${episodeCount}"`,
        `"Batch"`,
        `"Complete"`
    ])]
}

/**
 * @param {string} text
 * @returns {string}
 */
function decodeEntry(text) {
    return text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
}

/**
 * @param {string} tracker
 * @param {string} xml
 * @returns {import('./types').Nyaa[]}
 */
export function parseNyaaFeed(tracker, xml) {
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    const items = []
    let match
    while ((match = itemRegex.exec(xml)) !== null) items.push(createNyaaItem(tracker, match[1]))
    return items
}

/**
 * @param {string} tracker
 * @param {string} itemXml
 * @returns {import('./types').Nyaa}
 */
function createNyaaItem(tracker, itemXml) {
    const getTag = (tag) => {
        const match = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(itemXml)
        return match ? decodeEntry(match[1].trim()) : ''
    }

    const getAttribute = (tag, attr) => {
        const match = new RegExp(`<${tag}[^>]*?${attr}="([^"]*?)"`, 'i').exec(itemXml)
        return match ? decodeEntry(match[1]) : ''
    }

    const title = getTag('title') || '?'
    const infoHash = getTag('nyaa:infoHash')
    const magnet = infoHash ? `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(title)}&tr=${tracker}` : ''
    // This link is notoriously slow to resolve, it's best to construct a magnet when possible.
    const torrentLink = getAttribute('enclosure', 'url') || getTag('link') || ''

    return {
        title,
        link: magnet || torrentLink || '?',
        guid: {
            isPermaLink: getAttribute('guid', 'isPermaLink') === 'true' ? 'true' : 'false',
            '#text': getTag('guid') || '?',
        },
        pubDate: getTag('pubDate'),
        'nyaa:seeders': parseInt(getTag('nyaa:seeders')) || 0,
        'nyaa:leechers': parseInt(getTag('nyaa:leechers')) || 0,
        'nyaa:downloads': parseInt(getTag('nyaa:downloads')) || 0,
        'nyaa:infoHash': infoHash || '?',
        'nyaa:categoryId': getTag('nyaa:categoryId') || '?',
        'nyaa:category': getTag('nyaa:category') || '?',
        'nyaa:size': getTag('nyaa:size') || '?',
        'nyaa:comments': parseInt(getTag('nyaa:comments')) || 0,
        'nyaa:trusted': getTag('nyaa:trusted') === 'Yes' ? 'Yes' : 'No',
        'nyaa:remake': getTag('nyaa:remake') === 'Yes' ? 'Yes' : 'No',
        description: getTag('description') || '?'
    }
}