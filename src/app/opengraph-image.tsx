import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { LOGO_ACCENT_PATHS, LOGO_INK_PATHS, LOGO_RING_PATH } from "@/components/ui/Logo";

export const alt = "VentCore — вентиляция и кондиционирование под ключ";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const asDataUri = async (file: string) => {
  const buffer = await readFile(join(process.cwd(), "public/images/hero", file));
  return `data:image/png;base64,${buffer.toString("base64")}`;
};

// Та же композиция, что в hero: фон → логотип → здание поверх букв.
export default async function OpengraphImage() {
  const [background, building] = await Promise.all([
    asDataUri("main-desktop-background.png"),
    asDataUri("main-desktop-buildings-transparent.png"),
  ]);
  const imageStyle = { position: "absolute", top: 0, left: 0 } as const;

  return new ImageResponse(
    (
      <div style={{ position: "relative", display: "flex", width: "100%", height: "100%" }}>
        <img src={background} width={1200} height={715} alt="" style={imageStyle} />
        <svg
          viewBox="0 0 1340 127"
          width={1100}
          height={104}
          style={{ position: "absolute", top: 110, left: 50 }}
        >
          {LOGO_INK_PATHS.map((d) => (
            <path key={d} d={d} fill="#062647" />
          ))}
          {LOGO_ACCENT_PATHS.map((d) => (
            <path key={d} d={d} fill="#0377C9" />
          ))}
          <path d={LOGO_RING_PATH} fill="#0377C9" fillRule="evenodd" />
        </svg>
        <img src={building} width={1200} height={715} alt="" style={imageStyle} />
      </div>
    ),
    size,
  );
}
