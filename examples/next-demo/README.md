# Next Demo

`korea-drilldown-svg-map` 저장소 안에서 패키지를 Next.js로 검증하기 위한 예제 앱입니다.

## 실행

```bash
cd examples/next-demo
pnpm install
pnpm dev
```

`pnpm dev`를 실행하면 webpack 기반 Next 개발 서버가 시작됩니다.

## 확인할 수 있는 것

- npm registry에서 설치한 `korea-drilldown-svg-map` 패키지 사용
- `createBundledBoundaryLoaders`, `loadBundledRegionsMetadata` 기반 자동 자산 로드
- Vite 데모와 동일한 shadcn UI 패널 및 지도 제어
- 시도/시군구 드릴다운, 색상 모드, legend, tooltip, 애니메이션 검증
