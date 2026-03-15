import type { KoreaMapTheme, KoreaMapUiLabels } from "../types.js";

export const DEFAULT_THEME: KoreaMapTheme = {
  surface: "#ffffff",
  loadingBackdrop: "rgba(255, 255, 255, 0.72)",
  loadingText: "#48657d",
  controlBackground: "rgba(255, 255, 255, 0.96)",
  controlBorder: "#dbe5ee",
  controlText: "#17324d",
  controlShadow: "0 18px 34px rgba(89, 117, 148, 0.12)",
  baseSidoFill: "rgba(164, 168, 171, 0.22)",
  inactiveSidoFill: "rgba(164, 168, 171, 0.14)",
  selectedSidoFill: "#0073CF",
  baseSggFill: "rgba(0, 115, 207, 0.14)",
  inactiveSggFill: "rgba(164, 168, 171, 0.16)",
  selectedSggFill: "#004098",
  hoverFill: "rgba(0, 115, 207, 0.12)",
  hoverAccentFill: "#0073CF",
  border: "#ffffff",
  label: "#06275E",
  selectedLabel: "#004098",
  labelHalo: "rgba(255, 255, 255, 0.98)",
  legendBackground: "rgba(255, 255, 255, 0.94)",
  legendBorder: "#dbe5ee",
  legendText: "#17324d",
  tooltipBackground: "rgba(255, 255, 255, 0.96)",
  tooltipBorder: "#dbe5ee",
  tooltipText: "#17324d",
};

export const DEFAULT_UI_LABELS: KoreaMapUiLabels = {
  loading: "Loading boundaries...",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  back: "Back",
};

export function mergeTheme(theme?: Partial<KoreaMapTheme>): KoreaMapTheme {
  return {
    ...DEFAULT_THEME,
    ...theme,
  };
}

export function mergeUiLabels(labels?: Partial<KoreaMapUiLabels>): KoreaMapUiLabels {
  return {
    ...DEFAULT_UI_LABELS,
    ...labels,
  };
}
