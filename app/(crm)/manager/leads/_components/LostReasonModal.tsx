'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import type { LeadLostReason } from '@/lib/db/schema/leads';
import { LEAD_LOST_REASONS } from '@/lib/lead-lost-reasons';

const REASONS = LEAD_LOST_REASONS;

export function LostReasonModal({
  open,
  leadName,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean;
  leadName: string | null;
  onClose: () => void;
  onSubmit: (input: { reasonCode: LeadLostReason; reason: string }) => void;
  isPending: boolean;
}) {
  const [reasonCode, setReasonCode] = useState<LeadLostReason | null>(null);
  const [reason, setReason] = useState('');

  if (!open) return null;

  const isOther = reasonCode === 'other';
  const otherInvalid = isOther && reason.trim().length < 3;
  const canSubmit = reasonCode !== null && !otherInvalid;

  const submit = () => {
    if (!canSubmit || !reasonCode) return;
    onSubmit({ reasonCode, reason: reason.trim() });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-bg-primary rounded-xl border border-gray-200 shadow-2xl w-full max-w-lg my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-orbitron font-semibold tracking-wider text-content-primary uppercase">
              Лид не состоялся
            </h2>
            <p className="text-xs text-content-muted mt-1">
              {leadName ? (
                <>
                  Заявка от <strong>{leadName}</strong>.{' '}
                </>
              ) : null}
              Укажи причину — это пригодится для аналитики воронки.
            </p>
          </div>
          <button onClick={onClose} className="text-content-muted hover:text-content-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Reason picker */}
          <div>
            <div className="text-[11px] font-orbitron tracking-wider text-content-secondary mb-2 uppercase">
              Причина <span className="text-neon-orange">*</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {REASONS.map((r) => {
                const checked = reasonCode === r.code;
                return (
                  <button
                    key={r.code}
                    type="button"
                    onClick={() => setReasonCode(r.code)}
                    disabled={isPending}
                    className={`text-left px-3 py-2 rounded-md border-2 transition-all ${
                      checked
                        ? 'border-neon-orange bg-neon-orange/5 text-content-primary'
                        : 'border-gray-200 text-content-secondary hover:border-neon-orange/40'
                    }`}
                  >
                    <div className="text-xs font-medium">{r.label}</div>
                    {r.hint && (
                      <div className="text-[10px] text-content-muted mt-0.5">{r.hint}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional comment / required for "other" */}
          <div>
            <div className="text-[11px] font-orbitron tracking-wider text-content-secondary mb-2 uppercase">
              Комментарий{' '}
              {isOther ? (
                <span className="text-neon-orange">*</span>
              ) : (
                <span className="text-content-muted/60 text-[10px] normal-case">(необязательно)</span>
              )}
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                isOther
                  ? 'Опиши причину подробнее…'
                  : 'Можно добавить детали (например, конкретного конкурента или сумму, на которой не сошлись)…'
              }
              rows={3}
              disabled={isPending}
              className="w-full rounded-md bg-bg-primary px-3 py-2 text-sm border border-gray-200 focus:border-neon-orange focus:ring-2 focus:ring-neon-orange/20 focus:outline-none transition-all resize-none"
            />
            {otherInvalid && (
              <div className="text-[10px] text-neon-orange mt-1">
                Для «Другое» комментарий обязателен (мин. 3 символа)
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 pt-3 border-t border-gray-100">
          <CyberpunkButton onClick={onClose} variant="ghost" size="default" disabled={isPending}>
            Отмена
          </CyberpunkButton>
          <CyberpunkButton
            onClick={submit}
            disabled={isPending || !canSubmit}
            variant="primary"
            size="default"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Сохраняю…
              </>
            ) : (
              'Сохранить'
            )}
          </CyberpunkButton>
        </div>
      </div>
    </div>
  );
}
