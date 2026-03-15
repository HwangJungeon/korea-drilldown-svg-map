"use client";

import { Children, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  KoreaAdministrativeMap,
  createBundledBoundaryLoaders,
  getDefaultSidoLabel,
  loadBundledRegionsMetadata,
  type KoreaMapChoroplethLevel,
  type KoreaMapHoveredRegion,
  type KoreaMapOverlayPosition,
  type KoreaMapSelectableDepth,
  type KoreaMapSelection,
  type KoreaRegionsDataset,
} from "korea-drilldown-svg-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const FEATURED_SIDO_CODES = ["11", "26", "27", "28", "41", "43", "44", "47", "48"];

const FONT_OPTIONS = [
  { label: "IBM Plex Sans KR", value: "'IBM Plex Sans KR', 'Noto Sans KR', sans-serif" },
  { label: "Pretendard 계열", value: "'Pretendard Variable', 'Pretendard', sans-serif" },
  { label: "Noto Sans KR", value: "'Noto Sans KR', sans-serif" },
  { label: "시스템 Sans", value: "ui-sans-serif, system-ui, sans-serif" },
] as const;

const FONT_WEIGHT_OPTIONS = [
  { label: "500", value: "500" },
  { label: "600", value: "600" },
  { label: "700", value: "700" },
  { label: "800", value: "800" },
] as const;

const SIDO_LABEL_MODE_OPTIONS = [
  { label: "축약형", value: "compact" },
  { label: "원문", value: "full" },
  { label: "코드 포함", value: "code" },
] as const;

const SGG_LABEL_MODE_OPTIONS = [
  { label: "이름", value: "name" },
  { label: "코드", value: "code" },
  { label: "값 포함", value: "value" },
] as const;

const FILL_MODE_OPTIONS = [
  { label: "기본 테마", value: "base" },
  { label: "Choropleth", value: "choropleth" },
  { label: "정적 지역 색상", value: "fills" },
  { label: "혼합", value: "hybrid" },
] as const;

const PALETTE_PRESETS = {
  ocean: ["#e0f2fe", "#bae6fd", "#7dd3fc", "#38bdf8", "#0284c7", "#0f4c81"],
  ember: ["#fff7ed", "#fed7aa", "#fdba74", "#fb923c", "#ea580c", "#9a3412"],
  moss: ["#f0fdf4", "#bbf7d0", "#86efac", "#4ade80", "#16a34a", "#166534"],
} as const;

const CORNER_OPTIONS = [
  { label: "좌상단", value: "top-left" },
  { label: "우상단", value: "top-right" },
  { label: "좌하단", value: "bottom-left" },
  { label: "우하단", value: "bottom-right" },
] as const;

const MAP_THEME = {
  surface: "rgba(255, 255, 255, 0.98)",
  loadingBackdrop: "rgba(248, 250, 252, 0.82)",
  loadingText: "#334155",
  controlBackground: "rgba(255, 255, 255, 0.96)",
  controlBorder: "#dbe2ea",
  controlText: "#0f172a",
  controlShadow: "0 16px 40px rgba(15, 23, 42, 0.10)",
  baseSidoFill: "rgba(148, 163, 184, 0.22)",
  inactiveSidoFill: "rgba(148, 163, 184, 0.14)",
  selectedSidoFill: "#2563eb",
  baseSggFill: "rgba(37, 99, 235, 0.14)",
  inactiveSggFill: "rgba(148, 163, 184, 0.16)",
  selectedSggFill: "#1d4ed8",
  hoverFill: "rgba(37, 99, 235, 0.16)",
  hoverAccentFill: "#2563eb",
  border: "#ffffff",
  label: "#0f172a",
  selectedLabel: "#1d4ed8",
  labelHalo: "rgba(255, 255, 255, 0.98)",
  legendBackground: "rgba(255, 255, 255, 0.96)",
  legendBorder: "#dbe2ea",
  legendText: "#0f172a",
  tooltipBackground: "rgba(255, 255, 255, 0.98)",
  tooltipBorder: "#dbe2ea",
  tooltipText: "#0f172a",
} as const;

const DEMO_LABELS = {
  loading: "행정경계를 불러오는 중",
  zoomIn: "확대",
  zoomOut: "축소",
  back: "뒤로",
} as const;

