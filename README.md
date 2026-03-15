# korea-drilldown-svg-map

대한민국 행정구역 경계를 기반으로 `시/도 -> 시/군/구` 드릴다운 지도를 만들기 위한 React 패키지입니다.

기본 제공 범위는 다음과 같습니다.

- `시/도`, `시/군/구` TopoJSON 자산
- 메타데이터 로더와 경계 fetch 유틸
- 선택 상태와 드릴다운
- 확대/축소와 포커스 이동
- 라벨 폰트, 크기, halo, 포맷 커스터마이징
- 선 굵기와 hover/selected 스타일 제어
- choropleth 기반 데이터 시각화
- 정적 지역별 색상 맵
- tooltip, legend, overlay, 커스텀 SVG 라벨 렌더

## 지도 데이터 기준

- 원본 버전: `ver20260201/HangJeongDong_ver20260201.geojson`
- 지도 정보 업데이트 기준일: `2026-02-01`
- 참조 데이터 저장소: [vuski/admdongkor](https://github.com/vuski/admdongkor)

## 설치

```bash
pnpm add korea-drilldown-svg-map
```

## 의존성

peer dependency:

- `react 18` 또는 `react 19`
- `react-dom 18` 또는 `react-dom 19`

runtime dependency:

- `d3-geo`
- `react-simple-maps`
- `topojson-client`

위 runtime dependency는 패키지 설치 시 자동으로 함께 설치됩니다.

## 저장소 예제 앱

Vite 예제는 npm tarball에는 포함되지 않고, 저장소의 `examples/vite-demo` 디렉터리에서만 제공합니다.

## 빠른 시작

### 1. 내장 경계 자산으로 바로 사용

기본 권장 방식입니다. 패키지 안에 포함된 경계 자산을 자동으로 읽기 때문에 `public` 디렉터리에 파일을 따로 복사할 필요가 없습니다.

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  KoreaAdministrativeMap,
  createBundledBoundaryLoaders,
  loadBundledRegionsMetadata,
  type KoreaMapSelection,
  type KoreaRegionsDataset,
} from "korea-drilldown-svg-map";

export function KoreaMapExample() {
  const [metadata, setMetadata] = useState<KoreaRegionsDataset | null>(null);
  const [selection, setSelection] = useState<KoreaMapSelection>({
    sidoCode: null,
    sggCode: null,
  });

  const loaders = useMemo(() => createBundledBoundaryLoaders(), []);

  useEffect(() => {
    loadBundledRegionsMetadata().then(setMetadata);
  }, []);

  if (!metadata) {
    return <p>지도를 준비하는 중입니다...</p>;
  }

  return (
    <KoreaAdministrativeMap
      metadata={metadata}
      loaders={loaders}
      selection={selection}
      onSelectionChange={setSelection}
    />
  );
}
```

### 2. 직접 `public` 경로로 호스팅하고 싶다면

자산 URL을 직접 관리하거나 CDN 경로를 쓰고 싶으면 기존 방식도 사용할 수 있습니다.

```bash
node ./node_modules/korea-drilldown-svg-map/scripts/copy-boundaries.mjs ./public/boundaries
```

```tsx
import {
  createAssetBoundaryLoaders,
  loadRegionsMetadata,
} from "korea-drilldown-svg-map";

const loaders = createAssetBoundaryLoaders("/boundaries");
const metadata = await loadRegionsMetadata("/boundaries");
```

## 핵심 기능

### 1. 선 굵기와 경계선 제어

`strokes`로 시도/시군구별 기본선, 선택선, hover 선을 조절할 수 있습니다.

```tsx
<KoreaAdministrativeMap
  strokes={{
    borderColor: "#ffffff",
    sido: {
      base: 1.4,
      selected: 2.4,
      hover: 2.2,
      scaleWithZoom: true,
      zoomAttenuation: 0.68,
    },
    sgg: {
      base: 0.9,
      selected: 1.8,
      hover: 1.6,
    },
  }}
