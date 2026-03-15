"use client";

import { geoCentroid, geoMercator } from "d3-geo";
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";
import {
  buildChoroplethLegendItems,
  DEFAULT_CHOROPLETH_PALETTE,
  getChoroplethColor,
  resolveChoroplethDomain,
} from "../lib/choropleth.js";
import {
  DEFAULT_VIEWPORT,
  MAP_HEIGHT,
  MAP_MAX_ZOOM,
  MAP_WIDTH,
  applyViewportScreenOffset,
  areViewportsEqual,
  clampZoom,
  getFocusForFeature,
} from "../lib/geometry.js";
import { getDefaultSidoLabel, getSidoLabelOffset } from "../lib/labels.js";
import { createAssetBoundaryLoaders } from "../lib/loaders.js";
import { mergeTheme, mergeUiLabels } from "../lib/theme.js";
import type {
  GeographyStyleOverride,
  KoreaAdministrativeMapProps,
  KoreaAdministrativeMapRenderApi,
  KoreaMapChoroplethLevel,
  KoreaMapHoveredRegion,
  KoreaMapLabelOptions,
  KoreaMapOverlayPosition,
  KoreaMapRegionValueMap,
  KoreaMapSelection,
  KoreaMapStrokeOptions,
  KoreaMapTooltipContext,
  KoreaMapZoomOptions,
  MapViewport,
  RegionCollection,
  RegionFeature,
  RegionFeatureProperties,
  RegionLabelRenderContext,
  SggRegionSummary,
  SidoRegionSummary,
} from "../types.js";

const DEFAULT_ANIMATION_MS = 760;
const COMPACT_SIDO_PATTERN = /광역시|특별시|특별자치시/;
const DEFAULT_FONT_FAMILY = "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif";
const DEFAULT_PROJECTION_SCALE = 5680.969430313185;

type ResolvedStrokeLevel = {
  base: number;
  selected: number;
  hover: number;
  scaleWithZoom: boolean;
  zoomAttenuation: number;
};

const DEFAULT_STROKES: {
  borderColor: string;
  sido: ResolvedStrokeLevel;
  sgg: ResolvedStrokeLevel;
} = {
  borderColor: "#ffffff",
  sido: {
    base: 1.42,
    selected: 2.2,
    hover: 2.2,
    scaleWithZoom: true,
    zoomAttenuation: 0.68,
  },
  sgg: {
    base: 1.02,
    selected: 1.72,
    hover: 1.72,
    scaleWithZoom: true,
    zoomAttenuation: 0.68,
  },
};

const DEFAULT_ZOOM_OPTIONS: Required<KoreaMapZoomOptions> = {
  minZoom: 1,
  maxZoom: MAP_MAX_ZOOM,
  step: 1,
};

const DEFAULT_LABEL_OPTIONS: KoreaMapLabelOptions = {
  sido: {
    show: true,
    fontFamily: DEFAULT_FONT_FAMILY,
    fontWeight: 700,
    baseSize: 23,
    sizeAttenuation: 0.72,
    fill: "#06275E",
    selectedFill: "#06275E",
    letterSpacing: "-0.01em",
    halo: true,
    haloColor: "rgba(255, 255, 255, 0.98)",
    haloWidth: 5.8,
    minZoom: 0,
    formatter: (summary) => getDefaultSidoLabel(summary.name),
    secondaryFormatter: undefined,
    secondaryBaseSize: 11,
    secondarySizeAttenuation: 0.82,
    secondaryOffsetY: 18,
  },
  sgg: {
    show: true,
    fontFamily: DEFAULT_FONT_FAMILY,
    fontWeight: 700,
    baseSize: 14.5,
    sizeAttenuation: 0.92,
    fill: "#06275E",
    selectedFill: "#004098",
    letterSpacing: "-0.01em",
    halo: true,
    haloColor: "rgba(255, 255, 255, 0.98)",
    haloWidth: 3.6,
    minZoom: 0,
    formatter: (summary) => summary.name,
  },
};

type ViewportAnimationOptions = {
  duration?: number;
  immediate?: boolean;
};

function normalizeSelection(selection?: Partial<KoreaMapSelection>): KoreaMapSelection {
  return {
    sidoCode: selection?.sidoCode ?? null,
    sggCode: selection?.sggCode ?? null,
  };
}

function normalizeZoomOptions(zoomOptions?: KoreaMapZoomOptions) {
  const minZoom = zoomOptions?.minZoom ?? DEFAULT_ZOOM_OPTIONS.minZoom;
  const maxZoom = zoomOptions?.maxZoom ?? DEFAULT_ZOOM_OPTIONS.maxZoom;

  if (minZoom <= maxZoom) {
    return {
      minZoom,
      maxZoom,
      step: zoomOptions?.step ?? DEFAULT_ZOOM_OPTIONS.step,
    };
  }

  return {
    minZoom: maxZoom,
    maxZoom: minZoom,
    step: zoomOptions?.step ?? DEFAULT_ZOOM_OPTIONS.step,
  };
}

function clampViewportToZoomOptions(
  viewport: MapViewport,
  zoomOptions: ReturnType<typeof normalizeZoomOptions>,
): MapViewport {
  const boundedMinZoom = clampZoom(viewport.minZoom, zoomOptions.minZoom, zoomOptions.maxZoom);
  const boundedZoom = clampZoom(viewport.zoom, boundedMinZoom, zoomOptions.maxZoom);

  return {
    center: viewport.center,
    zoom: boundedZoom,
    minZoom: Math.min(boundedZoom, boundedMinZoom),
    maxZoom: zoomOptions.maxZoom,
  };
}

function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function easeInOutCubic(progress: number) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function resolveStrokeWidth(
  stroke: ResolvedStrokeLevel,
  weight: number,
  zoom: number,
) {
  if (!stroke.scaleWithZoom) {
    return weight;
  }

  const zoomAttenuation = Math.pow(Math.max(zoom, 1), stroke.zoomAttenuation);
  return Number((weight / zoomAttenuation).toFixed(3));
}

function getMapLabelSize(viewport: MapViewport, baseSize: number, attenuation = 0.74) {
  return baseSize / Math.pow(Math.max(viewport.zoom, 1), attenuation);
}

function normalizeLabelOptions(
  theme: ReturnType<typeof mergeTheme>,
  labelOptions?: KoreaMapLabelOptions,
) {
  return {
    sido: {
      ...DEFAULT_LABEL_OPTIONS.sido,
      fill: theme.label,
      selectedFill: theme.label,
      haloColor: theme.labelHalo,
      ...(labelOptions?.sido ?? {}),
    },
    sgg: {
      ...DEFAULT_LABEL_OPTIONS.sgg,
      fill: theme.label,
      selectedFill: theme.selectedLabel,
      haloColor: theme.labelHalo,
      ...(labelOptions?.sgg ?? {}),
    },
  };
}

