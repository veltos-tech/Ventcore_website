// Проверка настроек картинок и прогрева кэша. Запуск: npm run test:images
import assert from 'node:assert/strict';
import nextConfig from '../next.config.ts';
import { extractImageUrls, warmImages } from '../src/lib/warm-images.ts';

const images = nextConfig.images;
// Размеры: достаточно для телефонов 1x/2x/3x и десктопа, но не раздуты (каждый размер — отдельное кодирование на сервере).
assert.deepEqual(images.deviceSizes, [640, 828, 1200, 1920]);
assert.deepEqual(images.imageSizes, [256, 384]);
assert.ok(images.minimumCacheTTL >= 7 * 86400, 'браузерный кэш картинок должен быть не короче недели');
assert.ok(images.formats[0] === 'image/avif', 'AVIF должен идти первым');
console.log('  ok   настройки next/image');

const html = `
  <img srcSet="/_next/image?url=%2Fimages%2Fa.png&amp;w=640&amp;q=75 640w, /_next/image?url=%2Fimages%2Fa.png&amp;w=1200&amp;q=75 1200w" src="/_next/image?url=%2Fimages%2Fa.png&amp;w=1200&amp;q=75"/>
  <link rel="preload" href="/_next/static/media/font.woff2"/>
  <script>self.__next_f.push(["/_next/image?url=%2Fimages%2Fb.png\\u0026w=640\\u0026q=75"])</script>
  <a href="/_next/image?url=%2Fimages%2Fc.png">без ширины</a>
  <img src="/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Flogo.png&amp;w=256&amp;q=75"/>`;
const urls = extractImageUrls(html);
assert.deepEqual(urls, [
  '/_next/image?url=%2Fimages%2Fa.png&w=640&q=75',
  '/_next/image?url=%2Fimages%2Fa.png&w=1200&q=75',
  '/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Flogo.png&w=256&q=75',
]);
console.log('  ok   извлечение адресов (без дублей, обрезков и посторонних ссылок)');

// Обход: главная первой, затем страницы из sitemap; ошибки не прерывают прогрев; каждый адрес запрашивается один раз.
const calls = [];
const pages = {
  '/': '<img src="/_next/image?url=%2Fimages%2Fhero.png&amp;w=1920&amp;q=85"/>',
  '/blog': '<img src="/_next/image?url=%2Fimages%2Fhero.png&amp;w=1920&amp;q=85"/><img src="/_next/image?url=%2Fimages%2Fb.png&amp;w=640&amp;q=75"/><img src="/_next/image?url=%2Fimages%2Fbad.png&amp;w=640&amp;q=75"/>',
};
const fetcher = async (input, init) => {
  const url = String(input).replace('http://127.0.0.1:3000', '');
  calls.push({ url, accept: init?.headers?.accept });
  if (url === '/sitemap.xml') return new Response('<urlset><url><loc>https://vent-core.com</loc></url><url><loc>https://vent-core.com/blog</loc></url></urlset>');
  if (url in pages) return new Response(pages[url]);
  if (url.includes('bad.png')) return new Response('x', { status: 400 });
  return new Response('image');
};
const result = await warmImages('http://127.0.0.1:3000', { fetcher });
assert.equal(result.pages, 2);
assert.equal(result.images, 3, 'каждый адрес один раз, хотя hero.png есть на двух страницах');
assert.equal(result.warmed, 2);
assert.equal(result.failed, 1, 'ошибка одной картинки не должна прерывать обход');
const imageCalls = calls.filter((call) => call.url.startsWith('/_next/image'));
assert.ok(imageCalls[0].url.includes('hero.png'), 'сначала картинки главной');
assert.ok(imageCalls.every((call) => /image\/avif/.test(call.accept)), 'прогрев запрашивает AVIF как современные браузеры');
const expired = await warmImages('http://127.0.0.1:3000', { fetcher, budgetMs: -1 });
assert.equal(expired.images, 0, 'по истечении времени обход останавливается');
console.log('  ok   обход страниц и прогрев');
console.log('Картинки: все проверки пройдены.');
