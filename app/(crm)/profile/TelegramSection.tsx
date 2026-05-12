'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Send, Link as LinkIcon, Unlink, Copy, ExternalLink, Check } from 'lucide-react';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { generateTelegramLinkToken, unlinkTelegram } from './actions';

function formatLinkedAt(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatExpiresIn(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'истекла';
  const min = Math.floor(ms / 60_000);
  return `действует ${min} мин`;
}

export function TelegramSection({
  isLinked,
  telegramUsername,
  linkedAt,
  pendingDeepLink,
  pendingExpiresAt,
}: {
  isLinked: boolean;
  telegramUsername: string | null;
  linkedAt: string | null;
  pendingDeepLink: string | null;
  pendingExpiresAt: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function handleGenerate() {
    startTransition(async () => {
      const res = await generateTelegramLinkToken();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Ссылка готова — открой её и нажми Start в боте');
      router.refresh();
    });
  }

  function handleUnlink() {
    if (!confirm('Отвязать Telegram? После этого уведомления уйдут на email.')) return;
    startTransition(async () => {
      const res = await unlinkTelegram();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Telegram отвязан');
      router.refresh();
    });
  }

  async function handleCopy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Не получилось скопировать — выдели и скопируй вручную');
    }
  }

  // ─── UI: уже привязан ──────────────────────────────────────
  if (isLinked) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Send className="w-4 h-4 text-poison-green" />
          <span className="text-content-primary">
            Привязан
            {telegramUsername && (
              <>
                {' '}как{' '}
                <span className="font-mono text-poison-green">@{telegramUsername}</span>
              </>
            )}
          </span>
          {linkedAt && (
            <span className="text-content-muted text-xs">· с {formatLinkedAt(linkedAt)}</span>
          )}
        </div>

        <button
          onClick={handleUnlink}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-3 py-2 text-sm text-content-secondary border border-border/40 rounded hover:bg-bg-card/40 hover:text-red-600 disabled:opacity-50"
        >
          <Unlink className="w-4 h-4" />
          Отвязать
        </button>
      </div>
    );
  }

  // ─── UI: не привязан, есть свежий токен (pending deep-link) ──
  if (pendingDeepLink) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-content-secondary">
          1. Открой ссылку ниже в Telegram. 2. В боте нажми{' '}
          <kbd className="px-1.5 py-0.5 text-xs bg-bg-secondary rounded border border-border/40 font-mono">
            START
          </kbd>
          .
        </div>

        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 text-xs bg-bg-secondary rounded border border-border/40 font-mono break-all">
            {pendingDeepLink}
          </code>
          <button
            onClick={() => handleCopy(pendingDeepLink)}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm text-content-secondary border border-border/40 rounded hover:bg-bg-card/40"
            title="Скопировать"
          >
            {copied ? <Check className="w-4 h-4 text-poison-green" /> : <Copy className="w-4 h-4" />}
          </button>
          <a
            href={pendingDeepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-poison-green/10 text-poison-green border border-poison-green/40 rounded hover:bg-poison-green/20"
            title="Открыть в Telegram"
          >
            <ExternalLink className="w-4 h-4" />
            Открыть
          </a>
        </div>

        {pendingExpiresAt && (
          <p className="text-xs text-content-muted">
            Ссылка одноразовая, {formatExpiresIn(pendingExpiresAt)}.
          </p>
        )}

        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="text-xs text-content-muted hover:text-content-primary underline disabled:opacity-50"
        >
          {isPending ? 'Генерирую…' : 'Сгенерировать новую ссылку'}
        </button>
      </div>
    );
  }

  // ─── UI: не привязан, нет токена ─────────────────────────────
  return (
    <div className="space-y-3">
      <p className="text-sm text-content-muted">
        Не привязан. Сейчас уведомления приходят только на email.
      </p>
      <CyberpunkButton variant="primary" onClick={handleGenerate} disabled={isPending}>
        <LinkIcon className="w-4 h-4 mr-1" />
        {isPending ? 'Генерирую…' : 'Привязать Telegram'}
      </CyberpunkButton>
    </div>
  );
}