function normalizeStrokeOptions(
  theme: ReturnType<typeof mergeTheme>,
  strokes?: KoreaMapStrokeOptions,
) {
  return {
    borderColor: strokes?.borderColor ?? theme.border,
    sido: {
      ...DEFAULT_STROKES.sido,
      ...(strokes?.sido ?? {}),
    } satisfies ResolvedStrokeLevel,
    sgg: {
      ...DEFAULT_STROKES.sgg,
      ...(strokes?.sgg ?? {}),
    } satisfies ResolvedStrokeLevel,
  };
}

function getSidoFocusProfile(sido: SidoRegionSummary) {
  const isCompactSido = COMPACT_SIDO_PATTERN.test(sido.name) || sido.sggCount <= 5;

  if (isCompactSido) {
    return {
      padding: 0.94,
      fitMaxZoom: 13.4,
      defaultZoomBoost: 1.1,
      extraZoomAllowance: 12.8,
    };
  }

  return {
    padding: 0.96,
    fitMaxZoom: 11.4,
    defaultZoomBoost: 0.35,
    extraZoomAllowance: 10.4,
  };
}

function getSidoViewport(
  focusTarget: RegionFeature,
  sido: SidoRegionSummary,
  screenOffset: { x: number; y: number },
  zoomOptions: ReturnType<typeof normalizeZoomOptions>,
): MapViewport {
  const focusProfile = getSidoFocusProfile(sido);
  const focus = getFocusForFeature(focusTarget, {
    padding: focusProfile.padding,
    minZoom: zoomOptions.minZoom,
    maxZoom: Math.min(focusProfile.fitMaxZoom, zoomOptions.maxZoom),
    screenOffset,
  });
  const targetZoom = clampZoom(
    focus.zoom + focusProfile.defaultZoomBoost,
    focus.zoom,
    zoomOptions.maxZoom,
  );
  const targetMaxZoom = clampZoom(
    targetZoom + focusProfile.extraZoomAllowance,
    targetZoom,
    zoomOptions.maxZoom,
  );

  return clampViewportToZoomOptions(
    {
      center: focus.center,
      zoom: targetZoom,
      minZoom: targetZoom,
      maxZoom: targetMaxZoom,
    },
    zoomOptions,
  );
}

function getSggViewport(
  focusTarget: RegionFeature,
  currentViewport: MapViewport,
  screenOffset: { x: number; y: number },
  zoomOptions: ReturnType<typeof normalizeZoomOptions>,
): MapViewport {
  const focus = getFocusForFeature(focusTarget, {
    padding: 0.54,
    minZoom: currentViewport.minZoom,
    maxZoom: zoomOptions.maxZoom,
    screenOffset,
  });

  return clampViewportToZoomOptions(
    {
      center: focus.center,
      zoom: clampZoom(
        Math.max(currentViewport.zoom, focus.zoom),
        currentViewport.minZoom,
        zoomOptions.maxZoom,
      ),
      minZoom: currentViewport.minZoom,
      maxZoom: zoomOptions.maxZoom,
    },
    zoomOptions,
  );
}

function mergeGeographyStyle(base: GeographyStyleOverride, override?: GeographyStyleOverride) {
  return {
    default: {
      ...base.default,
      ...override?.default,
    },
    hover: {
      ...base.hover,
      ...override?.hover,
    },
    pressed: {
      ...base.pressed,
      ...override?.pressed,
    },
  };
}

function createDefaultSidoLabel(
  context: RegionLabelRenderContext<SidoRegionSummary>,
  options: ReturnType<typeof normalizeLabelOptions>["sido"],
) {
  const offset = options.offsets?.[context.summary.code] ?? getSidoLabelOffset(context.summary.code);
  const primaryLabel = options.formatter?.(context.summary) ?? getDefaultSidoLabel(context.summary.name);
  const secondaryLabel = options.secondaryFormatter?.(context.summary);
  const primaryFill = context.isSelected ? options.selectedFill : options.fill;
  const secondaryY = getMapLabelSize(
    context.viewport,
    options.secondaryOffsetY ?? 18,
    options.secondarySizeAttenuation ?? 0.82,
  );

  return (
    <g
      transform={`translate(${offset.x / context.viewport.zoom} ${offset.y / context.viewport.zoom})`}
      style={{ pointerEvents: "none", opacity: 0.98 }}
    >
      <text
        textAnchor="middle"
        fontFamily={options.fontFamily}
        fontSize={getMapLabelSize(
          context.viewport,
          options.baseSize ?? 23,
          options.sizeAttenuation ?? 0.72,
        )}
        fontWeight={options.fontWeight}
        fill={primaryFill}
        stroke={options.halo ? options.haloColor : "transparent"}
        strokeWidth={
          options.halo
            ? getMapLabelSize(
                context.viewport,
                options.haloWidth ?? 5.8,
                options.sizeAttenuation ?? 0.82,
              )
            : 0
        }
        paintOrder="stroke"
        letterSpacing={options.letterSpacing}
      >
        {primaryLabel}
      </text>
      {secondaryLabel ? (
        <text
          y={secondaryY}
          textAnchor="middle"
          fontFamily={options.fontFamily}
          fontSize={getMapLabelSize(
            context.viewport,
            options.secondaryBaseSize ?? 11,
            options.secondarySizeAttenuation ?? 0.82,
          )}
          fontWeight={options.fontWeight}
          fill={primaryFill}
          stroke={options.halo ? options.haloColor : "transparent"}
          strokeWidth={
            options.halo
              ? getMapLabelSize(
                  context.viewport,
                  Math.max((options.haloWidth ?? 5.8) * 0.52, 1.2),
                  options.secondarySizeAttenuation ?? 0.9,
                )
              : 0
          }
          paintOrder="stroke"
          letterSpacing={options.letterSpacing}
        >
          {secondaryLabel}
        </text>
      ) : null}
    </g>
  );
}

function createDefaultSggLabel(
  context: RegionLabelRenderContext<SggRegionSummary>,
  options: ReturnType<typeof normalizeLabelOptions>["sgg"],
) {
  const fill = context.isSelected ? options.selectedFill : options.fill;

  return (
    <g style={{ pointerEvents: "none", opacity: 0.98 }}>
      <text
        textAnchor="middle"
        fontFamily={options.fontFamily}
        fontSize={getMapLabelSize(
          context.viewport,
          options.baseSize ?? 14.5,
          options.sizeAttenuation ?? 0.92,
        )}
        fontWeight={options.fontWeight}
        fill={fill}
        stroke={options.halo ? options.haloColor : "transparent"}
        strokeWidth={
          options.halo
            ? getMapLabelSize(
                context.viewport,
                options.haloWidth ?? 3.6,
                options.sizeAttenuation ?? 1,
              )
            : 0
        }
        paintOrder="stroke"
        letterSpacing={options.letterSpacing}
      >
        {options.formatter?.(context.summary) ?? context.summary.name}
      </text>
    </g>
  );
}

