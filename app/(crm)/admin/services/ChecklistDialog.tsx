'use client';

import { useState, useTransition, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, GripVertical, ArrowUp, ArrowDown, Save, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import {
  listChecklistTemplates,
  createChecklistTemplate,
  updateChecklistTemplate,
  deleteChecklistTemplate,
  reorderChecklistTemplates,
} from './checklist-actions';
import type { ServiceChecklist } from '@/lib/db/schema/checklists';

type Props = {
  serviceId: string;
  serviceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Локальная редакция одной строки (драфт перед save).
type DraftRow = {
  id?: string; // если есть — existing, иначе new
  position: number;
  title: string;
  description: string;
  required: boolean;
  dirty: boolean;
};

export function ChecklistDialog({ serviceId, serviceName, open, onOpenChange }: Props) {
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listChecklistTemplates(serviceId).then((res) => {
      if (res.ok) {
        setRows(
          res.data.map((r: ServiceChecklist) => ({
            id: r.id,
            position: r.position,
            title: r.title,
            description: r.description ?? '',
            required: r.required,
            dirty: false,
          })),
        );
      } else {
        toast.error(res.error);
      }
      setLoading(false);
    });
  }, [open, serviceId]);

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        position: prev.length,
        title: '',
        description: '',
        required: true,
        dirty: true,
      },
    ]);
  }

  function patchRow(idx: number, patch: Partial<DraftRow>) {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch, dirty: true };
      return next;
    });
  }

  function moveRow(idx: number, dir: -1 | 1) {
    setRows((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      // position сразу пересчитываем
      return next.map((r, i) => ({ ...r, position: i, dirty: true }));
    });
  }

  function removeRow(idx: number) {
    const row = rows[idx];
    if (row.id) {
      // existing — удалить через action
      startTransition(async () => {
        const res = await deleteChecklistTemplate(row.id!);
        if (res.ok) {
          toast.success('Пункт удалён');
          setRows((prev) => prev.filter((_, i) => i !== idx));
        } else {
          toast.error(res.error);
        }
      });
    } else {
      // новый — просто из state
      setRows((prev) => prev.filter((_, i) => i !== idx));
    }
  }

  async function saveAll() {
    // 1) Создаём/обновляем dirty строки.
    let createdAny = false;
    let updatedAny = false;
    let firstError: string | null = null;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.dirty) continue;
      if (!r.title.trim()) {
        firstError = `Пункт #${i + 1}: укажи название`;
        break;
      }
      const payload = { title: r.title.trim(), description: r.description.trim(), required: r.required };
      if (r.id) {
        const res = await updateChecklistTemplate(r.id, payload);
        if (!res.ok) {
          firstError = res.error;
          break;
        }
        updatedAny = true;
      } else {
        const res = await createChecklistTemplate(serviceId, payload);
        if (!res.ok) {
          firstError = res.error;
          break;
        }
        // Подставляем id новой записи в state, чтобы повторный save не дублировал
        r.id = res.data.id;
        createdAny = true;
      }
    }

    if (firstError) {
      toast.error(firstError);
      return;
    }

    // 2) Reorder — на случай если перемещали стрелочками.
    const ids = rows.filter((r) => r.id).map((r) => r.id!);
    if (ids.length > 0) {
      const res = await reorderChecklistTemplates(serviceId, ids);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
    }

    if (createdAny || updatedAny) {
      toast.success('Чеклист сохранён');
    }
    // Сбрасываем dirty
    setRows((prev) => prev.map((r) => ({ ...r, dirty: false })));
  }

  const hasDirty = rows.some((r) => r.dirty);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-orbitron uppercase tracking-wider">
            Чек-лист услуги
          </DialogTitle>
          <DialogDescription>
            Шаблон пунктов, которые мастер обязан выполнить при выезде по услуге{' '}
            <span className="text-content-primary font-medium">{serviceName}</span>. Этот
            шаблон копируется в каждый новый выезд, мастер ставит галки на месте.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-content-muted">Загружаю…</div>
        ) : (
          <div className="space-y-3">
            {rows.length === 0 && (
              <div className="text-sm text-content-muted text-center py-6 border border-dashed border-gray-200 rounded-lg">
                Пунктов пока нет. Нажми «Добавить пункт» — например: «Проверить
                вентиляцию перед обработкой».
              </div>
            )}

            {rows.map((row, idx) => (
              <div
                key={row.id ?? `new-${idx}`}
                className="border border-gray-200 rounded-lg p-3 space-y-2 bg-bg-secondary/30"
              >
                <div className="flex items-start gap-2">
                  <div className="flex flex-col gap-0.5 pt-1.5">
                    <button
                      type="button"
                      onClick={() => moveRow(idx, -1)}
                      disabled={idx === 0}
                      className="p-0.5 text-content-muted hover:text-content-primary disabled:opacity-30"
                      aria-label="Выше"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <GripVertical className="w-3 h-3 text-content-muted/40" />
                    <button
                      type="button"
                      onClick={() => moveRow(idx, 1)}
                      disabled={idx === rows.length - 1}
                      className="p-0.5 text-content-muted hover:text-content-primary disabled:opacity-30"
                      aria-label="Ниже"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex-1 space-y-2">
                    <div>
                      <Input
                        placeholder="Название пункта (что мастер должен сделать)"
                        value={row.title}
                        onChange={(e) => patchRow(idx, { title: e.target.value })}
                        className="font-medium"
                      />
                    </div>
                    <div>
                      <Textarea
                        placeholder="Подсказка для мастера — например: ''Проверить вентиляцию перед обработкой''. Видна на странице выезда под названием пункта."
                        value={row.description}
                        onChange={(e) =>
                          patchRow(idx, { description: e.target.value })
                        }
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm text-content-secondary cursor-pointer">
                        <Switch
                          checked={row.required}
                          onCheckedChange={(v) => patchRow(idx, { required: v })}
                        />
                        Обязательный пункт
                        <span className="text-xs text-content-muted">
                          (мастер не сможет завершить выезд, не отметив этот пункт)
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="p-1.5 text-content-muted hover:text-red-500 rounded"
                        aria-label="Удалить пункт"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addRow}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-gray-200 hover:border-neon-orange hover:bg-neon-orange/5 text-content-muted hover:text-neon-orange rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Добавить пункт
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-200">
          <div className="text-xs text-content-muted">
            {rows.length > 0
              ? `${rows.length} ${pluralize(rows.length, ['пункт', 'пункта', 'пунктов'])} · ${rows.filter((r) => r.required).length} обязательных`
              : ''}
          </div>
          <div className="flex items-center gap-2">
            <CyberpunkButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              <X className="w-3 h-3 mr-1" />
              Закрыть
            </CyberpunkButton>
            <CyberpunkButton
              type="button"
              size="sm"
              onClick={saveAll}
              disabled={!hasDirty || loading}
            >
              <Save className="w-3 h-3 mr-1" />
              Сохранить
            </CyberpunkButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function pluralize(n: number, [one, few, many]: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
