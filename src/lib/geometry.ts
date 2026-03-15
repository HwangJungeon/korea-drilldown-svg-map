import { geoMercator, geoPath } from "d3-geo";
import { feature as topojsonFeature } from "topojson-client";
import type {
  BoundaryTopology,
  MapViewport,
  RegionCollection,
  RegionFeature,
  ViewportScreenOffset,
} from "../types.js";

export const MAP_WIDTH = 800;
export const MAP_HEIGHT = 980;
export const MAP_MAX_ZOOM = 24;

const BASE_SCALE = 5680.969430313185;
const BASE_CENTER: [number, number] = [128.24049129023038, 35.83054207791391];

export const DEFAULT_VIEWPORT: MapViewport = {
  center: BASE_CENTER,
  zoom: 1.16,
  minZoom: 1,
  maxZoom: MAP_MAX_ZOOM,
};

function createProjection() {
  return geoMercator()
    .center(BASE_CENTER)
    .scale(BASE_SCALE)
    .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2]);
}

function offsetViewportCenter(
  center: [number, number],
  zoom: number,
  direction: 1 | -1,
  screenOffset: ViewportScreenOffset = {},
) {
  const projection = createProjection();
  const point = projection(center);

  if (!point || !projection.invert) {
    return center;
  }

  const offsetCenter = projection.invert([
    point[0] - ((screenOffset.x ?? 0) / Math.max(zoom, 1)) * direction,
    point[1] + ((screenOffset.y ?? 0) / Math.max(zoom, 1)) * direction,
  ]) as [number, number] | undefined;

  return offsetCenter ?? center;
}

export function applyViewportScreenOffset(
  center: [number, number],
  zoom: number,
  screenOffset?: ViewportScreenOffset,
) {
  return offsetViewportCenter(center, zoom, 1, screenOffset);
}

export function removeViewportScreenOffset(
  center: [number, number],
  zoom: number,
  screenOffset?: ViewportScreenOffset,
) {
  return offsetViewportCenter(center, zoom, -1, screenOffset);
}

export function clampZoom(value: number, minZoom = 1, maxZoom = MAP_MAX_ZOOM) {
  return Math.min(maxZoom, Math.max(minZoom, value));
}

export function topologyToRegions(topology: BoundaryTopology): RegionCollection {
  const regions = topology.objects.regions;

  if (!regions) {
    throw new Error("Missing regions layer in topology payload.");
  }

  return topojsonFeature(topology, regions) as RegionCollection;
}

export function getFocusForFeature(
  target: RegionFeature,
  options?: {
    padding?: number;
    minZoom?: number;
    maxZoom?: number;
    screenOffset?: ViewportScreenOffset;
  },
): Pick<MapViewport, "center" | "zoom"> {
  const projection = createProjection();
  const path = geoPath(projection);
  const [[x0, y0], [x1, y1]] = path.bounds(target);

  if (![x0, y0, x1, y1].every(Number.isFinite)) {
    return {
      center: BASE_CENTER,
      zoom: 1,
    };
  }

  const centerX = (x0 + x1) / 2;
  const centerY = (y0 + y1) / 2;
  const frameCenterX = MAP_WIDTH / 2 + (options?.screenOffset?.x ?? 0);
  const frameCenterY = MAP_HEIGHT / 2 - (options?.screenOffset?.y ?? 0);
  const padding = options?.padding ?? 0.84;
  const zoomByLeft = (frameCenterX * padding) / Math.max(centerX - x0, 1);
  const zoomByRight = ((MAP_WIDTH - frameCenterX) * padding) / Math.max(x1 - centerX, 1);
  const zoomByTop = (frameCenterY * padding) / Math.max(centerY - y0, 1);
  const zoomByBottom = ((MAP_HEIGHT - frameCenterY) * padding) / Math.max(y1 - centerY, 1);
  const nextZoom = clampZoom(
    Math.min(zoomByLeft, zoomByRight, zoomByTop, zoomByBottom),
    options?.minZoom ?? 1,
    options?.maxZoom ?? MAP_MAX_ZOOM,
  );

  if (!projection.invert) {
    return {
      center: BASE_CENTER,
      zoom: nextZoom,
    };
  }

  const center = projection.invert([centerX, centerY]) as [number, number] | undefined;

  return {
    center: center ?? BASE_CENTER,
    zoom: nextZoom,
  };
}

export function areViewportsEqual(a: MapViewport, b: MapViewport) {
  return (
    a.center[0] === b.center[0] &&
    a.center[1] === b.center[1] &&
    a.zoom === b.zoom &&
    a.minZoom === b.minZoom &&
    a.maxZoom === b.maxZoom
  );
}
