interface TsukiGroup {
  id: number
  name: string
  is_fansub: number
}

interface TsukiAnime {
  id: number
  title: string
  english_title: string
  thumbnail: string
  synopsis?: string
  genres?: string[]
  studios?: string[]
  release_year?: number
  anilist?: number
  mal?: number
  anidb?: number
}

interface TsukiEpisode {
  anime_id: number
  episode_num: number
  title: string | null
}

interface TsukiTorrent {
  id: number
  name: string
  btih: string
  totalsize: number
  filecount: number
  audiolangs: string[]
  sublangs: string[]
  episode_no: number | null
  source_date: number
  added_date: number
  state: string
  has_nzb: number
  is_adult: number
  main_source: number
  nyaa_id: number
  sukebei_id: number
  nekobt_id: number
  tt_id: number
  animetosho?: boolean
  group: TsukiGroup
  anime?: TsukiAnime
}

interface TsukiResponse {
  total: number
  start: number
  limit: number
  error: boolean
  results: TsukiTorrent[]
  anime?: TsukiAnime
  episode?: TsukiEpisode
  cached_time: number
}