'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export type ComboboxOption = {
  /** Стабильный уникальный идентификатор (обычно id из БД). */
  value: string;
  /** Текст, который видит пользователь в строке и в кнопке-триггере. */
  label: string;
  /**
   * Доп. слова для поиска помимо label (адрес, метка, телефон…).
   * Для cmdk это `keywords` — фильтр матчит и по ним. Передавай реальный текст:
   * value у нас = uuid, по нему ничего не найдётся, искать только по keywords/label.
   */
  keywords?: string[];
};

/**
 * Combobox = поле с выпадающим списком и ПОИСКОМ ПО ПОДСТРОКЕ (cmdk + Popover).
 * Замена нативного <select> там, где список длинный и нужен фильтр (клиенты, объекты).
 *
 * Почему не нативный select: браузерный type-ahead матчит по НАЧАЛУ строки опции —
 * для «ИП Иванов»/«ИП Петров» (все начинаются одинаково) поиск по фамилии бесполезен.
 *
 * Поповер рендерится в портал (поверх Dialog) — список не обрезается по overflow
 * диалога. `modal` на Popover нужен, чтобы внутри Radix Dialog работали фокус инпута
 * и клики по пунктам.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = '— выбрать —',
  searchPlaceholder = 'Поиск…',
  emptyText = 'Ничего не найдено',
  disabled,
  id,
  className,
}: {
  options: ComboboxOption[];
  value: string;
  // void | Promise<void> — onChange бывает async (напр. подгрузка дефолтов по объекту);
  // вызываем без await (fire-and-forget), тип честно это допускает.
  onChange: (value: string) => void | Promise<void>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          disabled={disabled}
          className={cn(
            'w-full mt-1 px-3 py-2 text-sm bg-bg-primary border border-gray-300 rounded-md flex items-center justify-between gap-2 text-left focus:border-neon-orange focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
            className,
          )}
        >
          <span className={cn('truncate', !selected && 'text-content-muted')}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="w-4 h-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList id={listId}>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {options.map((opt) => (
              <CommandItem
                key={opt.value}
                value={opt.value}
                // value у нас = uuid (для уникальности), поиск по нему не идёт.
                // Кладём в keywords и label, и доп. слова → набор НИКОГДА не пуст
                // (иначе cmdk фильтровал бы только по uuid и ничего не находил),
                // а раздельные части (имя/метка/адрес) дают точное ранжирование.
                keywords={[opt.label, ...(opt.keywords ?? [])]}
                // onSelect через замыкание, а НЕ через value-параметр cmdk:
                // cmdk нормализует переданный value в lowercase, что сломало бы поиск
                // объекта по id. Берём opt.value напрямую.
                onSelect={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4 shrink-0',
                    value === opt.value ? 'opacity-100 text-neon-orange' : 'opacity-0',
                  )}
                />
                <span className="truncate">{opt.label}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
