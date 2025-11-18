/**
 * @typedef {import('./').TorrentSource} TorrentSource
 */

/**
 * @implements {TorrentSource}
 */
export default class AbstractSource {
  /**
   * Query results for a single episode.
   * @type {import('./').SearchFunction}
   */
  single (options) {
    throw new Error('Source does not implement method #single()')
  }

  /**
   * Query results for a batch of episodes.
   * @type {import('./').SearchFunction}
   */
  batch (options) {
    throw new Error('Source does not implement method #batch()')
  }

  /**
   * Query results for a movie.
   * @type {import('./').SearchFunction}
   */
  movie (options) {
    throw new Error('Source does not implement method #movie()')
  }

  /**
   * Validates the source url.
   * @type {() => Promise<boolean>}
   */
  validate () {
    throw new Error('Source does not implement method #validate()')
  }
}