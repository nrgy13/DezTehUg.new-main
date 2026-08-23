'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Кнопка «Поделиться» для сгенерированного документа.
 *
 * ЗАЧЕМ. Кнопки DOCX/PDF — это обычные ссылки на файл. На iPhone система их не
 * «скачивает», а открывает во встроенном просмотрщике; если CRM запущена с иконки
 * на рабочем столе (standalone PWA), у просмотрщика нет панели Safari, поэтому
 * кнопку «поделиться» взять физически негде — документ с телефона не отправить.
 * Здесь мы сами дёргаем системное окно «Поделиться» (Web Share API level 2),
 * оно работает и в standalone-режиме.
 *
 * ГРАБЛЯ iOS. Safari требует, чтобы navigator.share() вызывался в том же
 * пользовательском жесте. Файл сначала надо забрать с сервера (await fetch), и
 * после этого жест может «протухнуть» → share() кидает ошибку. Поэтому здесь
 * двухтактный откат: первый тап готовит файл и взводит кнопку, второй —
 * отправляет уже готовый File СИНХРОННО в свежем жесте. Где браузер не
 * придирается (Android Chrome, часть версий Safari) — уходит с первого тапа.
 */

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Достаём имя файла из Content-Disposition (сервер отдаёт RFC 5987 filename*). */
function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      /* битая последовательность — идём к обычному filename */
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() || null;
}

/** Имя файла не должно содержать разделителей пути. */
function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'document';
}

export function ShareDocumentButton({
  documentId,
  label,
  hasPdf,
  hasDocx,
  className,
}: {
  documentId: string;
  /** Человеческое имя документа — уходит в заголовок системного окна. */
  label: string;
  hasPdf: boolean;
  hasDocx: boolean;
  className?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'armed'>('idle');
  const armedFileRef = useRef<File | null>(null);

  // Живая проба возможностей браузера, а не разбор userAgent: собираем
  // микро-файл нужного типа и спрашиваем систему, умеет ли она им делиться.
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
      return;
    }
    try {
      const mime = hasPdf ? 'application/pdf' : DOCX_MIME;
      const probe = new File([new Blob(['probe'], { type: mime })], `probe.${hasPdf ? 'pdf' : 'docx'}`, {
        type: mime,
      });
      setSupported(navigator.canShare({ files: [probe] }));
    } catch {
      setSupported(false);
    }
  }, [hasPdf]);

  if (!supported || (!hasPdf && !hasDocx)) return null;

  // PDF в приоритете: мессенджеры и соцсети принимают его без вопросов,
  // DOCX iOS может отказаться отдавать в share-sheet.
  const format: 'pdf' | 'docx' = hasPdf ? 'pdf' : 'docx';

  async function loadFile(): Promise<File> {
    const res = await fetch(`/api/documents/${documentId}/download?format=${format}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body?.error) detail = body.error;
      } catch {
        /* тело не JSON — оставляем код статуса */
      }
      throw new Error(detail);
    }
    const blob = await res.blob();
    const fallbackName = `${label}.${format}`;
    const name = sanitizeFilename(
      filenameFromDisposition(res.headers.get('content-disposition')) ?? fallbackName,
    );
    return new File([blob], name, {
      type: blob.type || (format === 'pdf' ? 'application/pdf' : DOCX_MIME),
    });
  }

  /** Последний рубеж: если поделиться нечем — хотя бы отдать файл на скачивание. */
  function fallbackDownload() {
    const a = document.createElement('a');
    a.href = `/api/documents/${documentId}/download?format=${format}`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function isCancel(err: unknown) {
    return err instanceof Error && err.name === 'AbortError';
  }

  async function handleClick() {
    // Второй такт: файл уже в памяти — share() уходит без единого await,
    // то есть внутри свежего жеста. Ровно то, чего требует Safari.
    const armed = armedFileRef.current;
    if (armed) {
      armedFileRef.current = null;
      setState('idle');
      try {
        await navigator.share({ files: [armed], title: label });
      } catch (err) {
        if (!isCancel(err)) {
          toast.error('Телефон не дал поделиться файлом — скачиваю');
          fallbackDownload();
        }
      }
      return;
    }

    setState('loading');
    let file: File;
    try {
      file = await loadFile();
    } catch (err) {
      setState('idle');
      toast.error(`Не удалось подготовить файл: ${err instanceof Error ? err.message : 'ошибка'}`);
      return;
    }

    if (!navigator.canShare({ files: [file] })) {
      setState('idle');
      toast.error('Телефон не умеет делиться этим типом файла — скачиваю');
      fallbackDownload();
      return;
    }

    try {
      await navigator.share({ files: [file], title: label });
      setState('idle');
    } catch (err) {
      if (isCancel(err)) {
        setState('idle');
        return;
      }
      // Жест «протух», пока тянули файл (типично для iOS). Взводим второй такт.
      armedFileRef.current = file;
      setState('armed');
      toast.info('Файл готов — нажми «Отправить»');
    }
  }

  const busy = state === 'loading';
  const text = state === 'armed' ? 'Отправить' : 'Поделиться';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      title={`Отправить документ (${format.toUpperCase()}) в мессенджер, почту или соцсеть`}
      className={
        className ??
        `inline-flex items-center gap-1 px-2 py-1 text-xs rounded border disabled:opacity-50 ${
          state === 'armed'
            ? 'border-neon-orange text-neon-orange bg-neon-orange/10'
            : 'border-cyber-blue/40 text-cyber-blue hover:bg-cyber-blue/10'
        }`
      }
    >
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Share2 className="w-3 h-3" />}
      {busy ? 'Готовлю…' : text}
    </button>
  );
}