function createControlButtonStyle(disabled: boolean, theme: ReturnType<typeof mergeTheme>) {
  return {
    appearance: "none",
    border: `1px solid ${theme.controlBorder}`,
    background: disabled ? "rgba(255,255,255,0.72)" : theme.controlBackground,
    color: disabled ? "rgba(23, 50, 77, 0.44)" : theme.controlText,
    boxShadow: theme.controlShadow,
    borderRadius: 999,
    minWidth: 48,
    height: 48,
    padding: "0 14px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 15,
    fontWeight: 700,
    pointerEvents: "auto",
  } satisfies CSSProperties;
}

function getOverlayPositionStyle(position: KoreaMapOverlayPosition, offset = 16) {
  switch (position) {
    case "top-left":
      return {
        top: offset,
        left: offset,
      };
    case "bottom-left":
      return {
        bottom: offset,
        left: offset,
      };
    case "bottom-right":
      return {
        right: offset,
        bottom: offset,
      };
    case "top-right":
    default:
      return {
        top: offset,
        right: offset,
      };
  }
}

function getViewportTransform(viewportCenter: [number, number], zoom: number) {
  const projection = geoMercator()
    .center(DEFAULT_VIEWPORT.center)
    .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2])
    .scale(DEFAULT_PROJECTION_SCALE);
  const [projectedX, projectedY] = projection(viewportCenter) ?? [MAP_WIDTH / 2, MAP_HEIGHT / 2];

  return {
    x: MAP_WIDTH / 2 - projectedX * zoom,
    y: MAP_HEIGHT / 2 - projectedY * zoom,
    scale: zoom,
  };
}

function handleGeographyKeyDown(
  event: ReactKeyboardEvent<SVGPathElement>,
  callback: () => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    callback();
  }
}

function getCurrentDepth(selection: KoreaMapSelection) {
  if (selection.sggCode) {
    return "sgg" as const;
  }

  if (selection.sidoCode) {
    return "sido" as const;
  }

  return "country" as const;
}

function getActiveChoroplethLevel(
  configuredLevel: KoreaMapChoroplethLevel,
  selection: KoreaMapSelection,
  maxDepth: "sido" | "sgg",
) {
  if (configuredLevel !== "current") {
    return configuredLevel;
  }

  if (selection.sidoCode && maxDepth === "sgg") {
    return "sgg" as const;
  }

  return "sido" as const;
}

function getDefaultTooltipContent(context: KoreaMapTooltipContext) {
  return (
    <>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.72 }}>
        {context.level}
      </div>
      <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700 }}>
        {context.level === "sgg"
          ? `${(context.summary as SggRegionSummary).sidoName} ${(context.summary as SggRegionSummary).name}`
          : (context.summary as SidoRegionSummary).name}
      </div>
      {context.value !== null ? (
        <div style={{ marginTop: 4, fontSize: 12, opacity: 0.82 }}>
          value: {context.value.toLocaleString()}
        </div>
      ) : null}
    </>
  );
}

