declare module "react-simple-maps" {
  import type { ComponentType, ReactNode, SVGProps } from "react";
  import type { RegionFeature } from "./types.js";

  export interface ComposableMapProps extends SVGProps<SVGSVGElement> {
    children?: ReactNode;
    projection?: string;
    width?: number;
    height?: number;
    projectionConfig?: Record<string, unknown>;
    [key: string]: unknown;
  }

  export interface ZoomableGroupProps extends SVGProps<SVGGElement> {
    children?: ReactNode;
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    translateExtent?: [[number, number], [number, number]];
    onMoveStart?: () => void;
    onMoveEnd?: (position: { coordinates: [number, number]; zoom: number }) => void;
    [key: string]: unknown;
  }

  export interface GeographyRenderArgs {
    geographies: RegionFeature[];
  }

  export interface GeographiesProps {
    geography: unknown;
    children?: (args: GeographyRenderArgs) => ReactNode;
    [key: string]: unknown;
  }

  export interface GeographyProps extends SVGProps<SVGPathElement> {
    geography: unknown;
    tabIndex?: number;
    style?: Record<string, unknown>;
    [key: string]: unknown;
  }

  export interface MarkerProps extends SVGProps<SVGGElement> {
    coordinates: [number, number];
    children?: ReactNode;
    [key: string]: unknown;
  }

  export const ComposableMap: ComponentType<ComposableMapProps>;
  export const ZoomableGroup: ComponentType<ZoomableGroupProps>;
  export const Geographies: ComponentType<GeographiesProps>;
  export const Geography: ComponentType<GeographyProps>;
  export const Marker: ComponentType<MarkerProps>;
}
