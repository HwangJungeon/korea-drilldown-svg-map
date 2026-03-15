# Vite Demo

`korea-drilldown-svg-map` 저장소 안에서 패키지를 Vite로 검증하기 위한 예제 앱입니다.

## 실행

```bash
cd examples/vite-demo
pnpm install
pnpm dev
```

`pnpm dev`를 실행하면 다음이 자동으로 수행됩니다.

- 상위 `korea-drilldown-svg-map` 패키지 빌드
- Vite 개발 서버 실행

## 확인할 수 있는 것

- 제어형 `selection` 상태
- `renderOverlay` 오버레이 슬롯
- `theme` 색상 오버라이드
- `renderSidoLabel`, `renderSggLabel` 라벨 커스터마이징
- 외부 패널과 지도 선택 상태 동기화
