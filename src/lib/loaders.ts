import type { KoreaMapLoaders, KoreaRegionsDataset, LoadBoundaryOptions } from "../types.js";
import type { BoundaryTopology } from "../types.js";
import { topologyToRegions } from "./geometry.js";

const BUNDLED_REGIONS_METADATA_URL = new URL(
  "../../data/boundaries/regions.json",
  import.meta.url,
).href;
const BUNDLED_SIDO_COLLECTION_URL = new URL(
  "../../data/boundaries/sido/all.topo.json",
  import.meta.url,
).href;
const BUNDLED_SGG_COLLECTION_URLS: Record<string, string> = {
  "11": new URL("../../data/boundaries/sgg/by-sido/11.topo.json", import.meta.url).href,
  "26": new URL("../../data/boundaries/sgg/by-sido/26.topo.json", import.meta.url).href,
  "27": new URL("../../data/boundaries/sgg/by-sido/27.topo.json", import.meta.url).href,
  "28": new URL("../../data/boundaries/sgg/by-sido/28.topo.json", import.meta.url).href,
  "29": new URL("../../data/boundaries/sgg/by-sido/29.topo.json", import.meta.url).href,
  "30": new URL("../../data/boundaries/sgg/by-sido/30.topo.json", import.meta.url).href,
  "31": new URL("../../data/boundaries/sgg/by-sido/31.topo.json", import.meta.url).href,
  "36": new URL("../../data/boundaries/sgg/by-sido/36.topo.json", import.meta.url).href,
  "41": new URL("../../data/boundaries/sgg/by-sido/41.topo.json", import.meta.url).href,
  "43": new URL("../../data/boundaries/sgg/by-sido/43.topo.json", import.meta.url).href,
  "44": new URL("../../data/boundaries/sgg/by-sido/44.topo.json", import.meta.url).href,
  "46": new URL("../../data/boundaries/sgg/by-sido/46.topo.json", import.meta.url).href,
  "47": new URL("../../data/boundaries/sgg/by-sido/47.topo.json", import.meta.url).href,
  "48": new URL("../../data/boundaries/sgg/by-sido/48.topo.json", import.meta.url).href,
  "50": new URL("../../data/boundaries/sgg/by-sido/50.topo.json", import.meta.url).href,
  "51": new URL("../../data/boundaries/sgg/by-sido/51.topo.json", import.meta.url).href,
  "52": new URL("../../data/boundaries/sgg/by-sido/52.topo.json", import.meta.url).href,
};

function resolveAssetBasePath(basePath = "/boundaries") {
  return basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
}

async function fetchJson<T>(url: string, options?: LoadBoundaryOptions): Promise<T> {
  const response = await fetch(url, {
    cache: "force-cache",
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load JSON data from ${url}`);
  }

  return (await response.json()) as T;
}

function resolveBundledSggCollectionUrl(sidoCode: string) {
  const url = BUNDLED_SGG_COLLECTION_URLS[sidoCode];

  if (!url) {
    throw new Error(`Bundled boundary data is not available for sidoCode "${sidoCode}"`);
  }

  return url;
}

export async function fetchBoundaryCollection(url: string, options?: LoadBoundaryOptions) {
  return topologyToRegions(await fetchJson<BoundaryTopology>(url, options));
}

export function createAssetBoundaryLoaders(basePath = "/boundaries"): KoreaMapLoaders {
  const normalizedBasePath = resolveAssetBasePath(basePath);

  return {
    loadSidoCollection: (options) =>
      fetchBoundaryCollection(`${normalizedBasePath}/sido/all.topo.json`, options),
    loadSggCollection: (sidoCode, options) =>
      fetchBoundaryCollection(`${normalizedBasePath}/sgg/by-sido/${sidoCode}.topo.json`, options),
  };
}

export function createBundledBoundaryLoaders(): KoreaMapLoaders {
  return {
    loadSidoCollection: (options) => fetchBoundaryCollection(BUNDLED_SIDO_COLLECTION_URL, options),
    loadSggCollection: (sidoCode, options) =>
      fetchBoundaryCollection(resolveBundledSggCollectionUrl(sidoCode), options),
  };
}

export async function loadRegionsMetadata(
  basePath = "/boundaries",
  options?: LoadBoundaryOptions,
): Promise<KoreaRegionsDataset> {
  const normalizedBasePath = resolveAssetBasePath(basePath);
  return fetchJson<KoreaRegionsDataset>(`${normalizedBasePath}/regions.json`, options);
}

export async function loadBundledRegionsMetadata(
  options?: LoadBoundaryOptions,
): Promise<KoreaRegionsDataset> {
  return fetchJson<KoreaRegionsDataset>(BUNDLED_REGIONS_METADATA_URL, options);
}