/>
```

### 2. 라벨 폰트, 크기, halo, 텍스트 포맷

`labelOptions`로 라벨 스타일과 텍스트를 제어합니다.

```tsx
<KoreaAdministrativeMap
  labelOptions={{
    sido: {
      fontFamily: "'IBM Plex Sans KR', sans-serif",
      fontWeight: 700,
      baseSize: 24,
      halo: true,
      haloWidth: 5.6,
      formatter: (summary) => summary.name,
      secondaryFormatter: (summary) => `${summary.sggCount}개 시군구`,
    },
    sgg: {
      fontFamily: "'IBM Plex Sans KR', sans-serif",
      baseSize: 13.5,
      minZoom: 2.5,
      halo: false,
      formatter: (summary) => summary.name,
    },
  }}
/>
```

주요 옵션:

- `fontFamily`, `fontWeight`
- `baseSize`, `sizeAttenuation`
- `fill`, `selectedFill`
- `halo`, `haloColor`, `haloWidth`
- `minZoom`
- `formatter`
- `secondaryFormatter`, `secondaryBaseSize`, `secondaryOffsetY`
- `offsets`로 특정 시도 라벨 위치 미세 조정

### 3. 줌 제한과 드릴다운 깊이 제한

```tsx
<KoreaAdministrativeMap
  zoomOptions={{
    minZoom: 1,
    maxZoom: 13,
    step: 0.8,
  }}
  drilldown={{
    maxDepth: "sido",
  }}
/>
```

`maxDepth: "sido"`면 시군구까지 내려가지 않고 시도 선택까지만 허용합니다.

### 4. 지역별 색상화

숫자 데이터를 지도 차트처럼 시각화하려면 `choropleth`를 사용합니다.

```tsx
<KoreaAdministrativeMap
  choropleth={{
    enabled: true,
    level: "current",
    sidoValues: {
      "11": 180,
      "26": 110,
      "41": 260,
    },
    sggValues: {
      "41111": 48,
      "41113": 67,
    },
    palette: ["#e0f2fe", "#7dd3fc", "#0284c7", "#0f4c81"],
    showLegend: true,
    legendTitle: "지표",
    legendPosition: "top-right",
    preserveSelectionFill: true,
    formatValue: (value) => `${value.toLocaleString()}점`,
  }}
/>
```

지원 항목:

- `level: "sido" | "sgg" | "current"`
- `domain`으로 범위 고정
- `palette`
- `nullFill`
- `showLegend`
- `legendTitle`
- `legendDecimals`
- `legendPosition`
- `preserveSelectionFill`
- `formatValue`

### 5. 정적 지역 색상 맵

숫자 차트가 아니라 지역별로 임의 색을 직접 입히려면 `regionFills`를 사용합니다.

```tsx
<KoreaAdministrativeMap
  regionFills={{
    enabled: true,
    preserveSelectionFill: true,
    sido: {
      "11": "#dbeafe",
      "26": "#fee2e2",
      "41": "#dcfce7",
    },
    sgg: {
      "41111": "#0ea5e9",
      "41113": "#f97316",
    },
  }}
/>
```

`regionFills`와 `choropleth`를 동시에 줄 수도 있습니다. 이 경우 명시한 색상 맵이 먼저 적용되고, 나머지 영역은 choropleth가 채웁니다.

### 6. Tooltip, legend, overlay

```tsx
<KoreaAdministrativeMap
  tooltip={{
    enabled: true,
    followCursor: false,
    anchor: "bottom-left",
    render: ({ level, summary, value }) => (
      <div>
        <strong>{summary.name}</strong>
        <div>{level}</div>
        <div>{value ?? "-"}</div>
      </div>
    ),
  }}
  renderOverlay={({ currentDepth, reset, stepBack }) => (
    <div>
      <div>{currentDepth}</div>
      <button onClick={stepBack}>뒤로</button>
      <button onClick={reset}>초기화</button>
    </div>
  )}
/>
```

`renderOverlay`가 받는 API:

- `selection`, `viewport`, `currentDepth`
- `selectedSido`, `selectedSgg`, `selectedSggList`
- `hoveredRegion`, `legendItems`
- `reset`, `stepBack`
- `zoomIn`, `zoomOut`
- `selectSido`, `selectSgg`, `setSelection`

### 7. 완전 커스텀 렌더와 스타일 훅

기본 라벨이나 지역 fill 규칙만으로 부족하면 직접 렌더링할 수 있습니다.

```tsx
<KoreaAdministrativeMap
  getSidoStyle={({ value, isSelected }) => ({
    default: {
      fill: isSelected ? "#2563eb" : value ? "#dbeafe" : "#e5e7eb",
    },
  })}
  renderSggLabel={({ summary, value }) => (
    <text textAnchor="middle" fontSize={11} fontWeight={700}>
      {summary.name} {value ?? ""}
    </text>
  )}
