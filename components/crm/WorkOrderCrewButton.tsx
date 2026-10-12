'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { CrewPicker } from '@/components/crm/CrewPicker';
import {
  getWorkOrderCrew,
  updateWorkOrderCrew,
  type WorkOrderCrewData,
} from '@/app/(crm)/manager/calendar/work-order-actions';

type CrewLoaded = Extract<WorkOrderCrewData, { ok: true }>;

/**
 * Кнопка «Бригада» на карточке наряда (менеджер): добавить/убрать напарников, пока наряд
 * не завершён — без удаления и пересоздания. Основной мастер не меняется. Состав грузится
 * при открытии (на карточке списка бригады нет — только подпись «А + Б»).
 */
export function WorkOrderCrewButton({ workLogId }: { workLogId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [crew, setCrew] = useState<CrewLoaded | null>(null);
  const [partnerIds, setPartnerIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  async function open() {
    setLoading(true);
    try {
      const res = await getWorkOrderCrew(workLogId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCrew(res);
      setPartnerIds(res.partnerIds);
    } catch {
      toast.error('Не удалось загрузить бригаду');
    } finally {
      setLoading(false);
    }
  }

  function save() {
    startTransition(async () => {
      const res = await updateWorkOrderCrew({ workLogId, partnerIds });
      if (res.ok) {
        toast.success(
          partnerIds.length > 0 ? 'Бригада сохранена — напарникам ушёл push' : 'Наряд снова на одного',
        );
        setCrew(null);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={loading}
        className="p-1.5 text-content-muted hover:text-neon-orange hover:bg-neon-orange/10 rounded border border-gray-200 disabled:opacity-50"
        title="Бригада: добавить или убрать напарника"
        aria-label="Бригада наряда"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
      </button>

      {crew && (
        <Dialog open onOpenChange={(o) => !o && !isPending && setCrew(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-orbitron uppercase tracking-wide">Бригада наряда</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-content-secondary">
                Основной мастер: <span className="font-medium">{crew.masterName ?? '—'}</span>
              </p>
              {crew.editable ? (
                <>
                  <p className="text-xs text-content-muted">
                    Напарники видят наряд у себя, отмечают чеклист и могут его завершить.
                    Добавленным и снятым придёт push.
                  </p>
                  <CrewPicker
                    masters={crew.masters}
                    primaryId={crew.masterId}
                    value={partnerIds}
                    onChange={setPartnerIds}
                    disabled={isPending}
                  />
                </>
              ) : (
                <p className="text-sm text-content-muted">
                  Наряд уже завершён — состав бригады не меняется.
                </p>
              )}
            </div>
            <DialogFooter>
              <CyberpunkButton variant="outline" onClick={() => setCrew(null)} disabled={isPending}>
                Закрыть
              </CyberpunkButton>
              {crew.editable && (
                <CyberpunkButton onClick={save} disabled={isPending}>
                  {isPending ? 'Сохраняю…' : 'Сохранить'}
                </CyberpunkButton>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
