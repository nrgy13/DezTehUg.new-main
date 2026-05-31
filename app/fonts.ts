import { Inter, Exo_2 } from 'next/font/google';

// UI-шрифт всего интерфейса: лейблы, таблицы, body, инпуты. Полная кириллица.
export const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-inter',
  fallback: ['system-ui', 'arial'],
});

// Акцентный «техно»-шрифт: логотип, заголовки, статзначения, бейджи.
// Exo 2 — геометрический sci-fi шрифт С КИРИЛЛИЦЕЙ (в отличие от Orbitron,
// который был latin-only → русский текст падал на monospace-fallback).
// fallback — sans-serif (НЕ monospace), чтобы при незагрузке не было «дешёвого» моно.
export const display = Exo_2({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-display',
  fallback: ['system-ui', 'sans-serif'],
});
