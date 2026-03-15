import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "korea-drilldown-svg-map Next Demo",
  description: "korea-drilldown-svg-map 패키지를 Next.js에서 검증하는 예제 앱",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
