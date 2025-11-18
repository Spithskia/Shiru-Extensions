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