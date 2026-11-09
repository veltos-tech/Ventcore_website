"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { createGlassFilter, createGlassFilterHost, type GlassGeometry } from "@/lib/liquid-glass";

// CSS blur/tint/rim work without JavaScript. SVG backdrop refraction is an
// enhancement for Chromium; WebKit's reference backdrop filters remain limited.
const supportsBackdropRefraction = () => /(?:Chrome|Chromium|Edg)\/\d+/.test(navigator.userAgent);

export function LiquidGlassEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(".glass-material"));
    const reducedTransparency = matchMedia("(prefers-reduced-transparency: reduce)");
    const forcedColors = matchMedia("(forced-colors: active)");
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
    const canRefract = supportsBackdropRefraction();
    const { host, defs } = canRefract ? createGlassFilterHost() : { host: null, defs: null };
    const filters = new Map<string, string>();
    const pending = new Set<HTMLElement>();
    let resizeFrame = 0;
    let pointerFrame = 0;
    let nextFilter = 0;

    function rebuild() {
      resizeFrame = 0;
      if (!defs) return;
      for (const element of pending) {
        if (reducedTransparency.matches || forcedColors.matches) {
          element.style.removeProperty("--glass-refraction");
          continue;
        }
        const width = element.offsetWidth;
        const height = element.offsetHeight;
        if (width < 8 || height < 8) continue;
        const style = getComputedStyle(element);
        const geometry: GlassGeometry = {
          width,
          height,
          radius: parseFloat(style.borderTopLeftRadius) || 20,
          depth: parseFloat(style.getPropertyValue("--glass-depth")) || 24,
          strength: parseFloat(style.getPropertyValue("--glass-strength")) || 18,
          blur: parseFloat(style.getPropertyValue("--glass-blur")) || 5,
          saturation: parseFloat(style.getPropertyValue("--glass-saturation")) || 1.3,
        };
        const key = Object.values(geometry).join(":");
        let id = filters.get(key);
        if (!id) {
          id = `live-glass-${nextFilter++}`;
          const filter = createGlassFilter(id, geometry);
          if (!filter) continue;
          defs.append(filter);
          filters.set(key, id);
        }
        element.style.setProperty("--glass-refraction", `url("#${id}")`);
      }
      pending.clear();
      // Bound filter/cache memory after repeated device rotation or resizing.
      if (filters.size > 32) {
        const active = new Set(elements.map((element) => element.style.getPropertyValue("--glass-refraction")));
        for (const [key, id] of filters) {
          if (!active.has(`url("#${id}")`)) {
            defs.querySelector(`#${id}`)?.remove();
            filters.delete(key);
          }
        }
      }
    }

    function schedule() {
      elements.forEach((element) => pending.add(element));
      if (!resizeFrame) resizeFrame = requestAnimationFrame(rebuild);
    }

    const observer = canRefract ? new ResizeObserver(schedule) : null;
    elements.forEach((element) => observer?.observe(element));
    reducedTransparency.addEventListener("change", schedule);
    forcedColors.addEventListener("change", schedule);

    function onPointerMove(event: PointerEvent) {
      if (!finePointer.matches || reducedMotion.matches) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(".glass-material") : null;
      if (!target) return;
      cancelAnimationFrame(pointerFrame);
      pointerFrame = requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect();
        target.style.setProperty("--glass-pointer-x", `${((event.clientX - rect.left) / rect.width) * 100}%`);
        target.style.setProperty("--glass-pointer-y", `${((event.clientY - rect.top) / rect.height) * 100}%`);
      });
    }

    document.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      observer?.disconnect();
      cancelAnimationFrame(resizeFrame);
      cancelAnimationFrame(pointerFrame);
      reducedTransparency.removeEventListener("change", schedule);
      forcedColors.removeEventListener("change", schedule);
      document.removeEventListener("pointermove", onPointerMove);
      elements.forEach((element) => {
        element.style.removeProperty("--glass-refraction");
        element.style.removeProperty("--glass-pointer-x");
        element.style.removeProperty("--glass-pointer-y");
      });
      host?.remove();
    };
  }, [pathname]);

  return null;
}
