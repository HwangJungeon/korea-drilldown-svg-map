import type { CSSProperties, ReactNode } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryObject, Topology } from "topojson-specification";

export type RegionLevel = "sido" | "sgg" | "dong";
export type KoreaMapDepth = "country" | "sido" | "sgg";
export type KoreaMapSelectableDepth = "sido" | "sgg";
export type KoreaMapChoroplethLevel = "sido" | "sgg" | "current";
export type KoreaMapOverlayPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface RegionFeatureProperties {
  code: string;
  name: string;
  level: RegionLevel;
  label: string;
  sidoCode?: string;
  sidoName?: string;
  sggCode?: string;
  sggName?: string;
  code10?: string;
}

export type RegionFeature = Feature<Geometry, RegionFeatureProperties>;
export type RegionCollection = FeatureCollection<Geometry, RegionFeatureProperties>;
export type BoundaryTopology = Topology<Record<string, GeometryObject>>;

export interface SidoRegionSummary {
  code: string;
  name: string;
  sggCount: number;
}

export interface SggRegionSummary {
  code: string;
  name: string;
  sidoCode: string;
  sidoName: string;
}

export interface KoreaRegionsDataset {
  source?: string;
  generatedAt?: string;
  counts?: {
    sido: number;
    sgg: number;
    dong: number;
  };
  sido: SidoRegionSummary[];
  sgg: SggRegionSummary[];
  sggBySido: Record<string, SggRegionSummary[]>;
}

export interface MapViewport {
  center: [number, number];
  zoom: number;
  minZoom: number;
  maxZoom: number;
}

export interface ViewportScreenOffset {
  x?: number;
  y?: number;
}

export interface LoadBoundaryOptions {
  signal?: AbortSignal;
}

export interface KoreaMapSelection {
  sidoCode: string | null;
  sggCode: string | null;
}

export interface KoreaMapLoaders {
  loadSidoCollection: (options?: LoadBoundaryOptions) => Promise<RegionCollection>;
  loadSggCollection: (sidoCode: string, options?: LoadBoundaryOptions) => Promise<RegionCollection>;
}

export interface KoreaMapTheme {
  surface: string;
  loadingBackdrop: string;
  loadingText: string;
  controlBackground: string;
  controlBorder: string;
  controlText: string;
  controlShadow: string;
  baseSidoFill: string;
  inactiveSidoFill: string;
  selectedSidoFill: string;
  baseSggFill: string;
  inactiveSggFill: string;
  selectedSggFill: string;
  hoverFill: string;
  hoverAccentFill: string;
  border: string;
  label: string;
  selectedLabel: string;
  labelHalo: string;
  legendBackground: string;
  legendBorder: string;
  legendText: string;
  tooltipBackground: string;
  tooltipBorder: string;
  tooltipText: string;
}

export interface KoreaMapUiLabels {
  loading: string;
  zoomIn: string;
  zoomOut: string;
  back: string;
}

export interface GeographyStyleState {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  outline?: string;
  cursor?: CSSProperties["cursor"];
  transition?: string;
}

export interface GeographyStyleOverride {
  default?: GeographyStyleState;
  hover?: GeographyStyleState;
  pressed?: GeographyStyleState;
}

export interface KoreaMapStrokeLevelOptions {
  base?: number;
  selected?: number;
  hover?: number;
  scaleWithZoom?: boolean;
  zoomAttenuation?: number;
}

export interface KoreaMapStrokeOptions {
  borderColor?: string;
  sido?: KoreaMapStrokeLevelOptions;
  sgg?: KoreaMapStrokeLevelOptions;
}

export interface KoreaMapBaseLabelOptions {
  show?: boolean;
  fontFamily?: string;
  fontWeight?: number | string;
  baseSize?: number;
  sizeAttenuation?: number;
  fill?: string;
  selectedFill?: string;
  letterSpacing?: string;
  halo?: boolean;
  haloColor?: string;
  haloWidth?: number;
  minZoom?: number;
}

export interface KoreaMapSidoLabelOptions extends KoreaMapBaseLabelOptions {
  offsets?: Record<string, { x: number; y: number }>;
  formatter?: (summary: SidoRegionSummary) => string;
  secondaryFormatter?: (summary: SidoRegionSummary) => string | null | undefined;
  secondaryBaseSize?: number;
  secondarySizeAttenuation?: number;
  secondaryOffsetY?: number;
}

export interface KoreaMapSggLabelOptions extends KoreaMapBaseLabelOptions {
  formatter?: (summary: SggRegionSummary) => string;
}

export interface KoreaMapLabelOptions {
  sido?: KoreaMapSidoLabelOptions;
  sgg?: KoreaMapSggLabelOptions;
}

export interface KoreaMapZoomOptions {
  minZoom?: number;
  maxZoom?: number;
  step?: number;
}

export interface KoreaMapDrilldownOptions {
  maxDepth?: KoreaMapSelectableDepth;
}

export type KoreaMapRegionValueMap = Record<string, number | null | undefined>;

export interface KoreaMapLegendItem {
  color: string;
  label: string;
  from: number;
  to: number;
}

