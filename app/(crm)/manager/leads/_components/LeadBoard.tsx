'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { LeadStatus, LeadLostReason } from '@/lib/db/schema/leads';
import { KanbanColumn, type ColumnDef } from './KanbanColumn';
import { LeadCard, type BoardLead } from './LeadCard';
import { LostReasonModal } from './LostReasonModal';
import { ConvertOnDropModal } from './ConvertOnDropModal';
import { ProposalDialog, type ProposalSubmitInput } from './ProposalDialog';
import {
  updateLeadStatus,
  convertLeadToClient,
  markLeadLost,
  submitProposalForLead,
} from '../actions';

const COLUMNS: ColumnDef[] = [
  { id: 'new', label: 'Новые', accent: 'border-electric-blue text-electric-blue', bgAccent: 'bg-electric-blue/10' },
  { id: 'contacted', label: 'Связались', accent: 'border-cyber-blue text-cyber-blue', bgAccent: 'bg-cyber-blue/10' },
  { id: 'proposal_sent', label: 'КП отправлено', accent: 'border-neon-orange text-neon-orange', bgAccent: 'bg-neon-orange/15' },
  { id: 'contract_signed', label: 'Договор подписан', accent: 'border-violet-500 text-violet-600', bgAccent: 'bg-violet-500/10' },
  { id: 'works_completed', label: 'Реализована', accent: 'border-emerald-500 text-emerald-600', bgAccent: 'bg-emerald-500/10' },
  { id: 'won', label: 'Оплата', accent: 'border-emerald-700 text-emerald-700', bgAccent: 'bg-emerald-700/10' },
  { id: 'lost', label: 'Не состоялась', accent: 'border-content-muted text-content-muted', bgAccent: 'bg-content-muted/10' },
];

type PendingDrop =
  | null
  | { kind: 'lost'; leadId: string; fromStatus: LeadStatus; leadName: string | null }
  | { kind: 'convert'; leadId: string; fromStatus: LeadStatus; defaultName: string }
  | {
      kind: 'proposal';
      leadId: string;
      fromStatus: LeadStatus;
      defaultName: string;
      defaultEmail: string;
    };

