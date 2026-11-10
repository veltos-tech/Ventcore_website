// Прогрев кэша оптимизированных картинок. Модуль без импортов: его проверяет scripts/test-images.mjs.
//
// next/image кодирует каждую картинку при ПЕРВОМ запросе (AVIF на одном ядре сервера — секунды), а после каждого
// выпуска кэш пуст: первый посетитель ждал бы, пока главная картинка сжимается (LCP на десктопе доходил до 8 с против 1,5 с
// на тёплом кэше). Поэтому после запуска сайт сам один раз обходит свои страницы и запрашивает все картинки.

export type WarmResult = { pages: number; images: number; warmed: number; failed: number; ms: number };

/** Адреса /_next/image?url=…&w=…&q=… из HTML страницы (в атрибутах они записаны с &amp;). */
export function extractImageUrls(html: string): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(/\/_next\/image\?[^"'\s,\\<>]+/g)) {
    const path = match[0].replace(/&amp;/g, "&");
    let parsed: URL;
    try { parsed = new URL(path, "http://local"); } catch { continue; }
    // Обрезанные или посторонние адреса (например, из служебных данных страницы) не запрашиваем.
    if (!parsed.searchParams.get("url") || !/^\d{2,5}$/.test(parsed.searchParams.get("w") ?? "")) continue;
    found.add(parsed.pathname + parsed.search);
  }
  return [...found];
}

const ACCEPT = "image/avif,image/webp,image/*,*/*;q=0.8";

/**
 * Обходит страницы (главная и всё из sitemap) и по очереди запрашивает их картинки — по одной, чтобы не
 * занимать единственное ядро сервера надолго. Сначала главная: её картинки важнее всего. Ошибки не прерывают обход.
 */
export async function warmImages(origin: string, options: { budgetMs?: number; fetcher?: typeof fetch } = {}): Promise<WarmResult> {
  const started = Date.now();
  const budget = options.budgetMs ?? 10 * 60_000;
  const get = options.fetcher ?? fetch;
  const result: WarmResult = { pages: 0, images: 0, warmed: 0, failed: 0, ms: 0 };
  const seen = new Set<string>();
  const expired = () => Date.now() - started > budget;

  const pages = ["/"];
  try {
    const xml = await (await get(`${origin}/sitemap.xml`, { signal: AbortSignal.timeout(20_000) })).text();
    for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      try { pages.push(new URL(match[1]).pathname); } catch { /* пропускаем некорректный адрес */ }
    }
  } catch { /* без sitemap достаточно главной */ }

  for (const page of [...new Set(pages)]) {
    if (expired()) break;
    let html: string;
    try { html = await (await get(`${origin}${page}`, { signal: AbortSignal.timeout(30_000) })).text(); } catch { continue; }
    result.pages++;
    for (const url of extractImageUrls(html)) {
      if (seen.has(url)) continue;
      seen.add(url);
      if (expired()) break;
      result.images++;
      try {
        const response = await get(`${origin}${url}`, { headers: { accept: ACCEPT }, signal: AbortSignal.timeout(60_000) });
        await response.arrayBuffer(); // дочитываем ответ: кэш записывается после полного кодирования
        if (response.ok) result.warmed++; else result.failed++;
      } catch { result.failed++; }
    }
  }
  result.ms = Date.now() - started;
  return result;
}

let started = false;

/** Запускает прогрев один раз за время жизни процесса. Адрес — только локальный: прогрев не должен ходить наружу. */
export async function warmImagesOnce(origin: string): Promise<WarmResult | null> {
  if (started) return null;
  started = true;
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) return null;
    return await warmImages(url.origin);
  } catch {
    return null;
  }
}