type FillMode = (typeof FILL_MODE_OPTIONS)[number]["value"];
type SidoLabelMode = (typeof SIDO_LABEL_MODE_OPTIONS)[number]["value"];
type SggLabelMode = (typeof SGG_LABEL_MODE_OPTIONS)[number]["value"];

function createMetric(code: string, seed: number, base: number, spread: number) {
  let hash = seed;

  for (const character of code) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return base + (hash % spread);
}

function createSidoValues(metadata: KoreaRegionsDataset | null, seed: number) {
  if (!metadata) {
    return {};
  }

  return Object.fromEntries(
    metadata.sido.map((region) => [
      region.code,
      createMetric(region.code, seed, region.sggCount * 6, 80),
    ]),
  );
}

function createSggValues(metadata: KoreaRegionsDataset | null, seed: number) {
  if (!metadata) {
    return {};
  }

  return Object.fromEntries(
    metadata.sgg.map((region) => [
      region.code,
      createMetric(region.code, seed + 17, 40, 180),
    ]),
  );
}

function createSidoColorMap(
  metadata: KoreaRegionsDataset | null,
  seed: number,
  palette: readonly string[],
) {
  if (!metadata || palette.length === 0) {
    return {};
  }

  return Object.fromEntries(
    metadata.sido.map((region, index) => [
      region.code,
      palette[(index + seed) % palette.length] ?? palette[0],
    ]),
  );
}

function createSggColorMap(
  metadata: KoreaRegionsDataset | null,
  seed: number,
  palette: readonly string[],
) {
  if (!metadata || palette.length === 0) {
    return {};
  }

  return Object.fromEntries(
    metadata.sgg.map((region, index) => [
      region.code,
      palette[(index * 2 + seed) % palette.length] ?? palette[0],
    ]),
  );
}