export function LeadBoard({ initialLeads }: { initialLeads: BoardLead[] }) {
  const router = useRouter();
  const [leads, setLeads] = useState<BoardLead[]>(initialLeads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingDrop, setPendingDrop] = useState<PendingDrop>(null);
  const [isPending, startTransition] = useTransition();

  // Синхронизируем локальный state с серверными данными после revalidatePath
  // (например, после создания лида в модалке или ручной правки на детальной).
  // Optimistic updates во время DnD не теряются — сервер всё равно даст
  // финальное consistent состояние.
  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // не drag-ить при клике
    }),
    useSensor(KeyboardSensor) // accessibility: Tab→Space→Arrow→Space
  );

  const grouped = useMemo(() => {
    const acc: Record<LeadStatus, BoardLead[]> = {
      new: [],
      contacted: [],
      qualified: [], // legacy, не отображается на канбане (нет колонки)
      proposal_sent: [],
      contract_signed: [],
      works_completed: [],
      won: [],
      lost: [],
    };
    for (const l of leads) acc[l.status].push(l);
    // сортировка внутри колонок: новые сверху
    (Object.keys(acc) as LeadStatus[]).forEach((k) => {
      acc[k].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    });
    return acc;
  }, [leads]);

  const activeLead = activeId ? leads.find((l) => l.id === activeId) ?? null : null;

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const leadId = String(active.id);
    const newStatus = over.id as LeadStatus;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === newStatus) return;

    // Особые колонки требуют модалку — НЕ применяем optimistic, ждём submit
    if (newStatus === 'lost') {
      setPendingDrop({
        kind: 'lost',
        leadId,
        fromStatus: lead.status,
        leadName: lead.contactName,
      });
      return;
    }
    // "Договор подписан" = момент конвертации лида в клиента (юр. veха).
    // Открываем модалку конверта только если ещё нет связанного клиента.
    if (newStatus === 'contract_signed') {
      setPendingDrop({
        kind: 'convert',
        leadId,
        fromStatus: lead.status,
        defaultName: lead.contactName ?? '',
      });
      return;
    }
    // "КП отправлено" = генерация и отправка КП клиенту по email.
    // Открываем модалку прайса. Без submit — лид остаётся в исходной колонке.
    if (newStatus === 'proposal_sent') {
      setPendingDrop({
        kind: 'proposal',
        leadId,
        fromStatus: lead.status,
        defaultName: lead.contactName ?? '',
        defaultEmail: lead.contactEmail ?? '',
      });
      return;
    }

    // Обычная смена статуса — optimistic update
    const prev = leads;
    setLeads((cur) => cur.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)));
    startTransition(async () => {
      const res = await updateLeadStatus({ id: leadId, status: newStatus });
      if (!res.ok) {
        toast.error(res.error);
        setLeads(prev); // откат
        return;
      }
      toast.success('Статус обновлён');
      router.refresh();
    });
  };

  const closePending = () => setPendingDrop(null);

  const submitLost = (input: { reasonCode: LeadLostReason; reason: string }) => {
    if (!pendingDrop || pendingDrop.kind !== 'lost') return;
    const { leadId } = pendingDrop;
    const prev = leads;
    setLeads((cur) => cur.map((l) => (l.id === leadId ? { ...l, status: 'lost' } : l)));
    startTransition(async () => {
      const res = await markLeadLost({
        id: leadId,
        reasonCode: input.reasonCode,
        reason: input.reason,
      });
      if (!res.ok) {
        toast.error(res.error);
        setLeads(prev);
        setPendingDrop(null);
        return;
      }
      toast.success('Лид помечен как «Не состоялась»');
      setPendingDrop(null);
      router.refresh();
    });
  };

  const submitConvert = (input: {
    type: 'legal' | 'individual';
    shortName: string;
    createDeal: boolean;
  }) => {
    if (!pendingDrop || pendingDrop.kind !== 'convert') return;
    const { leadId } = pendingDrop;
    const prev = leads;
    setLeads((cur) => cur.map((l) => (l.id === leadId ? { ...l, status: 'contract_signed' } : l)));
    startTransition(async () => {
      const res = await convertLeadToClient({ id: leadId, ...input });
      if (!res.ok) {
        toast.error(res.error);
        setLeads(prev);
        setPendingDrop(null);
        return;
      }
      toast.success(
        input.createDeal
          ? 'Клиент и сделка созданы'
          : 'Клиент создан, лид помечен как «Договор подписан»',
      );
      setPendingDrop(null);
      router.push(
        res.data.dealId
          ? `/manager/deals/${res.data.dealId}`
          : `/manager/clients/${res.data.clientId}`,
      );
      router.refresh();
    });
  };

  const submitProposal = (input: ProposalSubmitInput) => {
    if (!pendingDrop || pendingDrop.kind !== 'proposal') return;
    const { leadId } = pendingDrop;
    const prev = leads;
    // Optimistic: переводим в proposal_sent сразу для отзывчивости
    setLeads((cur) =>
      cur.map((l) => (l.id === leadId ? { ...l, status: 'proposal_sent' } : l)),
    );
    startTransition(async () => {
      const res = await submitProposalForLead({
        leadId,
        type: input.type,
        shortName: input.shortName,
        email: input.email,
        subject: input.subject,
        validUntil: input.validUntil,
        items: input.items.map((it) => ({
          customName: it.customName,
          areaM2: Number(it.areaM2) || 0,
          priceNoVat: Number(it.priceNoVat) || 0,
          vatRate: Number(it.vatRate) || 0,
          method: it.method,
          frequency: it.frequency,
        })),
      });
      if (!res.ok) {
        toast.error(res.error);
        setLeads(prev); // откат
        // НЕ закрываем модалку — даём возможность исправить
        return;
      }
      const transportNote =
        res.data.emailTransport === 'noop'
          ? ' (email замокан, скачай DOCX в карточке сделки)'
          : res.data.emailTransport === 'failed'
            ? ' (email упал, DOCX готов — скачай в сделке)'
            : '';
      toast.success(`КП отправлено на ${input.email}${transportNote}`);
      setPendingDrop(null);
      router.push(`/manager/deals/${res.data.dealId}?tab=documents`);
      router.refresh();
    });
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 pb-4">
        {COLUMNS.map((c) => (
          <KanbanColumn key={c.id} column={c} leads={grouped[c.id]} />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeLead ? <LeadCard lead={activeLead} isOverlay /> : null}
      </DragOverlay>

      <LostReasonModal
        open={pendingDrop?.kind === 'lost'}
        leadName={pendingDrop?.kind === 'lost' ? pendingDrop.leadName : null}
        onClose={closePending}
        onSubmit={submitLost}
        isPending={isPending}
      />
      <ConvertOnDropModal
        open={pendingDrop?.kind === 'convert'}
        defaultName={pendingDrop?.kind === 'convert' ? pendingDrop.defaultName : ''}
        onClose={closePending}
        onSubmit={submitConvert}
        isPending={isPending}
      />
      <ProposalDialog
        open={pendingDrop?.kind === 'proposal'}
        defaultName={pendingDrop?.kind === 'proposal' ? pendingDrop.defaultName : ''}
        defaultEmail={pendingDrop?.kind === 'proposal' ? pendingDrop.defaultEmail : ''}
        onClose={closePending}
        onSubmit={submitProposal}
        isPending={isPending}
      />
    </DndContext>
  );
}