export interface KoreaMapChoroplethOptions {
  enabled?: boolean;
  level?: KoreaMapChoroplethLevel;
  sidoValues?: KoreaMapRegionValueMap;
  sggValues?: KoreaMapRegionValueMap;
  domain?: [number, number];
  palette?: string[];
  nullFill?: string;
  showLegend?: boolean;
  legendTitle?: string;
  legendDecimals?: number;
  legendPosition?: KoreaMapOverlayPosition;
  preserveSelectionFill?: boolean;
  formatValue?: (value: number) => string;
}

export type KoreaMapRegionColorMap = Record<string, string | null | undefined>;

export interface KoreaMapRegionFillOptions {
  enabled?: boolean;
  sido?: KoreaMapRegionColorMap;
  sgg?: KoreaMapRegionColorMap;
  nullFill?: string;
  preserveSelectionFill?: boolean;
}

export interface KoreaMapHoveredRegion<TSummary = SidoRegionSummary | SggRegionSummary> {
  level: "sido" | "sgg";
  code: string;
  geography: RegionFeature;
  properties: RegionFeatureProperties;
  summary: TSummary;
  coordinates: [number, number];
  value: number | null;
}

export interface KoreaMapTooltipContext<TSummary = SidoRegionSummary | SggRegionSummary>
  extends KoreaMapHoveredRegion<TSummary> {
  selection: KoreaMapSelection;
  viewport: MapViewport;
  theme: KoreaMapTheme;
}

export interface KoreaMapTooltipOptions {
  enabled?: boolean;
  followCursor?: boolean;
  anchor?: KoreaMapOverlayPosition;
  offset?: ViewportScreenOffset;
  render?: (context: KoreaMapTooltipContext) => ReactNode;
}

export interface RegionStyleContext<TSummary> {
  geography: RegionFeature;
  properties: RegionFeatureProperties;
  summary: TSummary;
  isSelected: boolean;
  selection: KoreaMapSelection;
  viewport: MapViewport;
  theme: KoreaMapTheme;
  value: number | null;
}

export interface RegionLabelRenderContext<TSummary> {
  geography: RegionFeature;
  properties: RegionFeatureProperties;
  summary: TSummary;
  coordinates: [number, number];
  isSelected: boolean;
  selection: KoreaMapSelection;
  viewport: MapViewport;
  theme: KoreaMapTheme;
  value: number | null;
}

export interface KoreaAdministrativeMapRenderApi {
  selection: KoreaMapSelection;
  viewport: MapViewport;
  currentDepth: KoreaMapDepth;
  selectedSido: SidoRegionSummary | null;
  selectedSgg: SggRegionSummary | null;
  selectedSggList: SggRegionSummary[];
  hoveredRegion: KoreaMapHoveredRegion | null;
  legendItems: KoreaMapLegendItem[];
  isLoading: boolean;
  error: Error | null;
  reset: () => void;
  stepBack: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  selectSido: (code: string) => void;
  selectSgg: (code: string) => void;
  setSelection: (selection: KoreaMapSelection) => void;
}

export interface KoreaAdministrativeMapProps {
  metadata: KoreaRegionsDataset;
  assetBasePath?: string;
  loaders?: KoreaMapLoaders;
  className?: string;
  style?: CSSProperties;
  theme?: Partial<KoreaMapTheme>;
  labels?: Partial<KoreaMapUiLabels>;
  strokes?: KoreaMapStrokeOptions;
  labelOptions?: KoreaMapLabelOptions;
  zoomOptions?: KoreaMapZoomOptions;
  drilldown?: KoreaMapDrilldownOptions;
  choropleth?: KoreaMapChoroplethOptions;
  regionFills?: KoreaMapRegionFillOptions;
  tooltip?: KoreaMapTooltipOptions;
  selection?: KoreaMapSelection;
  defaultSelection?: Partial<KoreaMapSelection>;
  defaultViewport?: MapViewport;
  focusScreenOffset?: ViewportScreenOffset;
  initialSidoCollection?: RegionCollection | null;
  initialSggCollections?: Record<string, RegionCollection>;
  showControls?: boolean;
  showSidoLabels?: boolean;
  showSggLabels?: boolean;
  animations?: {
    enabled?: boolean;
    durationMs?: number;
  };
  onSelectionChange?: (selection: KoreaMapSelection) => void;
  onViewportChange?: (viewport: MapViewport) => void;
  onError?: (error: Error) => void;
  onHoverRegionChange?: (region: KoreaMapHoveredRegion | null) => void;
  getSidoStyle?: (
    context: RegionStyleContext<SidoRegionSummary>,
  ) => GeographyStyleOverride | undefined;
  getSggStyle?: (
    context: RegionStyleContext<SggRegionSummary>,
  ) => GeographyStyleOverride | undefined;
  renderSidoLabel?: (
    context: RegionLabelRenderContext<SidoRegionSummary>,
  ) => ReactNode;
  renderSggLabel?: (
    context: RegionLabelRenderContext<SggRegionSummary>,
  ) => ReactNode;
  renderOverlay?: (api: KoreaAdministrativeMapRenderApi) => ReactNode;
}
