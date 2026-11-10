import type { Metadata, Viewport } from "next";

import { LiquidGlassEnhancer } from "@/components/ui/LiquidGlassEnhancer";
import { site } from "@/content/site";

import { display, inter } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: site.title,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  // favicon.ico (нужен Яндексу и старым браузерам) Next подключает сам из src/app/favicon.ico; здесь — SVG для современных браузеров.
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }] },
  // Коды подтверждения владения сайтом в Google Search Console и Яндекс Вебмастере (задаются в настройках сервера, значение вшивается при сборке).
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION?.trim() ? { google: process.env.GOOGLE_SITE_VERIFICATION.trim() } : {}),
    ...(process.env.YANDEX_VERIFICATION?.trim() ? { yandex: process.env.YANDEX_VERIFICATION.trim() } : {}),
  },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "/",
    siteName: site.name,
    title: site.title,
    description: site.description,
  },
  twitter: { card: "summary_large_image", title: site.title, description: site.description },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#062647",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-scroll-behavior: Next 16 отключает плавную прокрутку на время перехода
    // между страницами (новая страница открывается сверху), якоря остаются плавными
    <html lang="ru" data-scroll-behavior="smooth" className={`${inter.variable} ${display.variable}`}>
      <body>
        {children}
        <LiquidGlassEnhancer />
      </body>
    </html>
  );
}
