const SVG_NS = "http://www.w3.org/2000/svg";

export type GlassGeometry = {
  width: number;
  height: number;
  radius: number;
  depth: number;
  strength: number;
  blur: number;
  saturation: number;
};

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number>,
) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

/** Only numerical X/Y offsets: this map contains no photograph or PDF pixels. */
function lensMap({ width, height, radius, depth, strength }: GlassGeometry) {
  const ratio = Math.min(1, 768 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  const context = canvas.getContext("2d");
  if (!context) return null;

  const image = context.createImageData(canvas.width, canvas.height);
  const r = Math.min(radius, width / 2, height / 2);
  const bezel = Math.max(1, Math.min(depth, width / 2 - 1, height / 2 - 1));

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const px = ((x + 0.5) / canvas.width - 0.5) * width;
      const py = ((y + 0.5) / canvas.height - 0.5) * height;
      const qx = Math.abs(px) - (width / 2 - r);
      const qy = Math.abs(py) - (height / 2 - r);
      const corner = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
      const distance = corner + Math.min(Math.max(qx, qy), 0) - r;
      const fromEdge = -distance;
      let dx = 0;
      let dy = 0;

      if (fromEdge >= 0 && fromEdge < bezel) {
        // A smooth convex bezel; the centre remains flat and undistorted.
        const amount = Math.sin((fromEdge / bezel) * Math.PI) ** 0.8;
        const nx = corner > 0 ? Math.max(qx, 0) / corner : qx > qy ? 1 : 0;
        const ny = corner > 0 ? Math.max(qy, 0) / corner : qy >= qx ? 1 : 0;
        dx = -Math.sign(px) * nx * amount;
        dy = -Math.sign(py) * ny * amount;
      }

      const offset = (y * canvas.width + x) * 4;
      image.data[offset] = Math.round(127.5 + dx * 127.5);
      image.data[offset + 1] = Math.round(127.5 + dy * 127.5);
      image.data[offset + 2] = 128;
      image.data[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  return { url: canvas.toDataURL(), scale: strength * 2 };
}

export function createGlassFilter(id: string, geometry: GlassGeometry) {
  const map = lensMap(geometry);
  if (!map) return null;

  const { width, height, blur, saturation } = geometry;
  const filter = svg("filter", {
    id,
    filterUnits: "userSpaceOnUse",
    primitiveUnits: "userSpaceOnUse",
    x: 0,
    y: 0,
    width,
    height,
    "color-interpolation-filters": "sRGB",
  });
  filter.append(
    svg("feGaussianBlur", {
      in: "SourceGraphic",
      stdDeviation: blur,
      edgeMode: "duplicate",
      result: "soft-backdrop",
    }),
    svg("feImage", {
      href: map.url,
      width,
      height,
      preserveAspectRatio: "none",
      result: "lens-map",
    }),
    svg("feDisplacementMap", {
      in: "soft-backdrop",
      in2: "lens-map",
      scale: map.scale,
      xChannelSelector: "R",
      yChannelSelector: "G",
      result: "refracted-backdrop",
    }),
    svg("feColorMatrix", {
      in: "refracted-backdrop",
      type: "saturate",
      values: saturation,
    }),
  );
  return filter;
}

export function createGlassFilterHost() {
  const host = svg("svg", { width: 0, height: 0, "aria-hidden": "true", focusable: "false" });
  host.style.cssText = "position:absolute;width:0;height:0;pointer-events:none;overflow:hidden";
  const defs = svg("defs", {});
  host.append(defs);
  document.body.append(host);
  return { host, defs };
}