function App() {
  const [metadata, setMetadata] = useState<KoreaRegionsDataset | null>(null);
  const [selection, setSelection] = useState<KoreaMapSelection>({
    sidoCode: null,
    sggCode: null,
  });
  const [hoveredRegion, setHoveredRegion] = useState<KoreaMapHoveredRegion | null>(null);
  const [seed, setSeed] = useState(7);
  const [error, setError] = useState<string | null>(null);

  const [fontFamily, setFontFamily] = useState<string>(FONT_OPTIONS[0].value);
  const [fontWeight, setFontWeight] = useState<string>(FONT_WEIGHT_OPTIONS[2].value);
  const [sidoLabelMode, setSidoLabelMode] = useState<SidoLabelMode>("compact");
  const [sggLabelMode, setSggLabelMode] = useState<SggLabelMode>("name");
  const [showControls, setShowControls] = useState(true);
  const [showSidoLabels, setShowSidoLabels] = useState(true);
  const [showSggLabels, setShowSggLabels] = useState(true);
  const [showSidoSecondary, setShowSidoSecondary] = useState(true);
  const [labelHalo, setLabelHalo] = useState(true);
  const [labelHaloWidth, setLabelHaloWidth] = useState(5.4);
  const [sidoLabelSize, setSidoLabelSize] = useState(23);
  const [sggLabelSize, setSggLabelSize] = useState(14.5);
  const [sggLabelMinZoom, setSggLabelMinZoom] = useState(2.4);

  const [sidoBaseStroke, setSidoBaseStroke] = useState(1.4);
  const [sidoSelectedStroke, setSidoSelectedStroke] = useState(2.3);
  const [sggBaseStroke, setSggBaseStroke] = useState(1.0);
  const [sggSelectedStroke, setSggSelectedStroke] = useState(1.8);

  const [minZoom, setMinZoom] = useState(1);
  const [maxZoom, setMaxZoom] = useState(14);
  const [zoomStep, setZoomStep] = useState(0.8);
  const [maxDepth, setMaxDepth] = useState<KoreaMapSelectableDepth>("sgg");
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [animationDurationMs, setAnimationDurationMs] = useState(760);

  const [tooltipEnabled, setTooltipEnabled] = useState(true);
  const [followCursor, setFollowCursor] = useState(true);
  const [tooltipAnchor, setTooltipAnchor] = useState<KoreaMapOverlayPosition>("top-left");

  const [fillMode, setFillMode] = useState<FillMode>("hybrid");
  const [choroplethLevel, setChoroplethLevel] = useState<KoreaMapChoroplethLevel>("current");
  const [paletteKey, setPaletteKey] = useState<keyof typeof PALETTE_PRESETS>("ocean");
  const [showLegend, setShowLegend] = useState(true);
  const [legendPosition, setLegendPosition] = useState<KoreaMapOverlayPosition>("top-right");
  const [preserveSelectionFill, setPreserveSelectionFill] = useState(true);

  const loaders = useMemo(() => createBundledBoundaryLoaders(), []);

  useEffect(() => {
    let cancelled = false;

    loadBundledRegionsMetadata()
      .then((nextMetadata) => {
        if (!cancelled) {
          setMetadata(nextMetadata);
        }
      })
      .catch((caughtError) => {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "메타데이터를 불러오지 못했습니다.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const palette = PALETTE_PRESETS[paletteKey];
  const fontWeightNumber = Number(fontWeight);
  const featuredSidos = useMemo(() => {
    if (!metadata) {
      return [];
    }

    return FEATURED_SIDO_CODES.map((code) =>
      metadata.sido.find((region) => region.code === code),
    ).filter((region): region is KoreaRegionsDataset["sido"][number] => Boolean(region));
  }, [metadata]);

  const selectedSido = useMemo(() => {
    if (!metadata || !selection.sidoCode) {
      return null;
    }

    return metadata.sido.find((region) => region.code === selection.sidoCode) ?? null;
  }, [metadata, selection.sidoCode]);

  const selectedSggList = useMemo(() => {
    if (!metadata || !selection.sidoCode) {
      return [];
    }

    return metadata.sggBySido[selection.sidoCode] ?? [];
  }, [metadata, selection.sidoCode]);

  const selectedSgg = useMemo(() => {
    if (!selection.sggCode) {
      return null;
    }

    return selectedSggList.find((region) => region.code === selection.sggCode) ?? null;
  }, [selection.sggCode, selectedSggList]);

  const boundedMinZoom = Math.min(minZoom, maxZoom - 0.5);
  const boundedMaxZoom = Math.max(maxZoom, minZoom + 0.5);
  const sidoValues = useMemo(() => createSidoValues(metadata, seed), [metadata, seed]);
  const sggValues = useMemo(() => createSggValues(metadata, seed), [metadata, seed]);
  const sidoColorMap = useMemo(
    () => createSidoColorMap(metadata, seed, palette),
    [metadata, palette, seed],
  );
  const sggColorMap = useMemo(
    () => createSggColorMap(metadata, seed, palette),
    [metadata, palette, seed],
  );
  const useChoropleth = fillMode === "choropleth" || fillMode === "hybrid";
  const useRegionFills = fillMode === "fills" || fillMode === "hybrid";
  const currentPathLabel = selectedSgg
    ? `${selectedSgg.sidoName} ${selectedSgg.name}`
    : selectedSido?.name ?? "대한민국 전체";

  return (
    <div className="mx-auto flex min-h-screen max-w-[1520px] flex-col gap-6 px-4 py-6 md:px-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase text-muted-foreground">
            데모 페이지
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">korea-drilldown-svg-map</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            시도에서 시군구까지 드릴다운 가능한 대한민국 행정구역 벡터 지도 컴포넌트입니다. 
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>React 19</Badge>
          <Badge variant="secondary">shadcn/ui style</Badge>
          <Badge variant="outline">npm package</Badge>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="map-demo-panel h-fit xl:sticky xl:top-6">
          <CardHeader className="border-b">
            <CardTitle>컨트롤</CardTitle>
            <CardDescription>왼쪽 패널에서 패키지 옵션을 직접 바꿉니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <Tabs defaultValue="style" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="style">스타일</TabsTrigger>
                <TabsTrigger value="behavior">동작</TabsTrigger>
                <TabsTrigger value="data">데이터</TabsTrigger>
              </TabsList>

              <TabsContent value="style" className="space-y-4">
                <SelectField
                  label="라벨 폰트"
                  description="기본 SVG 라벨 폰트입니다."
                  value={fontFamily}
                  onValueChange={setFontFamily}
                  options={FONT_OPTIONS}
                />
                <SelectField
                  label="폰트 굵기"
                  description="시도/시군구 라벨 가중치를 같이 바꿉니다."
                  value={fontWeight}
                  onValueChange={setFontWeight}
                  options={FONT_WEIGHT_OPTIONS}
                />
                <SelectField
                  label="시도 라벨 포맷"
                  description="기본 라벨 텍스트를 축약형, 원문, 코드 포함으로 전환합니다."
                  value={sidoLabelMode}
                  onValueChange={(value) => setSidoLabelMode(value as SidoLabelMode)}
                  options={SIDO_LABEL_MODE_OPTIONS}
                />
                <SelectField
                  label="시군구 라벨 포맷"
                  description="이름, 코드, 값 포함 모드를 전환합니다."
                  value={sggLabelMode}
                  onValueChange={(value) => setSggLabelMode(value as SggLabelMode)}
                  options={SGG_LABEL_MODE_OPTIONS}
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <SwitchField
                    label="시도 라벨"
                    description="최상위 라벨 표시"
                    checked={showSidoLabels}
                    onCheckedChange={setShowSidoLabels}
                  />
                  <SwitchField
                    label="시군구 라벨"
                    description="드릴다운 라벨 표시"
                    checked={showSggLabels}
                    onCheckedChange={setShowSggLabels}
                  />
                  <SwitchField
                    label="시도 보조 라벨"
                    description="시군구 개수 표시"
                    checked={showSidoSecondary}
                    onCheckedChange={setShowSidoSecondary}
                  />
                  <SwitchField
                    label="라벨 halo"
                    description="외곽선 사용"
                    checked={labelHalo}
                    onCheckedChange={setLabelHalo}
                  />
                </div>

                <SliderField
                  label="시도 라벨 크기"
                  value={sidoLabelSize}
                  min={14}
                  max={34}
                  step={0.5}
                  onValueChange={setSidoLabelSize}
                />
                <SliderField
                  label="시군구 라벨 크기"
                  value={sggLabelSize}
                  min={9}
                  max={22}
                  step={0.5}
                  onValueChange={setSggLabelSize}
                />
                <SliderField
                  label="라벨 halo 두께"
                  value={labelHaloWidth}
                  min={0}
                  max={8}
                  step={0.2}
                  onValueChange={setLabelHaloWidth}
                />
                <SliderField
                  label="시군구 라벨 최소 줌"
                  value={sggLabelMinZoom}
                  min={0}
                  max={8}
                  step={0.2}
                  onValueChange={setSggLabelMinZoom}
                />

                <Separator />

                <SliderField
                  label="시도 기본 선"
                  value={sidoBaseStroke}
                  min={0.4}
                  max={4}
                  step={0.1}
                  onValueChange={setSidoBaseStroke}
                />
                <SliderField
                  label="시도 선택 선"
                  value={sidoSelectedStroke}
                  min={0.8}
                  max={6}
                  step={0.1}
                  onValueChange={setSidoSelectedStroke}
                />
                <SliderField
                  label="시군구 기본 선"
                  value={sggBaseStroke}
                  min={0.3}
                  max={3}
                  step={0.1}
                  onValueChange={setSggBaseStroke}
                />
                <SliderField
                  label="시군구 선택 선"
                  value={sggSelectedStroke}
                  min={0.6}
                  max={5}
                  step={0.1}
                  onValueChange={setSggSelectedStroke}
                />
              </TabsContent>

              <TabsContent value="behavior" className="space-y-4">
                <SelectField
                  label="최대 depth"
                  description="시도까지만 허용할지, 시군구까지 들어갈지 선택합니다."
                  value={maxDepth}
                  onValueChange={(value) => setMaxDepth(value as KoreaMapSelectableDepth)}
                  options={[
                    { label: "시도까지", value: "sido" },
                    { label: "시군구까지", value: "sgg" },
                  ]}
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <SwitchField
                    label="기본 컨트롤"
                    description="확대/축소/뒤로 버튼"
                    checked={showControls}
                    onCheckedChange={setShowControls}
                  />
                  <SwitchField
                    label="애니메이션"
                    description="선택 시 줌 애니메이션"
                    checked={animationsEnabled}
                    onCheckedChange={setAnimationsEnabled}
                  />
                  <SwitchField
                    label="툴팁"
                    description="hover 정보 표시"
                    checked={tooltipEnabled}
                    onCheckedChange={setTooltipEnabled}
                  />
                  <SwitchField
                    label="마우스 추적"
                    description="고정 위치 대신 커서 추적"
                    checked={followCursor}
                    onCheckedChange={setFollowCursor}
                  />
                </div>

                <SelectField
                  label="고정 툴팁 위치"
                  description="마우스 추적을 끄면 사용할 코너입니다."
                  value={tooltipAnchor}
                  onValueChange={(value) => setTooltipAnchor(value as KoreaMapOverlayPosition)}
                  options={CORNER_OPTIONS}
                />

                <SliderField
                  label="최소 줌"
                  value={boundedMinZoom}
                  min={1}
                  max={10}
                  step={0.2}
                  onValueChange={(value) => setMinZoom(Math.min(value, boundedMaxZoom - 0.5))}
                />
                <SliderField
                  label="최대 줌"
                  value={boundedMaxZoom}
                  min={2}
                  max={20}
                  step={0.2}
                  onValueChange={(value) => setMaxZoom(Math.max(value, boundedMinZoom + 0.5))}
                />
                <SliderField
                  label="줌 스텝"
                  value={zoomStep}
                  min={0.2}
                  max={2}
                  step={0.1}
                  onValueChange={setZoomStep}
                />
                <SliderField
                  label="애니메이션 시간"
                  value={animationDurationMs}
                  min={200}
                  max={1400}
                  step={20}
                  onValueChange={setAnimationDurationMs}
                  valueFormatter={(value) => `${Math.round(value)}ms`}
                />
              </TabsContent>

              <TabsContent value="data" className="space-y-4">
                <SelectField
                  label="색상 모드"
                  description="기본 테마, choropleth, 정적 지역 색상, 혼합 중 선택합니다."
                  value={fillMode}
                  onValueChange={(value) => setFillMode(value as FillMode)}
                  options={FILL_MODE_OPTIONS}
                />
                <SelectField
                  label="Choropleth depth"
                  description="현재 depth를 따르거나 시도/시군구를 고정할 수 있습니다."
                  value={choroplethLevel}
                  onValueChange={(value) => setChoroplethLevel(value as KoreaMapChoroplethLevel)}
                  options={[
                    { label: "현재 depth", value: "current" },
                    { label: "시도", value: "sido" },
                    { label: "시군구", value: "sgg" },
                  ]}
                />
                <SelectField
                  label="팔레트"
                  description="choropleth와 지역 색상 맵 모두 같은 팔레트를 씁니다."
                  value={paletteKey}
                  onValueChange={(value) => setPaletteKey(value as keyof typeof PALETTE_PRESETS)}
                  options={[
                    { label: "Ocean", value: "ocean" },
                    { label: "Ember", value: "ember" },
                    { label: "Moss", value: "moss" },
                  ]}
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <SwitchField
                    label="Legend"
                    description="내장 legend 표시"
                    checked={showLegend}
                    onCheckedChange={setShowLegend}
                  />
                  <SwitchField
                    label="선택 색 보존"
                    description="선택해도 데이터 색 유지"
                    checked={preserveSelectionFill}
                    onCheckedChange={setPreserveSelectionFill}
                  />
                </div>

                <SelectField
                  label="Legend 위치"
                  description="choropleth legend 오버레이 위치입니다."
                  value={legendPosition}
                  onValueChange={(value) => setLegendPosition(value as KoreaMapOverlayPosition)}
                  options={CORNER_OPTIONS}
                />

                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => setSeed((value) => value + 1)}
                >
                  샘플 데이터 다시 생성
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="grid min-w-0 gap-5">
          <Card className="map-demo-panel min-w-0 overflow-hidden">
            <CardHeader className="min-w-0 border-b">
              <CardTitle>{currentPathLabel}</CardTitle>
              <CardDescription>
                선택 상태, hover 상태, legend, tooltip, overlay가 함께 동작합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4 pt-6">
              <div className="min-w-0 rounded-xl border bg-muted/40 p-4">
                <div className="min-w-0 space-y-3">
                  <RegionRail label="시도 빠른 선택">
                    {featuredSidos.map((region) => (
                      <Button
                        key={region.code}
                        type="button"
                        size="sm"
                        variant={selection.sidoCode === region.code ? "default" : "outline"}
                        onClick={() =>
                          setSelection({
                            sidoCode: region.code,
                            sggCode: null,
                          })
                        }
                      >
                        {getDefaultSidoLabel(region.name)}
                      </Button>
                    ))}
                  </RegionRail>

                  <RegionRail
                    label="시군구 빠른 선택"
                    placeholder={
                      maxDepth !== "sgg"
                        ? "depth를 시군구까지로 바꾸면 이 영역이 활성화됩니다."
                        : selectedSido
                          ? "좌우로 스크롤하면서 시군구를 빠르게 고를 수 있습니다."
                          : "시도를 먼저 고르면 시군구 버튼이 여기에 표시됩니다."
                    }
                  >
                    {selectedSido && maxDepth === "sgg"
                      ? selectedSggList.slice(0, 20).map((region) => (
                          <Button
                            key={region.code}
                            type="button"
                            size="sm"
                            variant={selection.sggCode === region.code ? "default" : "ghost"}
                            onClick={() =>
                              setSelection({
                                sidoCode: selectedSido.code,
                                sggCode: region.code,
                              })
                            }
                          >
                            {region.name}
                          </Button>
                        ))
                      : null}
                  </RegionRail>
                </div>
              </div>

              <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div className="min-h-[760px] min-w-0 overflow-hidden rounded-4xl border bg-background">
                  {metadata ? (
                    <KoreaAdministrativeMap
                      metadata={metadata}
                      loaders={loaders}
                      labels={DEMO_LABELS}
                      selection={selection}
                      onSelectionChange={setSelection}
                      onHoverRegionChange={setHoveredRegion}
                      theme={MAP_THEME}
                      showControls={showControls}
                      showSidoLabels={showSidoLabels}
                      showSggLabels={showSggLabels}
                      focusScreenOffset={{ y: 38 }}
                      zoomOptions={{
                        minZoom: boundedMinZoom,
                        maxZoom: boundedMaxZoom,
                        step: zoomStep,
                      }}
                      animations={{
                        enabled: animationsEnabled,
                        durationMs: animationDurationMs,
                      }}
                      drilldown={{
                        maxDepth,
                      }}
                      strokes={{
                        sido: {
                          base: sidoBaseStroke,
                          selected: sidoSelectedStroke,
                        },
                        sgg: {
                          base: sggBaseStroke,
                          selected: sggSelectedStroke,
                        },
                      }}
                      labelOptions={{
                        sido: {
                          fontFamily,
                          fontWeight: fontWeightNumber,
                          baseSize: sidoLabelSize,
                          halo: labelHalo,
                          haloWidth: labelHaloWidth,
                          formatter: (summary) => {
                            switch (sidoLabelMode) {
                              case "full":
                                return summary.name;
                              case "code":
                                return `${summary.code} ${getDefaultSidoLabel(summary.name)}`;
                              case "compact":
                              default:
                                return getDefaultSidoLabel(summary.name);
                            }
                          },
                          secondaryFormatter: showSidoSecondary
                            ? (summary) => `${summary.sggCount}개 시군구`
                            : undefined,
                        },
                        sgg: {
                          fontFamily,
                          fontWeight: fontWeightNumber,
                          baseSize: sggLabelSize,
                          halo: labelHalo,
                          haloWidth: Math.max(labelHaloWidth * 0.6, 0),
                          minZoom: sggLabelMinZoom,
                          formatter: (summary) => {
                            switch (sggLabelMode) {
                              case "code":
                                return summary.code;
                              case "value": {
                                const value = sggValues[summary.code];
                                return typeof value === "number"
                                  ? `${summary.name} ${Math.round(value)}`
                                  : summary.name;
                              }
                              case "name":
                              default:
                                return summary.name;
                            }
                          },
                        },
                      }}
                      regionFills={{
                        enabled: useRegionFills,
                        sido: sidoColorMap,
                        sgg: sggColorMap,
                        preserveSelectionFill,
                      }}
                      choropleth={{
                        enabled: useChoropleth,
                        level: choroplethLevel,
                        sidoValues,
                        sggValues,
                        palette: [...palette],
                        showLegend: useChoropleth && showLegend,
                        legendTitle: "샘플 지표",
                        legendPosition,
                        preserveSelectionFill,
                        formatValue: (value) =>
                          value.toLocaleString(undefined, { maximumFractionDigits: 0 }),
                      }}
                      tooltip={{
                        enabled: tooltipEnabled,
                        followCursor,
                        anchor: tooltipAnchor,
                        render: ({ level, summary, value }) => (
                          <div className="space-y-1">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                              {level}
                            </div>
                            <div className="font-medium">
                              {level === "sgg" && "sidoName" in summary
                                ? `${summary.sidoName} ${summary.name}`
                                : summary.name}
                            </div>
                            {value !== null ? (
                              <div className="text-xs text-slate-500">
                                샘플 값 {value.toLocaleString()}
                              </div>
                            ) : null}
                          </div>
                        ),
                      }}
                      renderOverlay={({
                        currentDepth,
                        selectedSido,
                        selectedSgg,
                        stepBack,
                        reset,
                        viewport,
                      }) => (
                        <div className="pointer-events-auto absolute left-4 top-4 rounded-xl border bg-background px-4 py-3 shadow-sm">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                            {currentDepth}
                          </div>
                          <div className="mt-1 text-base font-semibold">
                            {selectedSgg
                              ? `${selectedSgg.sidoName} ${selectedSgg.name}`
                              : selectedSido?.name ?? "대한민국 전체"}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            zoom {viewport.zoom.toFixed(2)}
                          </div>
                          <div className="mt-3 flex gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={stepBack}>
                              한 단계 뒤로
                            </Button>
                            <Button type="button" size="sm" onClick={reset}>
                              초기화
                            </Button>
                          </div>
                        </div>
                      )}
                    />
                  ) : (
                    <div className="flex h-full min-h-[760px] items-center justify-center text-sm text-muted-foreground">
                      지도를 준비하는 중입니다...
                    </div>
                  )}
                </div>

                <div className="min-w-0 space-y-4">
                  <Card size="sm">
                    <CardHeader className="border-b">
                      <CardTitle className="text-base">상태</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-4">
                      <StatusRow label="현재 경로" value={currentPathLabel} />
                      <StatusRow label="색상 모드" value={fillMode} />
                      <StatusRow label="시도 코드" value={selection.sidoCode ?? "-"} />
                      <StatusRow label="시군구 코드" value={selection.sggCode ?? "-"} />
                      <StatusRow label="hover 코드" value={hoveredRegion?.code ?? "-"} />
                      <StatusRow label="legend 위치" value={legendPosition} />
                      <StatusRow
                        label="tooltip 위치"
                        value={followCursor ? "cursor" : tooltipAnchor}
                      />
                      {error ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                          {error}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>

                  <Card size="sm">
                    <CardHeader className="border-b">
                      <CardTitle className="text-base">hover 미리보기</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-4">
                      {hoveredRegion ? (
                        <>
                          <div className="text-sm font-medium">
                            {hoveredRegion.level === "sgg" && "sidoName" in hoveredRegion.summary
                              ? `${hoveredRegion.summary.sidoName} ${hoveredRegion.summary.name}`
                              : hoveredRegion.summary.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            value {hoveredRegion.value?.toLocaleString() ?? "-"}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          지역 위에 마우스를 올리면 상태가 여기에 표시됩니다.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card size="sm">
                    <CardHeader className="border-b">
                      <CardTitle className="text-base">실험 포인트</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-4 text-sm text-muted-foreground">
                      <p>라벨 포맷을 바꾸면 SVG 텍스트가 즉시 교체됩니다.</p>
                      <p>
                        색상 모드를 `혼합`으로 두면 정적 지역 색상과 choropleth를 같이
                        시험할 수 있습니다.
                      </p>
                      <p>마우스 추적을 끄면 tooltip anchor prop이 적용됩니다.</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onValueChange,
  valueFormatter,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onValueChange: (value: number) => void;
  valueFormatter?: (value: number) => string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <Label>{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {valueFormatter ? valueFormatter(value) : value.toFixed(1)}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(nextValue) => onValueChange(nextValue[0] ?? value)}
      />
    </div>
  );
}

function SwitchField({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/40 p-4">
      <div className="space-y-1">
        <Label>{label}</Label>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SelectField({
  label,
  description,
  value,
  onValueChange,
  options,
}: {
  label: string;
  description: string;
  value: string;
  onValueChange: (value: string) => void;
  options: ReadonlyArray<{ label: string; value: string }>;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>{label}</Label>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function RegionRail({
  label,
  children,
  placeholder = "아직 표시할 항목이 없습니다.",
}: {
  label: string;
  children?: ReactNode;
  placeholder?: string;
}) {
  const hasChildren = Children.count(children) > 0;

  return (
    <div className="min-w-0 space-y-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="max-w-full overflow-hidden">
        <div className="scrollbar-hidden h-11 max-w-full overflow-x-auto overflow-y-hidden pb-1">
          {hasChildren ? (
            <div className="flex w-max min-w-max gap-2 pr-2">{children}</div>
          ) : (
            <div className="flex h-full items-center rounded-lg border border-dashed bg-background px-3 text-xs text-muted-foreground">
              {placeholder}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[160px] truncate text-right font-medium">{value}</span>
    </div>
  );
}

export default App;
