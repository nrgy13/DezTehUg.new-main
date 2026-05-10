'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Pencil, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { NeonInput } from '@/components/cyberpunk/NeonInput';
import { Label } from '@/components/ui/label';
import { updateDeal } from '../actions';
import type { Deal } from '@/lib/db/schema/deals';
import type { Client } from '@/lib/db/schema/clients';

type UserShort = { id: string; fullName: string; role: string } | null;

export function DealRequisitesTab({
  deal,
  client,
  manager,
  master,
  allManagers,
  allMasters,
}: {
  deal: Deal;
  client: Client;
  manager: UserShort;
  master: UserShort;
  allManagers: { id: string; fullName: string; role: string }[];
  allMasters: { id: string; fullName: string; role: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [contractDate, setContractDate] = useState(deal.contractDate ?? '');
  const [contractPlace, setContractPlace] = useState(deal.contractPlace ?? '');
  const [startDate, setStartDate] = useState(deal.startDate ?? '');
  const [endDate, setEndDate] = useState(deal.endDate ?? '');
  const [startTime, setStartTime] = useState(
    deal.isAllDay || !deal.startAt ? '' : moscowHHMM(deal.startAt),
  );
  const [endTime, setEndTime] = useState(
    deal.isAllDay || !deal.endAt ? '' : moscowHHMM(deal.endAt),
  );
  const [signatoryClient, setSignatoryClient] = useState(deal.signatoryClient ?? '');
  const [signatoryExecutor, setSignatoryExecutor] = useState(deal.signatoryExecutor ?? '');
  const [assignedManagerId, setAssignedManagerId] = useState(deal.assignedManagerId ?? '');
  const [assignedMasterId, setAssignedMasterId] = useState(deal.assignedMasterId ?? '');
  const [notes, setNotes] = useState(deal.notes ?? '');

  function handleSave() {
    startTransition(async () => {
      const res = await updateDeal(deal.id, {
        clientId: deal.clientId,
        leadId: deal.leadId,
        contractDate,
        contractPlace,
        startDate,
        endDate,
        startTime,
        endTime,
        signatoryClient,
        signatoryExecutor,
        assignedManagerId: assignedManagerId || null,
        assignedMasterId: assignedMasterId || null,
        notes,
      });
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success('Сохранено');
        setEditing(false);
      }
    });
  }

  return (
    <CyberpunkCard variant="default" hoverEffect={false} className="p-6">
      <div className="flex justify-between items-start mb-5">
        <h2 className="text-base font-orbitron font-semibold uppercase tracking-wider text-content-primary">
          Реквизиты сделки
        </h2>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs text-content-muted hover:text-neon-orange"
          >
            <Pencil className="w-3 h-3" />
            Редактировать
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={isPending}
              className="flex items-center gap-1 text-xs text-content-muted hover:text-content-primary"
            >
              <X className="w-3 h-3" />
              Отмена
            </button>
            <CyberpunkButton variant="primary" size="sm" onClick={handleSave} disabled={isPending}>
              <Save className="w-3 h-3 mr-1" />
              {isPending ? 'Сохранение…' : 'Сохранить'}
            </CyberpunkButton>
          </div>
        )}
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
        <Field label="Клиент">
          <Link
            href={`/manager/clients/${client.id}`}
            className="text-neon-orange hover:underline"
          >
            {client.shortName}
          </Link>
          <div className="text-xs text-content-muted">
            {client.type === 'legal' ? 'Юрлицо' : 'Физлицо'}
            {client.inn && <> · ИНН {client.inn}</>}
          </div>
        </Field>

        <Field label="Дата договора">
          {editing ? (
            <NeonInput
              type="date"
              value={contractDate}
              onChange={(e) => setContractDate(e.target.value)}
              disabled={isPending}
            />
          ) : (
            formatDate(deal.contractDate)
          )}
        </Field>

        <Field label="Место">
          {editing ? (
            <NeonInput
              value={contractPlace}
              onChange={(e) => setContractPlace(e.target.value)}
              disabled={isPending}
            />
          ) : (
            deal.contractPlace ?? '—'
          )}
        </Field>

        <Field label="Период действия">
          {editing ? (
            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                <NeonInput
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={isPending}
                />
                <NeonInput
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={isPending}
                  className="w-24"
                />
              </div>
              <div className="flex gap-2 items-center">
                <NeonInput
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={isPending}
                />
                <NeonInput
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={isPending}
                  className="w-24"
                />
              </div>
              <p className="text-[10px] text-content-muted">
                Время — опционально (МСК). Без времени — событие на весь день.
              </p>
            </div>
          ) : (
            <span className="text-content-secondary">
              {formatDate(deal.startDate)}
              {!deal.isAllDay && deal.startAt && ` ${moscowHHMM(deal.startAt)}`}
              {' – '}
              {formatDate(deal.endDate)}
              {!deal.isAllDay && deal.endAt && ` ${moscowHHMM(deal.endAt)}`}
            </span>
          )}
        </Field>

        <Field label="Подписант со стороны заказчика">
          {editing ? (
            <NeonInput
              value={signatoryClient}
              onChange={(e) => setSignatoryClient(e.target.value)}
              placeholder="Генеральный директор Иванов И.И."
              disabled={isPending}
            />
          ) : (
            deal.signatoryClient ?? '—'
          )}
        </Field>

        <Field label="Подписант со стороны исполнителя">
          {editing ? (
            <NeonInput
              value={signatoryExecutor}
              onChange={(e) => setSignatoryExecutor(e.target.value)}
              disabled={isPending}
            />
          ) : (
            deal.signatoryExecutor ?? '—'
          )}
        </Field>

        <Field label="Менеджер">
          {editing ? (
            <select
              value={assignedManagerId}
              onChange={(e) => setAssignedManagerId(e.target.value)}
              disabled={isPending}
              className="w-full px-3 py-2 text-sm bg-bg-primary border border-gray-300 rounded-md focus:border-neon-orange focus:outline-none"
            >
              <option value="">— не назначен —</option>
              {allManagers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
            </select>
          ) : (
            manager?.fullName ?? '—'
          )}
        </Field>

        <Field label="Мастер (исполнитель)">
          {editing ? (
            <select
              value={assignedMasterId}
              onChange={(e) => setAssignedMasterId(e.target.value)}
              disabled={isPending}
              className="w-full px-3 py-2 text-sm bg-bg-primary border border-gray-300 rounded-md focus:border-neon-orange focus:outline-none"
            >
              <option value="">— не назначен —</option>
              {allMasters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
            </select>
          ) : (
            master?.fullName ?? '—'
          )}
        </Field>

        <div className="sm:col-span-2">
          <Label className="text-xs uppercase font-orbitron tracking-wider text-content-muted">
            Заметки
          </Label>
          {editing ? (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              disabled={isPending}
              className="w-full mt-1 px-3 py-2 text-sm bg-bg-primary border border-gray-300 rounded-md focus:border-neon-orange focus:outline-none"
            />
          ) : (
            <p className="mt-1 text-content-secondary whitespace-pre-wrap">
              {deal.notes || '—'}
            </p>
          )}
        </div>
      </dl>
    </CyberpunkCard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs uppercase font-orbitron tracking-wider text-content-muted">
        {label}
      </Label>
      <div className="mt-1 text-content-primary">{children}</div>
    </div>
  );
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

/** ISO timestamp → 'HH:MM' в TZ='Europe/Moscow'. */
function moscowHHMM(iso: Date | string | null): string {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}
