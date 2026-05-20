'use client';

import { useState, useTransition, useRef } from 'react';
import { toast } from 'sonner';
import {
  Check,
  Minus,
  Circle,
  CheckCircle2,
  MinusCircle,
  Camera,
  Trash2,
  Plus,
  Play,
  Flag,
  Loader2,
} from 'lucide-react';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import {
  startVisit,
  setChecklistItemStatus,
  addMasterChecklistItem,
  removeOwnChecklistItem,
  uploadChecklistPhoto,
  deletePhoto,
  finalizeVisit,
} from './actions';
import type { ChecklistPhoto } from '@/lib/db/schema/checklists';

export type VisitItem = {
  id: string;
  source: 'template' | 'manager' | 'master';
  position: number;
  title: string;
  description: string | null;
  required: boolean;
  status: 'pending' | 'done' | 'na';
  note: string | null;
  photos: ChecklistPhoto[];
};

type Props = {
  workLogId: string;
  status: 'planned' | 'in_progress' | 'completed';
  startedAt: string | null;
  finalizedAt: string | null;
  items: VisitItem[];
  readOnly: boolean;
};

export function VisitChecklist({
  workLogId,
  status: initialStatus,
  startedAt: _startedAt,
  finalizedAt,
  items: initialItems,
  readOnly,
}: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [items, setItems] = useState<VisitItem[]>(initialItems);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const total = items.length;
  const doneCount = items.filter((i) => i.status === 'done').length;
  const naCount = items.filter((i) => i.status === 'na').length;
  const blockingRequired = items.filter(
    (i) => i.required && i.status === 'pending',
  ).length;

  function handleStart() {
    setBusy(true);
    startTransition(async () => {
      const res = await startVisit(workLogId);
      if (res.ok) {
        setStatus('in_progress');
        toast.success('Выезд начат');
      } else {
        toast.error(res.error);
      }
      setBusy(false);
    });
  }

  function handleSetStatus(item: VisitItem, next: VisitItem['status']) {
    if (readOnly) return;
    // Optimistic
    const prev = item.status;
    setItems((arr) =>
      arr.map((i) => (i.id === item.id ? { ...i, status: next } : i)),
    );
    setPendingItemId(item.id);
    startTransition(async () => {
      const res = await setChecklistItemStatus({
        itemId: item.id,
        status: next,
        note: item.note ?? undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        setItems((arr) =>
          arr.map((i) => (i.id === item.id ? { ...i, status: prev } : i)),
        );
      } else if (status === 'planned') {
        setStatus('in_progress');
      }
      setPendingItemId(null);
    });
  }

  function handleNoteChange(itemId: string, note: string) {
    setItems((arr) => arr.map((i) => (i.id === itemId ? { ...i, note } : i)));
  }

  function handleNoteBlur(item: VisitItem) {
    if (readOnly) return;
    startTransition(async () => {
      await setChecklistItemStatus({
        itemId: item.id,
        status: item.status,
        note: item.note ?? '',
      });
    });
  }

  async function handlePhotoUpload(itemId: string, file: File) {
    if (readOnly) return;
    setPendingItemId(itemId);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await uploadChecklistPhoto(itemId, form);
      if (res.ok) {
        setItems((arr) =>
          arr.map((i) =>
            i.id === itemId ? { ...i, photos: [...i.photos, res.data.photo] } : i,
          ),
        );
        toast.success('Фото загружено');
      } else {
        toast.error(res.error);
      }
    } catch (err) {
      toast.error('Не удалось загрузить: ' + (err as Error).message);
    }
    setPendingItemId(null);
  }

  function handlePhotoDelete(itemId: string, photoPath: string) {
    if (readOnly) return;
    if (!confirm('Удалить это фото?')) return;
    startTransition(async () => {
      const res = await deletePhoto(itemId, photoPath);
      if (res.ok) {
        setItems((arr) =>
          arr.map((i) =>
            i.id === itemId
              ? { ...i, photos: i.photos.filter((p) => p.path !== photoPath) }
              : i,
          ),
        );
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleAddItem() {
    if (readOnly) return;
    const title = newItemTitle.trim();
    if (title.length < 2) {
      toast.error('Минимум 2 символа');
      return;
    }
    setBusy(true);
    startTransition(async () => {
      const res = await addMasterChecklistItem({ workLogId, title });
      if (res.ok) {
        setItems((arr) => [
          ...arr,
          {
            id: res.data.id,
            source: 'master',
            position: arr.length,
            title,
            description: null,
            required: false,
            status: 'pending',
            note: null,
            photos: [],
          },
        ]);
        setNewItemTitle('');
      } else {
        toast.error(res.error);
      }
      setBusy(false);
    });
  }

  function handleRemoveOwn(item: VisitItem) {
    if (readOnly) return;
    if (item.source !== 'master') return;
    if (!confirm(`Удалить пункт «${item.title}»?`)) return;
    startTransition(async () => {
      const res = await removeOwnChecklistItem(item.id);
      if (res.ok) {
        setItems((arr) => arr.filter((i) => i.id !== item.id));
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleFinalize() {
    if (readOnly) return;
    if (!confirm('Завершить выезд? После этого править нельзя.')) return;
    setBusy(true);
    startTransition(async () => {
      const res = await finalizeVisit(workLogId);
      if (res.ok) {
        toast.success('Выезд завершён');
        setStatus('completed');
      } else {
        toast.error(res.error);
      }
      setBusy(false);
    });
  }

  return (
    // pb-24 lg:pb-0 — резерв снизу под fixed-кнопку «Завершить выезд» (только на mobile,
    // на desktop кнопка в обычном потоке). Без этого последний пункт чек-листа
    // и поле «Свой пункт» закрываются кнопкой при скролле.
    <div className={`space-y-3 ${!readOnly ? 'pb-24 lg:pb-0' : ''}`}>
      {/* Status header */}
      {status === 'planned' && !readOnly && (
        <CyberpunkCard
          variant="default"
          hoverEffect={false}
          className="p-4 bg-amber-50 border-amber-200"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-amber-900">
              Выезд запланирован. Нажми «Начать», как приедешь.
            </div>
            <CyberpunkButton size="sm" onClick={handleStart} disabled={busy}>
              <Play className="w-3 h-3 mr-1" />
              Начать
            </CyberpunkButton>
          </div>
        </CyberpunkCard>
      )}

      {readOnly && (
        <CyberpunkCard
          variant="default"
          hoverEffect={false}
          className="p-4 bg-emerald-50 border-emerald-200"
        >
          <div className="flex items-center gap-2 text-sm text-emerald-900">
            <CheckCircle2 className="w-4 h-4" />
            Выезд завершён{' '}
            {finalizedAt && new Date(finalizedAt).toLocaleString('ru-RU')}. Редактирование закрыто.
          </div>
        </CyberpunkCard>
      )}

      {/* Прогресс */}
      {total > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-neon-orange transition-all"
              style={{
                width: `${total === 0 ? 0 : ((doneCount + naCount) / total) * 100}%`,
              }}
            />
          </div>
          <span className="text-xs font-orbitron text-content-muted">
            {doneCount}/{total}
            {naCount > 0 && ` (${naCount} N/A)`}
          </span>
        </div>
      )}

      {/* Чеклист */}
      <h2 className="text-base font-orbitron font-semibold uppercase tracking-wider text-content-primary pt-2">
        Чек-лист
      </h2>

      {items.length === 0 ? (
        <CyberpunkCard variant="default" hoverEffect={false} className="p-4">
          <p className="text-sm text-content-muted text-center">
            Для этого выезда нет шаблона чек-листа. Можешь добавить пункты сам ниже.
          </p>
        </CyberpunkCard>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              readOnly={readOnly}
              busy={pendingItemId === item.id}
              onSetStatus={handleSetStatus}
              onNoteChange={handleNoteChange}
              onNoteBlur={handleNoteBlur}
              onPhotoUpload={handlePhotoUpload}
              onPhotoDelete={handlePhotoDelete}
              onRemoveOwn={handleRemoveOwn}
            />
          ))}
        </ul>
      )}

      {/* Добавить свой пункт */}
      {!readOnly && (
        <div className="flex items-center gap-2 pt-2">
          <input
            type="text"
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            placeholder="Свой пункт — например, ''Обнаружил очаг под раковиной''"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-neon-orange focus:outline-none"
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddItem();
              }
            }}
          />
          <button
            type="button"
            onClick={handleAddItem}
            disabled={busy || newItemTitle.trim().length < 2}
            className="px-3 py-2 text-sm bg-neon-orange/10 text-neon-orange rounded-lg hover:bg-neon-orange/20 disabled:opacity-50 inline-flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Кнопка завершить (sticky внизу) */}
      {!readOnly && (
        <div className="fixed bottom-3 left-3 right-3 lg:relative lg:bottom-auto lg:left-auto lg:right-auto lg:pt-4 z-30">
          <CyberpunkButton
            type="button"
            onClick={handleFinalize}
            disabled={busy || blockingRequired > 0}
            className="w-full lg:w-auto shadow-2xl lg:shadow-none"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Flag className="w-4 h-4 mr-1" />
            )}
            Завершить выезд
            {blockingRequired > 0 && (
              <span className="ml-2 text-xs opacity-70">
                ({blockingRequired} обяз. пунктов осталось)
              </span>
            )}
          </CyberpunkButton>
        </div>
      )}
    </div>
  );
}

function ChecklistItemRow({
  item,
  readOnly,
  busy,
  onSetStatus,
  onNoteChange,
  onNoteBlur,
  onPhotoUpload,
  onPhotoDelete,
  onRemoveOwn,
}: {
  item: VisitItem;
  readOnly: boolean;
  busy: boolean;
  onSetStatus: (item: VisitItem, status: VisitItem['status']) => void;
  onNoteChange: (itemId: string, note: string) => void;
  onNoteBlur: (item: VisitItem) => void;
  onPhotoUpload: (itemId: string, file: File) => void;
  onPhotoDelete: (itemId: string, photoPath: string) => void;
  onRemoveOwn: (item: VisitItem) => void;
}) {
  const [showNote, setShowNote] = useState(!!item.note);
  const fileRef = useRef<HTMLInputElement>(null);

  function statusBtn(target: VisitItem['status'], Icon: React.ComponentType<{ className?: string }>) {
    const active = item.status === target;
    const cls =
      target === 'done'
        ? active
          ? 'bg-emerald-500 text-white border-emerald-500'
          : 'border-gray-300 text-content-muted hover:bg-emerald-50 hover:border-emerald-300'
        : target === 'na'
          ? active
            ? 'bg-gray-500 text-white border-gray-500'
            : 'border-gray-300 text-content-muted hover:bg-gray-100'
          : active
            ? 'bg-amber-100 text-amber-700 border-amber-300'
            : 'border-gray-300 text-content-muted';
    return (
      <button
        type="button"
        disabled={readOnly}
        onClick={() => onSetStatus(item, target)}
        className={`p-2 border rounded-lg transition-colors touch-manipulation ${cls} disabled:opacity-50`}
        aria-label={target}
      >
        <Icon className="w-4 h-4" />
      </button>
    );
  }

  return (
    <li
      className={`border border-gray-200 rounded-lg p-3 bg-white transition-opacity ${busy ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-content-primary">
            {item.title}
            {item.required && (
              <span className="text-[10px] ml-1.5 px-1 py-px rounded bg-red-50 text-red-600 border border-red-100 align-middle">
                обяз.
              </span>
            )}
            {item.source === 'master' && (
              <button
                type="button"
                onClick={() => onRemoveOwn(item)}
                disabled={readOnly}
                className="text-[10px] ml-1.5 text-content-muted hover:text-red-500 align-middle"
                aria-label="Удалить свой пункт"
              >
                <Trash2 className="w-3 h-3 inline" />
              </button>
            )}
          </div>
          {item.description && (
            <div className="text-xs text-content-muted mt-1 leading-snug">
              {item.description}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {statusBtn('done', Check)}
          {statusBtn('na', Minus)}
          {item.status !== 'pending' &&
            !readOnly &&
            statusBtn('pending', Circle)}
        </div>
      </div>

      {/* Note */}
      {!readOnly && !showNote && !item.note && (
        <button
          type="button"
          onClick={() => setShowNote(true)}
          className="text-xs text-content-muted hover:text-neon-orange mt-2"
        >
          + Добавить заметку
        </button>
      )}

      {(showNote || item.note) && (
        <textarea
          value={item.note ?? ''}
          onChange={(e) => onNoteChange(item.id, e.target.value)}
          onBlur={() => onNoteBlur(item)}
          placeholder="Заметка по этому пункту"
          rows={2}
          disabled={readOnly}
          className="mt-2 w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:border-neon-orange focus:outline-none"
        />
      )}

      {/* Photos */}
      <div className="mt-2 flex flex-wrap gap-2">
        {item.photos.map((p) => (
          <div
            key={p.path}
            className="relative w-16 h-16 sm:w-20 sm:h-20 rounded overflow-hidden border border-gray-200 group"
          >
            <img
              src={`/api/storage/${encodeURI(p.path)}`}
              alt="фото"
              className="w-full h-full object-cover"
            />
            {!readOnly && (
              <button
                type="button"
                onClick={() => onPhotoDelete(item.id, p.path)}
                className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Удалить фото"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        {!readOnly && item.photos.length < 5 && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-dashed border-gray-200 rounded flex items-center justify-center text-content-muted hover:border-neon-orange hover:text-neon-orange"
            aria-label="Прикрепить фото"
          >
            <Camera className="w-5 h-5" />
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              onPhotoUpload(item.id, f);
              e.target.value = '';
            }
          }}
        />
      </div>
    </li>
  );
}
