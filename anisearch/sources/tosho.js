import AbstractSource from "./abstract.js";

export default new (class Tosho extends AbstractSource {
  url = "https://feed.animetosho.xyz/json/v1";

  /**
   * @param {import('./types.d.ts').Tosho[]} entries
   * @param {boolean} [batch=false]
   * @returns {import('../').TorrentResult[]}
   **/
  #map(entries, batch = false) {
    return entries.map(
      ({
        title,
        link,
        seeders = 0,
        leechers = 0,
        downloads = 0,
        hash,
        size,
        date,
      }) => ({
        title,
        link,
        seeders,
        leechers,
        downloads,
        hash,
        size,
        accuracy: batch ? "medium" : "high",
        type: batch ? "batch" : undefined,
        date: date ? new Date(date) : new Date(0),
      }),
    );
  }

  /**
   * @param {string} queryString
   * @param {{ resolution?: string, exclusions?: string[], episodeCount?: number }} options
   * @param {boolean} [batch=false]
   * @returns {Promise<import('../').TorrentResult[]>}
   */
  async #query(queryString, { resolution, exclusions }, batch = false) {
    const url = new URL(this.url + "/shiru" + queryString);
    if (resolution) url.searchParams.set("resolution", resolution);
    const res = await fetch(url);
    if (!res?.ok)
      throw new Error(
        `Failed to query source for results: HTTP ${res?.status} ${res?.statusText}`,
      );

    const payload = await res.json();
    const data = Array.isArray(payload?.data) ? payload.data : [];
    const filtered = exclusions?.length
      ? data.filter(
          ({ title }) =>
            !exclusions.some((ex) =>
              String(title || "")
                .toLowerCase()
                .includes(ex.toLowerCase()),
            ),
        )
      : data;
    return filtered.length ? this.#map(filtered, batch) : [];
  }

  /** @type {import('../').SearchFunction} */
  async single({ anidbEid, resolution, exclusions }) {
    if (!anidbEid) throw new Error("No anidbEid provided");
    return this.#query("?eid=" + anidbEid, { resolution, exclusions });
  }

  /** @type {import('../').SearchFunction} */
  async batch({ anidbAid, resolution, episodeCount, exclusions }) {
    if (!anidbAid) throw new Error("No anidbAid provided");
    if (episodeCount == null) throw new Error("No episodeCount provided");
    return this.#query("?aid=" + anidbAid, { resolution, exclusions }, true);
  }

  /** @type {import('../').SearchFunction} */
  async movie({ anidbAid, resolution, exclusions }) {
    if (!anidbAid) throw new Error("No anidbAid provided");
    return this.#query("?aid=" + anidbAid, { resolution, exclusions });
  }

  /** @returns {Promise<boolean>} */
  async validate() {
    try {
      const res = await fetch(this.url + "/caps");
      const payload = await res.json().catch(() => null);
      return res.ok && payload?.ok === true;
    } catch {
      return false;
    }
  }
})();
