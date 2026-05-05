export interface nekoBT {
  error: boolean
  data: {
    results: nekoBTTorrent[]
    infohash_match: string | null
    recommended_media: nekoBTMedia[] | null
    media: nekoBTMedia | null
    similar_media: nekoBTMedia[] | null
    debug: {
      summary: string[]
      debug: string[]
    }
    more: boolean
    search: {
      limit: number // default is 50, max is 100. Range 1-100. NOTE max is 50 for media search.
      offset: number
      sort_by: string
      category: number
      media_id?: string
      episode_ids?: string
      episode_match_any: boolean
      group_primary: boolean
      group_secondary: boolean
      group_childs: boolean
      group_parents: boolean
      uploader_uploads: boolean
      uploader_contributions: boolean
    }
  }
}

export interface nekoBTTorrent {
  id: string
  uploaded_at: number
  title: string
  infohash: string
  magnet: string
  private_magnet: string | null
  media_id: string
  media_episode_ids: string[]
  description: string
  filesize: string
  category: number
  level: number
  otl: boolean
  hardsub: boolean
  mtl: boolean
  comment_count: string
  deleted: string | null
  hidden: boolean
  waiting_approve: boolean
  auto_title: string
  audio_lang: string
  sub_lang: string
  fsub_lang: string
  video_codec: number
  video_type: number
  anonymous: boolean
  upgraded: string | null
  uploader: nekoBTUser
  seeders: string
  leechers: string
  completed: string
  groups: nekoBTGroup[]
  imported: number | null
  animetosho: boolean | string | null
  has_screenshots: boolean
  has_mediainfo: boolean
  nyaa_upload_time: string | null
  batch: boolean
  user_is_seeding: boolean | null
  user_is_leeching: boolean | null
  user_download_count: number | null
}

export interface nekoBTUser {
  id: string
  display_name: string
  username: string
  pfp_hash: string | null
}

export interface nekoBTGroup {
  id: string
  display_name: string
  name: string
  anonymous: number
  tagline: string
  pfp_hash: string | null
  uploading_group: boolean
}

export interface nekoBTMedia {
  id: string
  title: string
  genres: string[]
  overview: string
  status: 'continuing' | 'ended' | 'released'
  banner_url: string
  runtime: number
  tvdbId?: number
  tmdbId?: number
  imdbId?: string
  year?: number
  alternate_titles: string[]
  episodes?: nekoBTEpisode[]
  similarity?: number
}

export interface nekoBTEpisode {
  id: number
  title: string
  season: number
  episode: number
  absolute?: number
  overview?: string
  runtime: number
  airDateUtc: string
  tvdbId: number
}

export interface nekoBTSearch {
  error: boolean
  data: {
    more: boolean
    results: nekoBTMedia[]
  }
}