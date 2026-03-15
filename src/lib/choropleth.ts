import type {
  KoreaMapChoroplethOptions,
  KoreaMapLegendItem,
  KoreaMapRegionValueMap,
} from "../types.js";

export const DEFAULT_CHOROPLETH_PALETTE = [
  "#e8f0fe",
  "#c6dafc",
  "#9abcf9",
  "#5e8ff0",
  "#2b68d8",
  "#124ab3",
] as const;

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function getChoroplethValues(values?: KoreaMapRegionValueMap) {
  if (!values) {
    return [];
  }

  return Object.values(values).filter(isFiniteNumber);
}

export function resolveChoroplethDomain(
  options: Pick<KoreaMapChoroplethOptions, "domain">,
  values?: KoreaMapRegionValueMap,
) {
  if (options.domain) {
    const [min, max] = options.domain;
    return min <= max ? [min, max] as [number, number] : [max, min] as [number, number];
  }

  const numericValues = getChoroplethValues(values);

  if (numericValues.length === 0) {
    return null;
  }

  const min = Math.min(...numericValues);
  const max = Math.max(...numericValues);

  return [min, max] as [number, number];
}

export function getChoroplethColor(
  value: number | null | undefined,
  domain: [number, number] | null,
  palette: readonly string[] = DEFAULT_CHOROPLETH_PALETTE,
) {
  if (!isFiniteNumber(value) || !domain || palette.length === 0) {
    return null;
  }

  const [min, max] = domain;

  if (max <= min) {
    return palette[palette.length - 1] ?? null;
  }

  const normalized = (value - min) / (max - min);
  const index = Math.min(
    palette.length - 1,
    Math.max(0, Math.floor(normalized * palette.length)),
  );

  return palette[index] ?? null;
}

export function buildChoroplethLegendItems(options: {
  domain: [number, number] | null;
  palette?: readonly string[];
  formatValue?: (value: number) => string;
}): KoreaMapLegendItem[] {
  const { domain } = options;
  const palette = options.palette?.length ? options.palette : DEFAULT_CHOROPLETH_PALETTE;

  if (!domain || palette.length === 0) {
    return [];
  }

  const [min, max] = domain;

  if (max <= min) {
    return [
      {
        color: palette[palette.length - 1]!,
        from: min,
        to: max,
        label: options.formatValue ? options.formatValue(max) : `${max}`,
      },
    ];
  }

  const step = (max - min) / palette.length;

  return palette.map((color, index) => {
    const from = min + step * index;
    const to = index === palette.length - 1 ? max : min + step * (index + 1);
    const formatValue = options.formatValue ?? ((value: number) => value.toFixed(1));

    return {
      color,
      from,
      to,
      label: `${formatValue(from)} - ${formatValue(to)}`,
    };
  });
}
