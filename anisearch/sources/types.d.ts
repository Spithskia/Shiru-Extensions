export interface SeaDex {
    items: {
        alID: number
        expand: {
            trs: {
                created: Date
                dualAudio: boolean
                files: {
                    length: number
                    name: string
                }[]
                infoHash: string
                isBest: boolean
                releaseGroup: string
            }[]
        }
        trs: string[]
    }[]
}

export interface Tosho {
    title?: string
    timestamp: number
    torrent_name: string
    info_hash: string
    magnet_uri: string
    seeders: null
    leechers: null
    torrent_downloaded_count?: number
    total_size: number
    num_files: number
    torrent_url?: string
    article_url?: string
    website_url?: string
    nyaa_id?: string
    anidb_aid?: number
    anidb_eid?: number
    anidb_fid?: number
    nzb_url?: string
}

export interface ToshoNew {
    id: number
    title: string
    date?: string
    hash: string
    link: string
    seeders: null
    leechers: null
    downloads?: number
    size: number
    is_batch: boolean
    file_count: number
    torrent_url?: string
    view_url: string
    nzb_url?: string
}