/>
```

사용 가능한 확장 포인트:

- `getSidoStyle`
- `getSggStyle`
- `renderSidoLabel`
- `renderSggLabel`
- `renderOverlay`
- `theme`
- `labels`

### 8. 애니메이션과 컨트롤

```tsx
<KoreaAdministrativeMap
  showControls={false}
  animations={{
    enabled: true,
    durationMs: 820,
  }}
/>
```

## 주요 props 요약

| prop | 설명 |
| --- | --- |
| `metadata` | `regions.json`에서 읽은 지역 메타데이터 |
| `loaders` | 경계 로더. 보통 `createBundledBoundaryLoaders()` 사용 |
| `selection`, `defaultSelection` | 제어형/비제어형 선택 상태 |
| `theme` | 지도 색상 및 overlay 테마 |
| `labels` | `loading`, `zoomIn`, `zoomOut`, `back` 텍스트 |
| `strokes` | 선 굵기와 경계선 색 |
| `labelOptions` | 라벨 폰트, 크기, halo, 포맷 |
| `zoomOptions` | 최소/최대 줌과 버튼 step |
| `drilldown` | 선택 depth 제한 |
| `choropleth` | 숫자 기반 지도 차트 |
| `regionFills` | 정적 지역별 색상 맵 |
| `tooltip` | hover tooltip 렌더와 위치 |
| `showControls` | 내장 확대/축소/뒤로 UI 표시 여부 |
| `animations` | 포커스 이동 애니메이션 설정 |
| `onSelectionChange` | 선택 변경 콜백 |
| `onHoverRegionChange` | hover 변경 콜백 |
| `renderOverlay` | 지도 위 임의 UI 렌더 |

## 자산 헬퍼

- `createBundledBoundaryLoaders()`
- `loadBundledRegionsMetadata()`
- `createAssetBoundaryLoaders(basePath = "/boundaries")`
- `loadRegionsMetadata(basePath = "/boundaries")`
- `fetchBoundaryCollection(url)`
- `buildChoroplethLegendItems(...)`
- `resolveChoroplethDomain(...)`
- `getChoroplethColor(...)`

## 예제 앱 실행

저장소를 clone한 뒤 예제를 실행하면 패키지와 데모를 함께 검증할 수 있습니다.

```bash
cd examples/vite-demo
pnpm install
pnpm dev
```

데모에서 바로 시험할 수 있는 항목:

- 시도/시군구 선 굵기
- 라벨 폰트, 폰트 굵기, 크기
- 라벨 halo on/off와 halo 두께
- 라벨 포맷터
- 시군구 라벨 최소 줌
- 줌 최소/최대값과 step
- 드릴다운 최대 depth
- 애니메이션 on/off와 duration
- choropleth, 정적 지역 색상, 혼합 모드
- legend 위치
- tooltip follow cursor, 고정 anchor

## npm 배포

### 1. 배포 전 점검

```bash
pnpm install
pnpm typecheck
pnpm build
npm pack --dry-run
```

확인할 것:

- `package.json`의 `name`, `version`, `license`
- `repository`, `homepage`, `bugs` 메타데이터
- `files` 필드에 예제 앱이 포함되지 않았는지
- 원본 행정경계 데이터의 재배포 가능 여부

### 2. npm 로그인

```bash
npm login
npm whoami
```

### 3. 버전 올리기

```bash
npm version patch
```

필요에 따라 `minor`, `major`를 사용하면 됩니다.

### 4. 배포

```bash
npm publish
```

스코프 패키지로 바꾸면 다음처럼 공개 배포합니다.

```bash
npm publish --access public
```

## 경계 데이터 재생성

전처리 문서는 `docs/boundary-preprocessing.md`에 있습니다.
