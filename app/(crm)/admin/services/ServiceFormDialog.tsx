'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { NeonInput } from '@/components/cyberpunk/NeonInput';
import { createService, updateService } from './actions';
import type { Service } from '@/lib/db/schema/services';

type Mode = { kind: 'create' } | { kind: 'edit'; service: Service };

export function ServiceFormDialog({
  mode,
  open,
  onOpenChange,
}: {
  mode: Mode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEdit = mode.kind === 'edit';
  const initial = isEdit ? mode.service : null;

  const [code, setCode] = useState(initial?.code ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [shortName, setShortName] = useState(initial?.shortName ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [defaultMethod, setDefaultMethod] = useState(initial?.defaultMethod ?? '');
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const [errorField, setErrorField] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorField(null);

    const input = {
      code: code.trim(),
      name: name.trim(),
      shortName: shortName.trim(),
      description: description.trim(),
      defaultMethod: defaultMethod.trim(),
      sortOrder: Number(sortOrder) || 0,
      isActive,
    };

    startTransition(async () => {
      const res = isEdit
        ? await updateService(mode.service.id, input)
        : await createService(input);

      if (!res.ok) {
        setErrorField(res.field ?? null);
        toast.error(res.error);
        return;
      }
      toast.success(isEdit ? 'Услуга обновлена' : 'Услуга создана');
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-orbitron uppercase tracking-wide">
            {isEdit ? 'Редактирование услуги' : 'Новая услуга'}
          </DialogTitle>
          <DialogDescription>
            Каталог услуг используется как справочник в карточке сделки.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="code">Код *</Label>
            <NeonInput
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="disinsection"
              disabled={isPending}
              aria-invalid={errorField === 'code'}
              required
            />
            <p className="text-xs text-content-muted mt-1">
              Латиница нижнего регистра, цифры, _ или -. Используется в коде.
            </p>
          </div>

          <div>
            <Label htmlFor="name">Название *</Label>
            <NeonInput
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Дезинсекция (уничтожение тараканов)"
              disabled={isPending}
              aria-invalid={errorField === 'name'}
              required
            />
          </div>

          <div>
            <Label htmlFor="shortName">Короткое название</Label>
            <NeonInput
              id="shortName"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="Дезинсекция"
              disabled={isPending}
            />
          </div>

          <div>
            <Label htmlFor="defaultMethod">Способ обработки по умолчанию</Label>
            <NeonInput
              id="defaultMethod"
              value={defaultMethod}
              onChange={(e) => setDefaultMethod(e.target.value)}
              placeholder="Сухая / Точечное орошение / Туман"
              disabled={isPending}
            />
          </div>

          <div>
            <Label htmlFor="description">Описание</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPending}
              rows={3}
              className="w-full mt-1 px-3 py-2 text-sm bg-bg-primary border border-gray-300 rounded-md focus:border-neon-orange focus:outline-none"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="sortOrder">Порядок сортировки</Label>
              <NeonInput
                id="sortOrder"
                type="number"
                min={0}
                max={9999}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="flex flex-col">
              <Label htmlFor="isActive" className="mb-1">
                Активна
              </Label>
              <div className="flex items-center h-10">
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm text-content-secondary hover:text-content-primary"
              disabled={isPending}
            >
              Отмена
            </button>
            <CyberpunkButton type="submit" variant="primary" disabled={isPending}>
              {isPending ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Создать'}
            </CyberpunkButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
