// PURE shared module — импортируется и client и server частью.
// БД-запросы вынесены в lib/lead-stages-server.ts (там import 'server-only').
// Здесь — только константы, цвета и чистые функции расчёта.

import type { LeadStatus } from '@/lib/db/schema/leads';

// ─── Цвета по стадиям воронки ────────────────────────────────
export const STAGE_COLORS: Record<
  LeadStatus,
  { bg: string; text: string; border: string; dot: string; label: string }
> = {
  new: {
    label: 'Новые',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-300',
    dot: 'bg-blue-500',
  },
  contacted: {
    label: 'Связались',
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-300',
    dot: 'bg-cyan-500',
  },
  qualified: {
    label: 'Квалифицированы (legacy)',
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-300',
    dot: 'bg-gray-400',
  },
  proposal_sent: {
    label: 'КП отправлено',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-300',
    dot: 'bg-orange-500',
  },
  contract_signed: {
    label: 'Договор подписан',
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-300',
    dot: 'bg-violet-500',
  },
  works_completed: {
    label: 'Реализована',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-300',
    dot: 'bg-emerald-500',
  },
  won: {
    label: 'Оплата',
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-500',
    dot: 'bg-green-700',
  },
  lost: {
    label: 'Не состоялась',
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    border: 'border-gray-300',
    dot: 'bg-gray-400',
  },
};

// ─── Пороги «зависания» ──────────────────────────────────────
// warn = жёлтый, stale = красный.
// null = финальная стадия (won/lost), индикатор не показываем.
export type StageThreshold = { warn: number; stale: number };
export const STALE_THRESHOLDS: Record<LeadStatus, StageThreshold | null> = {
  new: { warn: 0, stale: 1 },
  contacted: { warn: 2, stale: 3 },
  qualified: { warn: 2, stale: 3 }, // legacy
  proposal_sent: { warn: 5, stale: 7 },
  contract_signed: { warn: 10, stale: 14 },
  works_completed: { warn: 3, stale: 5 },
  won: null,
  lost: null,
};

export type StageHealth = 'fresh' | 'warn' | 'stale' | 'final';

export function stageHealthLevel(status: LeadStatus, days: number): StageHealth {
  const t = STALE_THRESHOLDS[status];
  if (t == null) return 'final';
  if (days >= t.stale) return 'stale';
  if (days >= t.warn) return 'warn';
  return 'fresh';
}

// Цветовые классы для бейджа в зависимости от здоровья.
// Сначала смотрим health (если stale → красный поверх стадии),
// если fresh — берём цвета из STAGE_COLORS.
export function badgeClassesForLead(
  status: LeadStatus,
  days: number,
): { bg: string; text: string; dot: string; ringPulse?: string } {
  const health = stageHealthLevel(status, days);
  if (health === 'stale') {
    return { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', ringPulse: 'ring-2 ring-red-400/50 animate-pulse' };
  }
  if (health === 'warn') {
    return { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' };
  }
  if (health === 'final') {
    const c = STAGE_COLORS[status];
    return { bg: c.bg, text: c.text, dot: c.dot };
  }
  // fresh — стадийный цвет
  const c = STAGE_COLORS[status];
  return { bg: c.bg, text: c.text, dot: c.dot };
}

// ─── Подсчёт дней ────────────────────────────────────────────
export function daysSince(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  const ms = Date.now() - d.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function formatDays(days: number): string {
  if (days === 0) return 'сегодня';
  if (days === 1) return '1д';
  return `${days}д`;
}

// БД-запросы — в lib/lead-stages-server.ts (server-only).
