import type { KoreaMapLoaders, KoreaRegionsDataset, LoadBoundaryOptions } from "../types.js";
import type { BoundaryTopology } from "../types.js";
import { topologyToRegions } from "./geometry.js";

function resolveAssetBasePath(basePath = "/boundaries") {
  return basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
}

export async function fetchBoundaryCollection(url: string, options?: LoadBoundaryOptions) {
  const response = await fetch(url, {
    cache: "force-cache",
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load boundary data from ${url}`);
  }

  return topologyToRegions((await response.json()) as BoundaryTopology);
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

export async function loadRegionsMetadata(
  basePath = "/boundaries",
  options?: LoadBoundaryOptions,
): Promise<KoreaRegionsDataset> {
  const normalizedBasePath = resolveAssetBasePath(basePath);
  const response = await fetch(`${normalizedBasePath}/regions.json`, {
    cache: "force-cache",
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load region metadata from ${normalizedBasePath}/regions.json`);
  }

  return (await response.json()) as KoreaRegionsDataset;
}
