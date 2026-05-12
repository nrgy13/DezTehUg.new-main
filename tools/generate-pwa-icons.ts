/**
 * Генератор PWA-иконок для CRM «ДезТехЮг».
 *
 * Запуск: `npm run pwa:icons`
 *
 * Создаёт PNG в `public/icons/`:
 *   - icon-192.png        (192×192 для манифеста)
 *   - icon-512.png        (512×512 для манифеста и splash-screen)
 *   - icon-192-maskable.png (192×192 с safe-zone для Android adaptive icons)
 *   - icon-512-maskable.png
 *   - apple-touch-icon.png (180×180 для iOS, без прозрачности)
 *   - favicon-32.png, favicon-16.png
 *
 * Цвета — из брендинга `LogoText.tsx`:
 *   Д Т Ю — комбинация красного и зелёного, как в полном логотипе.
 */

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const RED = '#e20819';
const GREEN = '#4cb032';
const BG_LIGHT = '#ffffff';
const BG_DARK = '#0f172a'; // slate-900 — для maskable, чтобы цветные буквы не сливались с обоями

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, 'public', 'icons');

function buildSvg({
  size,
  background,
  textScale = 0.42,
  letterSpacing = 0,
  paddingPct = 0.12,
}: {
  size: number;
  background: string;
  textScale?: number;
  letterSpacing?: number;
  paddingPct?: number;
}): Buffer {
  // Буквы — Д (red), Т (green), Ю (red). Sans-serif Bold с поддержкой кириллицы.
  // Arial Black даёт «расколбасную» Д с большой подставкой — стилистически тяжело
  // для иконки. Используем стандартный sans-serif bold — у DejaVu/Verdana/Tahoma
  // Д более компактная.
  const fontSize = Math.round(size * textScale);
  const fontFamily = 'DejaVu Sans, Verdana, Tahoma, Segoe UI, Arial, sans-serif';
  // safe inner width — отступаем paddingPct с обеих сторон
  const safeLeft = size * paddingPct;
  const safeRight = size * (1 - paddingPct);
  const safeMid = (safeLeft + safeRight) / 2;
  const safeQuarter = (safeRight - safeLeft) / 4;
  const cy = size / 2; // центр; dominant-baseline сделает реальный shift

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${background}" rx="${Math.round(size * 0.18)}" ry="${Math.round(size * 0.18)}"/>
  <g font-family="${fontFamily}" font-weight="700" font-size="${fontSize}" text-anchor="middle" dominant-baseline="central" letter-spacing="${letterSpacing}">
    <text x="${safeLeft + safeQuarter}" y="${cy}" fill="${RED}">Д</text>
    <text x="${safeMid}"               y="${cy}" fill="${GREEN}">Т</text>
    <text x="${safeRight - safeQuarter}" y="${cy}" fill="${RED}">Ю</text>
  </g>
</svg>`.trim();
  return Buffer.from(svg);
}

async function render(svg: Buffer, size: number, outPath: string, flatten?: string) {
  let pipeline = sharp(svg, { density: 384 }).resize(size, size);
  if (flatten) {
    pipeline = pipeline.flatten({ background: flatten });
  }
  await pipeline.png({ quality: 92 }).toFile(outPath);
  console.log(`  ✓ ${outPath}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log('Генерация PWA-иконок в', OUT_DIR);

  // Standard иконки — белый фон, цветные буквы, скруглённые углы
  const svg192 = buildSvg({ size: 192, background: BG_LIGHT });
  const svg512 = buildSvg({ size: 512, background: BG_LIGHT });
  await render(svg192, 192, join(OUT_DIR, 'icon-192.png'));
  await render(svg512, 512, join(OUT_DIR, 'icon-512.png'));

  // Maskable — Android вырезает центральный круг (safe zone ~80%).
  // Делаем буквы меньше + тёмный фон, увеличиваем padding (ОС обрежет края).
  const svgMask192 = buildSvg({ size: 192, background: BG_DARK, textScale: 0.32, paddingPct: 0.18 });
  const svgMask512 = buildSvg({ size: 512, background: BG_DARK, textScale: 0.32, paddingPct: 0.18 });
  await render(svgMask192, 192, join(OUT_DIR, 'icon-192-maskable.png'));
  await render(svgMask512, 512, join(OUT_DIR, 'icon-512-maskable.png'));

  // Apple touch icon — без прозрачности (iOS требует opaque), 180×180
  const svgApple = buildSvg({ size: 180, background: BG_LIGHT });
  await render(svgApple, 180, join(OUT_DIR, 'apple-touch-icon.png'), BG_LIGHT);

  // Favicon — буквы крупнее, потому что размер маленький
  const svgFav32 = buildSvg({ size: 32, background: BG_LIGHT, textScale: 0.55, paddingPct: 0.04 });
  const svgFav16 = buildSvg({ size: 16, background: BG_LIGHT, textScale: 0.62, paddingPct: 0.02 });
  await render(svgFav32, 32, join(OUT_DIR, 'favicon-32.png'));
  await render(svgFav16, 16, join(OUT_DIR, 'favicon-16.png'));

  console.log('Готово.');
}

main().catch((err) => {
  console.error('Ошибка генерации иконок:', err);
  process.exit(1);
});