export function KoreaAdministrativeMap({
  metadata,
  assetBasePath = "/boundaries",
  loaders,
  className,
  style,
  theme,
  labels,
  strokes,
  labelOptions,
  zoomOptions,
  drilldown,
  choropleth,
  regionFills,
  tooltip,
  selection: controlledSelection,
  defaultSelection,
  defaultViewport,
  focusScreenOffset,
  initialSidoCollection = null,
  initialSggCollections,
  showControls = true,
  showSidoLabels = true,
  showSggLabels = true,
  animations,
  onSelectionChange,
  onViewportChange,
  onError,
  onHoverRegionChange,
  getSidoStyle,
  getSggStyle,
  renderSidoLabel,
  renderSggLabel,
  renderOverlay,
}: KoreaAdministrativeMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resolvedTheme = useMemo(() => mergeTheme(theme), [theme]);
  const resolvedLabels = useMemo(() => mergeUiLabels(labels), [labels]);
  const resolvedStrokeOptions = useMemo(
    () => normalizeStrokeOptions(resolvedTheme, strokes),
    [resolvedTheme, strokes],
  );
  const baseLabelOptions = useMemo(
    () => normalizeLabelOptions(resolvedTheme, labelOptions),
    [labelOptions, resolvedTheme],
  );
  const resolvedLabelOptions = useMemo(
    () => ({
      sido: {
        ...baseLabelOptions.sido,
        show: showSidoLabels && baseLabelOptions.sido.show !== false,
      },
      sgg: {
        ...baseLabelOptions.sgg,
        show: showSggLabels && baseLabelOptions.sgg.show !== false,
      },
    }),
    [baseLabelOptions, showSggLabels, showSidoLabels],
  );
  const resolvedZoomOptions = useMemo(
    () => normalizeZoomOptions(zoomOptions),
    [zoomOptions],
  );
  const resolvedDefaultViewport = useMemo(
    () => clampViewportToZoomOptions(defaultViewport ?? DEFAULT_VIEWPORT, resolvedZoomOptions),
    [defaultViewport, resolvedZoomOptions],
  );
  const resolvedFocusScreenOffset = useMemo(
    () => ({
      x: focusScreenOffset?.x ?? 0,
      y: focusScreenOffset?.y ?? 0,
    }),
    [focusScreenOffset?.x, focusScreenOffset?.y],
  );
  const resolvedLoaders = useMemo(
    () => loaders ?? createAssetBoundaryLoaders(assetBasePath),
    [assetBasePath, loaders],
  );
  const animationDurationMs = animations?.durationMs ?? DEFAULT_ANIMATION_MS;
  const animationsEnabled = animations?.enabled ?? true;
  const maxDepth = drilldown?.maxDepth ?? "sgg";
  const resolvedTooltip = useMemo(
    () => ({
      enabled: tooltip?.enabled ?? false,
      followCursor: tooltip?.followCursor ?? true,
      anchor: tooltip?.anchor ?? "top-left",
      offset: {
        x: tooltip?.offset?.x ?? 18,
        y: tooltip?.offset?.y ?? 18,
      },
      render: tooltip?.render,
    }),
    [tooltip],
  );
  const sggCacheRef = useRef(new Map(Object.entries(initialSggCollections ?? {})));
  const viewportRef = useRef<MapViewport>(resolvedDefaultViewport);
  const viewportFrameRef = useRef<number | null>(null);
  const hasAppliedSelectionViewportRef = useRef(false);
  const lastAnimatedSelectionKeyRef = useRef<string | null>(null);
  const isViewportAnimatingRef = useRef(false);

  const [viewport, setViewport] = useState<MapViewport>(resolvedDefaultViewport);
  const [internalSelection, setInternalSelection] = useState<KoreaMapSelection>(
    normalizeSelection(defaultSelection),
  );
  const [sidoCollection, setSidoCollection] = useState(initialSidoCollection);
  const [sggCollection, setSggCollection] = useState<RegionCollection | null>(null);
  const [isSidoLoading, setIsSidoLoading] = useState(false);
  const [isSggLoading, setIsSggLoading] = useState(false);
  const [canUseHover, setCanUseHover] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<KoreaMapHoveredRegion | null>(null);
  const [hoveredPointer, setHoveredPointer] = useState<{ x: number; y: number } | null>(null);

  const rawSelection = controlledSelection ?? internalSelection;
  const selection = useMemo(() => {
    const normalized = normalizeSelection(rawSelection);

    if (maxDepth === "sido") {
      return {
        ...normalized,
        sggCode: null,
      };
    }

    return normalized;
  }, [maxDepth, rawSelection]);

  const currentDepth = getCurrentDepth(selection);
  const isChoroplethEnabled = choropleth?.enabled ?? false;
  const activeChoroplethLevel = getActiveChoroplethLevel(
    choropleth?.level ?? "current",
    selection,
    maxDepth,
  );
  const activePalette = choropleth?.palette?.length
    ? choropleth.palette
    : DEFAULT_CHOROPLETH_PALETTE;
  const choroplethPreserveSelectionFill = choropleth?.preserveSelectionFill ?? true;
  const regionFillsEnabled = regionFills?.enabled ?? false;
  const regionFillsPreserveSelectionFill = regionFills?.preserveSelectionFill ?? true;

  const sidoByCode = useMemo(
    () => new Map(metadata.sido.map((region) => [region.code, region])),
    [metadata.sido],
  );
  const selectedSido = useMemo(
    () => (selection.sidoCode ? sidoByCode.get(selection.sidoCode) ?? null : null),
    [selection.sidoCode, sidoByCode],
  );
  const selectedSggList = useMemo(
    () => (selection.sidoCode ? metadata.sggBySido[selection.sidoCode] ?? [] : []),
    [metadata.sggBySido, selection.sidoCode],
  );
  const selectedSggByCode = useMemo(
    () => new Map(selectedSggList.map((region) => [region.code, region])),
    [selectedSggList],
  );
  const selectedSgg = useMemo(
    () => (selection.sggCode ? selectedSggByCode.get(selection.sggCode) ?? null : null),
    [selection.sggCode, selectedSggByCode],
  );
  const sidoFeatures = useMemo<RegionFeature[]>(
    () => sidoCollection?.features ?? [],
    [sidoCollection],
  );
  const sggFeatures = useMemo<RegionFeature[]>(
    () => sggCollection?.features ?? [],
    [sggCollection],
  );
  const renderedViewportCenter = useMemo(
    () =>
      applyViewportScreenOffset(
        viewport.center,
        viewport.zoom,
        resolvedFocusScreenOffset,
      ),
    [resolvedFocusScreenOffset, viewport.center, viewport.zoom],
  );
  const viewportTransform = useMemo(
    () => getViewportTransform(renderedViewportCenter, viewport.zoom),
    [renderedViewportCenter, viewport.zoom],
  );
  const isLoading = isSidoLoading || isSggLoading;
  const activeChoroplethValues = useMemo<KoreaMapRegionValueMap | undefined>(() => {
    if (!isChoroplethEnabled) {
      return undefined;
    }

    if (activeChoroplethLevel === "sgg") {
      return choropleth?.sggValues;
    }

    return choropleth?.sidoValues;
  }, [activeChoroplethLevel, choropleth?.sggValues, choropleth?.sidoValues, isChoroplethEnabled]);
  const activeChoroplethDomain = useMemo(
    () =>
      isChoroplethEnabled
        ? resolveChoroplethDomain(
            {
              domain: choropleth?.domain,
            },
            activeChoroplethValues,
          )
        : null,
    [activeChoroplethValues, choropleth?.domain, isChoroplethEnabled],
  );
  const formatLegendValue = useMemo(
    () =>
      choropleth?.formatValue ??
      ((value: number) =>
        value.toLocaleString(undefined, {
          maximumFractionDigits: choropleth?.legendDecimals ?? 1,
        })),
    [choropleth?.formatValue, choropleth?.legendDecimals],
  );
  const legendItems = useMemo(
    () =>
      isChoroplethEnabled && choropleth?.showLegend
        ? buildChoroplethLegendItems({
            domain: activeChoroplethDomain,
            palette: activePalette,
            formatValue: formatLegendValue,
          })
        : [],
    [
      activeChoroplethDomain,
      activePalette,
      choropleth?.showLegend,
      formatLegendValue,
      isChoroplethEnabled,
    ],
  );

  function stopViewportAnimation() {
    if (viewportFrameRef.current !== null) {
      cancelAnimationFrame(viewportFrameRef.current);
      viewportFrameRef.current = null;
    }

    isViewportAnimatingRef.current = false;
  }

  function commitViewport(nextViewport: MapViewport) {
    if (areViewportsEqual(viewportRef.current, nextViewport)) {
      viewportRef.current = nextViewport;
      return;
    }

    viewportRef.current = nextViewport;
    setViewport(nextViewport);
  }

  function animateViewport(nextViewport: MapViewport, options: ViewportAnimationOptions = {}) {
    const current = viewportRef.current;
    const boundedViewport = clampViewportToZoomOptions(nextViewport, resolvedZoomOptions);

    if (areViewportsEqual(current, boundedViewport)) {
      commitViewport(boundedViewport);
      return;
    }

    stopViewportAnimation();

    if (!animationsEnabled || options.immediate) {
      commitViewport(boundedViewport);
      return;
    }

    const startedAt = performance.now();
    const duration = options.duration ?? animationDurationMs;
    isViewportAnimatingRef.current = true;

    const step = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = easeInOutCubic(progress);
      const intermediateViewport = clampViewportToZoomOptions(
        {
          center: [
            lerp(current.center[0], boundedViewport.center[0], eased),
            lerp(current.center[1], boundedViewport.center[1], eased),
          ],
          zoom: lerp(current.zoom, boundedViewport.zoom, eased),
          minZoom: lerp(current.minZoom, boundedViewport.minZoom, eased),
          maxZoom: boundedViewport.maxZoom,
        },
        resolvedZoomOptions,
      );

      viewportRef.current = intermediateViewport;
      setViewport(intermediateViewport);

      if (progress < 1) {
        viewportFrameRef.current = requestAnimationFrame(step);
        return;
      }

      viewportFrameRef.current = null;
      isViewportAnimatingRef.current = false;
      commitViewport(boundedViewport);
    };

    viewportFrameRef.current = requestAnimationFrame(step);
  }

  function emitSelection(nextSelection: KoreaMapSelection) {
    const normalized = normalizeSelection(nextSelection);
    const boundedSelection =
      maxDepth === "sido"
        ? {
            ...normalized,
            sggCode: null,
          }
        : normalized;

    if (
      selection.sidoCode === boundedSelection.sidoCode &&
      selection.sggCode === boundedSelection.sggCode
    ) {
      return;
    }

    if (!controlledSelection) {
      startTransition(() => {
        setInternalSelection(boundedSelection);
      });
    }

    onSelectionChange?.(boundedSelection);
  }

  function reset() {
    emitSelection({
      sidoCode: null,
      sggCode: null,
    });
  }

  function stepBack() {
    if (selection.sggCode) {
      emitSelection({
        sidoCode: selection.sidoCode,
        sggCode: null,
      });
      return;
    }

    reset();
  }

  function selectSido(code: string) {
    if (!sidoByCode.has(code)) {
      return;
    }

    emitSelection({
      sidoCode: code,
      sggCode: null,
    });
  }

  function selectSgg(code: string) {
    if (maxDepth !== "sgg" || !selection.sidoCode || !selectedSggByCode.has(code)) {
      return;
    }

    emitSelection({
      sidoCode: selection.sidoCode,
      sggCode: code,
    });
  }

  function setSelection(nextSelection: KoreaMapSelection) {
    emitSelection(nextSelection);
  }

  function zoomBy(delta: number) {
    const currentViewport = viewportRef.current;
    const nextZoom = clampZoom(
      currentViewport.zoom + delta,
      currentViewport.minZoom,
      currentViewport.maxZoom,
    );

    animateViewport(
      {
        ...currentViewport,
        zoom: nextZoom,
      },
      {
        duration: 260,
      },
    );
  }

  function getRegionValue(level: "sido" | "sgg", code: string) {
    if (!isChoroplethEnabled) {
      return null;
    }

    const source = level === "sgg" ? choropleth?.sggValues : choropleth?.sidoValues;
    const value = source?.[code];

    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function getChoroplethFill(level: "sido" | "sgg", code: string, isSelected: boolean) {
    if (!isChoroplethEnabled || activeChoroplethLevel !== level) {
      return null;
    }

    if (!choroplethPreserveSelectionFill && isSelected) {
      return null;
    }

    const color = getChoroplethColor(getRegionValue(level, code), activeChoroplethDomain, activePalette);

    return color ?? choropleth?.nullFill ?? null;
  }

  function getRegionFill(level: "sido" | "sgg", code: string, isSelected: boolean) {
    if (!regionFillsEnabled) {
      return null;
    }

    if (!regionFillsPreserveSelectionFill && isSelected) {
      return null;
    }

    const source = level === "sgg" ? regionFills?.sgg : regionFills?.sido;
    const color = source?.[code];

    return typeof color === "string" && color.length > 0
      ? color
      : regionFills?.nullFill ?? null;
  }

  function createHoveredRegion<TSummary extends SidoRegionSummary | SggRegionSummary>(options: {
    level: "sido" | "sgg";
    geography: RegionFeature;
    properties: RegionFeatureProperties;
    summary: TSummary;
  }) {
    const [longitude, latitude] = geoCentroid(options.geography);

    return {
      level: options.level,
      code: options.properties.code,
      geography: options.geography,
      properties: options.properties,
      summary: options.summary,
      coordinates: [longitude, latitude] as [number, number],
      value: getRegionValue(options.level, options.properties.code),
    } satisfies KoreaMapHoveredRegion<TSummary>;
  }

  function updateHoveredPointer(event: ReactMouseEvent<SVGPathElement, MouseEvent>) {
    const rect = containerRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    setHoveredPointer({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }

  function handleRegionMouseEnter<TSummary extends SidoRegionSummary | SggRegionSummary>(
    region: KoreaMapHoveredRegion<TSummary>,
    event: ReactMouseEvent<SVGPathElement, MouseEvent>,
  ) {
    updateHoveredPointer(event);
    setHoveredRegion(region);
  }

  function handleRegionMouseMove(event: ReactMouseEvent<SVGPathElement, MouseEvent>) {
    if (!resolvedTooltip.enabled || !resolvedTooltip.followCursor) {
      return;
    }

    updateHoveredPointer(event);
  }

  function clearHoveredRegion() {
    setHoveredRegion(null);
    setHoveredPointer(null);
  }

  const api: KoreaAdministrativeMapRenderApi = {
    selection,
    viewport,
    currentDepth,
    selectedSido,
    selectedSgg,
    selectedSggList,
    hoveredRegion,
    legendItems,
    isLoading,
    error,
    reset,
    stepBack,
    zoomIn: () => zoomBy(resolvedZoomOptions.step),
    zoomOut: () => zoomBy(-resolvedZoomOptions.step),
    selectSido,
    selectSgg,
    setSelection,
  };

  useEffect(() => {
    return () => {
      stopViewportAnimation();
    };
  }, []);

  useEffect(() => {
    onViewportChange?.(viewport);
  }, [onViewportChange, viewport]);

  useEffect(() => {
    onHoverRegionChange?.(hoveredRegion);
  }, [hoveredRegion, onHoverRegionChange]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const updateHoverCapability = () => {
      setCanUseHover(mediaQuery.matches);
    };

    updateHoverCapability();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateHoverCapability);

      return () => {
        mediaQuery.removeEventListener("change", updateHoverCapability);
      };
    }

    mediaQuery.addListener(updateHoverCapability);

    return () => {
      mediaQuery.removeListener(updateHoverCapability);
    };
  }, []);

  useEffect(() => {
    const boundedViewport = clampViewportToZoomOptions(viewportRef.current, resolvedZoomOptions);

    if (!areViewportsEqual(viewportRef.current, boundedViewport)) {
      commitViewport(boundedViewport);
      return;
    }

    if (
      viewportRef.current.minZoom !== boundedViewport.minZoom ||
      viewportRef.current.maxZoom !== boundedViewport.maxZoom
    ) {
      commitViewport(boundedViewport);
    }
  }, [resolvedZoomOptions]);

  useEffect(() => {
    if (selection.sidoCode && !sidoByCode.has(selection.sidoCode)) {
      emitSelection({
        sidoCode: null,
        sggCode: null,
      });
      return;
    }

    if (!selection.sidoCode && selection.sggCode) {
      emitSelection({
        sidoCode: null,
        sggCode: null,
      });
      return;
    }

    if (selection.sggCode && maxDepth === "sido") {
      emitSelection({
        sidoCode: selection.sidoCode,
        sggCode: null,
      });
      return;
    }

    if (selection.sggCode && !selectedSggByCode.has(selection.sggCode)) {
      emitSelection({
        sidoCode: selection.sidoCode,
        sggCode: null,
      });
    }
  }, [maxDepth, selection.sggCode, selection.sidoCode, selectedSggByCode, sidoByCode]);

  useEffect(() => {
    if (sidoCollection) {
      return;
    }

    const abortController = new AbortController();

    async function loadSido() {
      try {
        setIsSidoLoading(true);
        setError(null);
        const nextCollection = await resolvedLoaders.loadSidoCollection({
          signal: abortController.signal,
        });

        if (!abortController.signal.aborted) {
          setSidoCollection(nextCollection);
        }
      } catch (caughtError) {
        if (abortController.signal.aborted) {
          return;
        }

        const nextError =
          caughtError instanceof Error
            ? caughtError
            : new Error("Failed to load sido boundary data.");

        setError(nextError);
        onError?.(nextError);
      } finally {
        if (!abortController.signal.aborted) {
          setIsSidoLoading(false);
        }
      }
    }

    loadSido();

    return () => {
      abortController.abort();
    };
  }, [onError, resolvedLoaders, sidoCollection]);

  useEffect(() => {
    if (maxDepth !== "sgg" || !selection.sidoCode) {
      setSggCollection(null);
      setIsSggLoading(false);
      return;
    }

    const cachedCollection = sggCacheRef.current.get(selection.sidoCode);

    if (cachedCollection) {
      setSggCollection(cachedCollection);
      setIsSggLoading(false);
      return;
    }

    setSggCollection(null);

    const abortController = new AbortController();

    async function loadSgg() {
      try {
        setIsSggLoading(true);
        setError(null);
        const nextCollection = await resolvedLoaders.loadSggCollection(selection.sidoCode!, {
          signal: abortController.signal,
        });

        if (!abortController.signal.aborted) {
          sggCacheRef.current.set(selection.sidoCode!, nextCollection);
          setSggCollection(nextCollection);
        }
      } catch (caughtError) {
        if (abortController.signal.aborted) {
          return;
        }

        const nextError =
          caughtError instanceof Error
            ? caughtError
            : new Error("Failed to load sgg boundary data.");

        setError(nextError);
        onError?.(nextError);
      } finally {
        if (!abortController.signal.aborted) {
          setIsSggLoading(false);
        }
      }
    }

    loadSgg();

    return () => {
      abortController.abort();
    };
  }, [maxDepth, onError, resolvedLoaders, selection.sidoCode]);

  useEffect(() => {
    clearHoveredRegion();
  }, [selection.sggCode, selection.sidoCode, maxDepth]);

  useEffect(() => {
    if (!sidoCollection) {
      return;
    }

    const currentSelectionKey = `${selection.sidoCode ?? ""}:${selection.sggCode ?? ""}:${maxDepth}`;

    if (lastAnimatedSelectionKeyRef.current === currentSelectionKey) {
      return;
    }

    const immediate = !hasAppliedSelectionViewportRef.current;

    if (!selection.sidoCode) {
      animateViewport(resolvedDefaultViewport, {
        duration: 540,
        immediate,
      });
      hasAppliedSelectionViewportRef.current = true;
      lastAnimatedSelectionKeyRef.current = currentSelectionKey;
      return;
    }

    if (!selectedSido) {
      return;
    }

    const selectedSidoFeature = sidoFeatures.find(
      (feature) => feature.properties.code === selectedSido.code,
    );

    if (!selectedSidoFeature) {
      return;
    }

    if (maxDepth === "sido" || !selection.sggCode) {
      animateViewport(
        getSidoViewport(
          selectedSidoFeature,
          selectedSido,
          resolvedFocusScreenOffset,
          resolvedZoomOptions,
        ),
        {
          duration: animationDurationMs,
          immediate,
        },
      );
      hasAppliedSelectionViewportRef.current = true;
      lastAnimatedSelectionKeyRef.current = currentSelectionKey;
      return;
    }

    if (!sggCollection) {
      return;
    }

    const selectedSggFeature = sggFeatures.find(
      (feature) => feature.properties.code === selection.sggCode,
    );

    if (!selectedSggFeature) {
      return;
    }

    animateViewport(
      getSggViewport(
        selectedSggFeature,
        viewportRef.current,
        resolvedFocusScreenOffset,
        resolvedZoomOptions,
      ),
      {
        duration: Math.max(320, animationDurationMs - 80),
        immediate,
      },
    );
    hasAppliedSelectionViewportRef.current = true;
    lastAnimatedSelectionKeyRef.current = currentSelectionKey;
  }, [
    animationDurationMs,
    maxDepth,
    resolvedDefaultViewport,
    resolvedFocusScreenOffset,
    resolvedZoomOptions,
    selection.sggCode,
    selection.sidoCode,
    selectedSido,
    sggCollection,
    sggFeatures,
    sidoCollection,
    sidoFeatures,
  ]);

  function renderSidoFill(properties: RegionFeatureProperties, isSelected: boolean) {
    const regionFill = getRegionFill("sido", properties.code, isSelected);

    if (regionFill) {
      return regionFill;
    }

    const choroplethFill = getChoroplethFill("sido", properties.code, isSelected);

    if (choroplethFill) {
      return choroplethFill;
    }

    if (!selection.sidoCode) {
      return resolvedTheme.baseSidoFill;
    }

    return isSelected ? resolvedTheme.selectedSidoFill : resolvedTheme.inactiveSidoFill;
  }

  function renderSggFill(properties: RegionFeatureProperties, isSelected: boolean) {
    const regionFill = getRegionFill("sgg", properties.code, isSelected);

    if (regionFill) {
      return regionFill;
    }

    const choroplethFill = getChoroplethFill("sgg", properties.code, isSelected);

    if (choroplethFill) {
      return choroplethFill;
    }

    if (!selection.sggCode) {
      return resolvedTheme.baseSggFill;
    }

    return isSelected ? resolvedTheme.selectedSggFill : resolvedTheme.inactiveSggFill;
  }

  const canZoomIn = viewport.zoom < viewport.maxZoom - 0.01;
  const canZoomOut = viewport.zoom > viewport.minZoom + 0.01;
  const canStepBack = Boolean(selection.sidoCode);
  const tooltipContent = hoveredRegion
    ? (resolvedTooltip.render
        ? resolvedTooltip.render({
            ...hoveredRegion,
            selection,
            viewport,
            theme: resolvedTheme,
          } as KoreaMapTooltipContext)
        : getDefaultTooltipContent({
            ...hoveredRegion,
            selection,
            viewport,
            theme: resolvedTheme,
          } as KoreaMapTooltipContext))
    : null;
  const legendPositionStyle = getOverlayPositionStyle(
    choropleth?.legendPosition ?? "top-right",
  );
  const tooltipAnchorStyle = getOverlayPositionStyle(resolvedTooltip.anchor);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 520,
        overflow: "hidden",
        background: resolvedTheme.surface,
        borderRadius: 24,
        ...style,
      }}
    >
      {error ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            padding: 24,
            textAlign: "center",
            color: "#b42318",
            fontSize: 14,
            zIndex: 20,
          }}
        >
          {error.message}
        </div>
      ) : null}

      {isLoading ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 15,
            display: "grid",
            placeItems: "center",
            background: resolvedTheme.loadingBackdrop,
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              border: `1px solid ${resolvedTheme.controlBorder}`,
              background: resolvedTheme.controlBackground,
              color: resolvedTheme.loadingText,
              padding: "10px 16px",
              borderRadius: 999,
              boxShadow: resolvedTheme.controlShadow,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {resolvedLabels.loading}
          </div>
        </div>
      ) : null}

      <ComposableMap
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        projection="geoMercator"
        projectionConfig={{
          center: DEFAULT_VIEWPORT.center,
          scale: DEFAULT_PROJECTION_SCALE,
        }}
        style={{
          width: "100%",
          height: "100%",
        }}
      >
        <g
          transform={`translate(${viewportTransform.x} ${viewportTransform.y}) scale(${viewportTransform.scale})`}
        >
          {sidoCollection ? (
            <Geographies geography={sidoCollection}>
              {({ geographies }: { geographies: RegionFeature[] }) => (
                <>
                  {geographies.map((geography) => {
                    const properties = geography.properties as RegionFeatureProperties;
                    const summary = sidoByCode.get(properties.code);

                    if (!summary) {
                      return null;
                    }

                    const isSelected = properties.code === selection.sidoCode;
                    const value = getRegionValue("sido", summary.code);
                    const baseFill = renderSidoFill(properties, isSelected);
                    const baseStrokeWidth = resolveStrokeWidth(
                      resolvedStrokeOptions.sido,
                      isSelected
                        ? resolvedStrokeOptions.sido.selected
                        : resolvedStrokeOptions.sido.base,
                      viewport.zoom,
                    );
                    const hoverStrokeWidth = resolveStrokeWidth(
                      resolvedStrokeOptions.sido,
                      resolvedStrokeOptions.sido.hover,
                      viewport.zoom,
                    );
                    const styleOverride = getSidoStyle?.({
                      geography,
                      properties,
                      summary,
                      isSelected,
                      selection,
                      viewport,
                      theme: resolvedTheme,
                      value,
                    });
                    const hoverFill =
                      activeChoroplethLevel === "sido" && isChoroplethEnabled
                        ? baseFill
                        : isSelected
                          ? resolvedTheme.selectedSggFill
                          : resolvedTheme.hoverFill;
                    const geographyStyle = mergeGeographyStyle(
                      {
                        default: {
                          fill: baseFill,
                          stroke: resolvedStrokeOptions.borderColor,
                          strokeWidth: baseStrokeWidth,
                          outline: "none",
                          transition: "fill 180ms ease, stroke 180ms ease, stroke-width 180ms ease",
                          cursor: "pointer",
                        },
                        hover: {
                          fill: canUseHover ? hoverFill : baseFill,
                          stroke: resolvedStrokeOptions.borderColor,
                          strokeWidth: hoverStrokeWidth,
                          outline: "none",
                          cursor: "pointer",
                        },
                        pressed: {
                          fill:
                            activeChoroplethLevel === "sido" && isChoroplethEnabled
                              ? baseFill
                              : resolvedTheme.hoverAccentFill,
                          stroke: resolvedStrokeOptions.borderColor,
                          strokeWidth: hoverStrokeWidth,
                          outline: "none",
                          cursor: "pointer",
                        },
                      },
                      styleOverride,
                    );
                    const hovered = createHoveredRegion({
                      level: "sido",
                      geography,
                      properties,
                      summary,
                    });

                    return (
                      <Geography
                        key={properties.code}
                        geography={geography}
                        onClick={() => selectSido(summary.code)}
                        onKeyDown={(event: ReactKeyboardEvent<SVGPathElement>) =>
                          handleGeographyKeyDown(event, () => selectSido(summary.code))
                        }
                        onMouseEnter={(event: ReactMouseEvent<SVGPathElement, MouseEvent>) =>
                          handleRegionMouseEnter(hovered, event)
                        }
                        onMouseMove={handleRegionMouseMove}
                        onMouseLeave={clearHoveredRegion}
                        role="button"
                        tabIndex={0}
                        aria-label={`Select ${summary.name}`}
                        style={geographyStyle}
                      />
                    );
                  })}

                  {resolvedLabelOptions.sido.show
                    ? geographies
                        .filter((geography) => {
                          const isSelected = geography.properties.code === selection.sidoCode;

                          if (viewport.zoom < (resolvedLabelOptions.sido.minZoom ?? 0)) {
                            return false;
                          }

                          if (!selection.sidoCode) {
                            return true;
                          }

                          if (maxDepth === "sido") {
                            return isSelected;
                          }

                          return false;
                        })
                        .map((geography) => {
                          const properties = geography.properties as RegionFeatureProperties;
                          const summary = sidoByCode.get(properties.code);

                          if (!summary) {
                            return null;
                          }

                          const [longitude, latitude] = geoCentroid(geography);
                          const labelContext: RegionLabelRenderContext<SidoRegionSummary> = {
                            geography,
                            properties,
                            summary,
                            coordinates: [longitude, latitude],
                            isSelected: properties.code === selection.sidoCode,
                            selection,
                            viewport,
                            theme: resolvedTheme,
                            value: getRegionValue("sido", summary.code),
                          };

                          return (
                            <Marker key={`sido-label-${summary.code}`} coordinates={[longitude, latitude]}>
                              {renderSidoLabel
                                ? renderSidoLabel(labelContext)
                                : createDefaultSidoLabel(labelContext, resolvedLabelOptions.sido)}
                            </Marker>
                          );
                        })
                    : null}
                </>
              )}
            </Geographies>
          ) : null}

          {maxDepth === "sgg" && sggCollection ? (
            <Geographies geography={sggCollection}>
              {({ geographies }: { geographies: RegionFeature[] }) => (
                <>
                  {geographies.map((geography) => {
                    const properties = geography.properties as RegionFeatureProperties;
                    const summary = selectedSggByCode.get(properties.code);

                    if (!summary) {
                      return null;
                    }

                    const isSelected = properties.code === selection.sggCode;
                    const value = getRegionValue("sgg", summary.code);
                    const baseFill = renderSggFill(properties, isSelected);
                    const baseStrokeWidth = resolveStrokeWidth(
                      resolvedStrokeOptions.sgg,
                      isSelected
                        ? resolvedStrokeOptions.sgg.selected
                        : resolvedStrokeOptions.sgg.base,
                      viewport.zoom,
                    );
                    const hoverStrokeWidth = resolveStrokeWidth(
                      resolvedStrokeOptions.sgg,
                      resolvedStrokeOptions.sgg.hover,
                      viewport.zoom,
                    );
                    const styleOverride = getSggStyle?.({
                      geography,
                      properties,
                      summary,
                      isSelected,
                      selection,
                      viewport,
                      theme: resolvedTheme,
                      value,
                    });
                    const hoverFill =
                      activeChoroplethLevel === "sgg" && isChoroplethEnabled
                        ? baseFill
                        : isSelected
                          ? resolvedTheme.hoverAccentFill
                          : resolvedTheme.hoverFill;
                    const geographyStyle = mergeGeographyStyle(
                      {
                        default: {
                          fill: baseFill,
                          stroke: resolvedStrokeOptions.borderColor,
                          strokeWidth: baseStrokeWidth,
                          outline: "none",
                          transition: "fill 160ms ease, stroke 160ms ease, stroke-width 160ms ease",
                          cursor: "pointer",
                        },
                        hover: {
                          fill: canUseHover ? hoverFill : baseFill,
                          stroke: resolvedStrokeOptions.borderColor,
                          strokeWidth: hoverStrokeWidth,
                          outline: "none",
                          cursor: "pointer",
                        },
                        pressed: {
                          fill:
                            activeChoroplethLevel === "sgg" && isChoroplethEnabled
                              ? baseFill
                              : resolvedTheme.selectedSggFill,
                          stroke: resolvedStrokeOptions.borderColor,
                          strokeWidth: hoverStrokeWidth,
                          outline: "none",
                          cursor: "pointer",
                        },
                      },
                      styleOverride,
                    );
                    const hovered = createHoveredRegion({
                      level: "sgg",
                      geography,
                      properties,
                      summary,
                    });

                    return (
                      <Geography
                        key={properties.code}
                        geography={geography}
                        onClick={() => selectSgg(summary.code)}
                        onKeyDown={(event: ReactKeyboardEvent<SVGPathElement>) =>
                          handleGeographyKeyDown(event, () => selectSgg(summary.code))
                        }
                        onMouseEnter={(event: ReactMouseEvent<SVGPathElement, MouseEvent>) =>
                          handleRegionMouseEnter(hovered, event)
                        }
                        onMouseMove={handleRegionMouseMove}
                        onMouseLeave={clearHoveredRegion}
                        role="button"
                        tabIndex={0}
                        aria-label={`Select ${summary.sidoName} ${summary.name}`}
                        style={geographyStyle}
                      />
                    );
                  })}

                  {resolvedLabelOptions.sgg.show && viewport.zoom >= (resolvedLabelOptions.sgg.minZoom ?? 0)
                    ? geographies.map((geography) => {
                        const properties = geography.properties as RegionFeatureProperties;
                        const summary = selectedSggByCode.get(properties.code);

                        if (!summary) {
                          return null;
                        }

                        const [longitude, latitude] = geoCentroid(geography);
                        const labelContext: RegionLabelRenderContext<SggRegionSummary> = {
                          geography,
                          properties,
                          summary,
                          coordinates: [longitude, latitude],
                          isSelected: properties.code === selection.sggCode,
                          selection,
                          viewport,
                          theme: resolvedTheme,
                          value: getRegionValue("sgg", summary.code),
                        };

                        return (
                          <Marker key={`sgg-label-${summary.code}`} coordinates={[longitude, latitude]}>
                            {renderSggLabel
                              ? renderSggLabel(labelContext)
                              : createDefaultSggLabel(labelContext, resolvedLabelOptions.sgg)}
                          </Marker>
                        );
                      })
                    : null}
                </>
              )}
            </Geographies>
          ) : null}
        </g>
      </ComposableMap>

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 25,
          pointerEvents: "none",
        }}
      >
        {showControls ? (
          <div
            style={{
              position: "absolute",
              right: 16,
              bottom: 16,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <button
              type="button"
              aria-label={resolvedLabels.zoomIn}
              disabled={!canZoomIn}
              onClick={() => zoomBy(resolvedZoomOptions.step)}
              style={createControlButtonStyle(!canZoomIn, resolvedTheme)}
            >
              +
            </button>
            <button
              type="button"
              aria-label={resolvedLabels.zoomOut}
              disabled={!canZoomOut}
              onClick={() => zoomBy(-resolvedZoomOptions.step)}
              style={createControlButtonStyle(!canZoomOut, resolvedTheme)}
            >
              -
            </button>
            {canStepBack ? (
              <button
                type="button"
                aria-label={resolvedLabels.back}
                onClick={stepBack}
                style={createControlButtonStyle(false, resolvedTheme)}
              >
                {resolvedLabels.back}
              </button>
            ) : null}
          </div>
        ) : null}

        {isChoroplethEnabled && choropleth?.showLegend && legendItems.length > 0 ? (
          <div
            style={{
              position: "absolute",
              ...legendPositionStyle,
              width: 200,
              padding: 12,
              borderRadius: 18,
              background: resolvedTheme.legendBackground,
              border: `1px solid ${resolvedTheme.legendBorder}`,
              color: resolvedTheme.legendText,
              boxShadow: resolvedTheme.controlShadow,
              pointerEvents: "auto",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700 }}>
              {choropleth.legendTitle ?? "Legend"}
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {legendItems.map((item) => (
                <div
                  key={`${item.color}-${item.label}`}
                  style={{ display: "grid", gridTemplateColumns: "16px 1fr", gap: 8, alignItems: "center" }}
                >
                  <span
                    style={{
                      display: "block",
                      width: 16,
                      height: 16,
                      borderRadius: 999,
                      background: item.color,
                    }}
                  />
                  <span style={{ fontSize: 12 }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {resolvedTooltip.enabled && hoveredRegion && tooltipContent ? (
          <div
            style={{
              position: "absolute",
              ...(resolvedTooltip.followCursor
                ? {
                    left: (hoveredPointer?.x ?? 0) + resolvedTooltip.offset.x,
                    top: (hoveredPointer?.y ?? 0) + resolvedTooltip.offset.y,
                  }
                : tooltipAnchorStyle),
              maxWidth: 220,
              padding: "10px 12px",
              borderRadius: 14,
              background: resolvedTheme.tooltipBackground,
              border: `1px solid ${resolvedTheme.tooltipBorder}`,
              boxShadow: resolvedTheme.controlShadow,
              color: resolvedTheme.tooltipText,
              pointerEvents: "none",
              zIndex: 30,
            }}
          >
            {tooltipContent}
          </div>
        ) : null}

        {renderOverlay ? renderOverlay(api) : null}
      </div>
    </div>
  );
}
