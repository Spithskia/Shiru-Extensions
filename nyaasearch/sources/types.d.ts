export interface Nyaa {
    title: string
    link: string
    guid: {
        isPermaLink: 'true' | 'false'
        '#text': string
    }
    pubDate: string
    'nyaa:seeders': number | string
    'nyaa:leechers': number | string
    'nyaa:downloads': number | string
    'nyaa:infoHash': string
    'nyaa:categoryId': string
    'nyaa:category': string
    'nyaa:size': string
    'nyaa:comments': number | string
    'nyaa:trusted': 'Yes' | 'No'
    'nyaa:remake': 'Yes' | 'No'
    description: string
}