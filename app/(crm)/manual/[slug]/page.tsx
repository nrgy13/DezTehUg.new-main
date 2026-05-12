import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { requireAuth } from '@/lib/auth/helpers';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { BookOpen, ChevronLeft } from 'lucide-react';
import {
  loadManualPage,
  getManualPagesForRole,
  MANUAL_PAGES,
  type ManualSlug,
} from '@/lib/manual/loader';

export const metadata = { title: 'Инструкция — ДезТехЮг CRM' };
export const dynamic = 'force-dynamic';

export default async function ManualPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireAuth();
  const { slug } = await params;

  // Валидация slug
  if (!MANUAL_PAGES.some((p) => p.slug === slug)) notFound();

  // Доступ — соответствие ролей
  const allowedPages = getManualPagesForRole(user.role);
  if (!allowedPages.some((p) => p.slug === slug)) notFound();

  const content = await loadManualPage(slug as ManualSlug);
  if (!content) notFound();

  const currentMeta = MANUAL_PAGES.find((p) => p.slug === slug)!;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 flex-wrap">
        <BookOpen className="w-7 h-7 text-poison-green flex-shrink-0" />
        <div className="flex-1">
          <h1 className="text-2xl font-orbitron font-bold tracking-wide text-content-primary uppercase">
            Инструкция · {currentMeta.title}
          </h1>
          <p className="text-content-muted text-sm mt-1">
            Документация по работе с CRM. Markdown-источник: <code className="font-mono text-xs bg-bg-secondary px-1 rounded">docs/manual/{currentMeta.file}</code>
          </p>
        </div>
      </div>

      {/* Навигация между разделами */}
      <CyberpunkCard variant="default" hoverEffect={false} className="p-3">
        <div className="flex flex-wrap gap-2">
          {allowedPages.map((p) => (
            <Link
              key={p.slug}
              href={`/manual/${p.slug}`}
              className={`px-3 py-1.5 text-xs font-orbitron uppercase tracking-wider rounded border transition-colors ${
                p.slug === slug
                  ? 'bg-neon-orange text-white border-neon-orange'
                  : 'bg-bg-secondary text-content-secondary border-border/40 hover:bg-bg-card hover:text-content-primary'
              }`}
            >
              {p.title}
            </Link>
          ))}
        </div>
      </CyberpunkCard>

      {/* Контент методички */}
      <CyberpunkCard variant="default" hoverEffect={false} className="p-6 sm:p-8">
        <div className="manual-content prose prose-sm max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="text-2xl font-orbitron font-bold uppercase tracking-wide text-content-primary mt-2 mb-4 border-b border-gray-200 pb-3">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-xl font-orbitron font-semibold uppercase tracking-wider text-content-primary mt-8 mb-3 border-b border-gray-100 pb-2">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-base font-orbitron font-semibold uppercase tracking-wider text-content-primary mt-6 mb-2">
                  {children}
                </h3>
              ),
              h4: ({ children }) => (
                <h4 className="text-sm font-orbitron font-semibold uppercase tracking-wider text-content-secondary mt-4 mb-2">
                  {children}
                </h4>
              ),
              p: ({ children }) => (
                <p className="text-sm text-content-primary leading-relaxed mb-3">{children}</p>
              ),
              ul: ({ children }) => (
                <ul className="list-disc pl-6 text-sm text-content-primary space-y-1 mb-4">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal pl-6 text-sm text-content-primary space-y-1 mb-4">
                  {children}
                </ol>
              ),
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-poison-green/60 bg-poison-green/5 pl-4 py-2 my-3 text-sm text-content-secondary italic">
                  {children}
                </blockquote>
              ),
              code: ({ children, ...props }) => {
                // inline code (no className) vs block (with className like "language-bash")
                const isInline = !(props as { className?: string }).className;
                if (isInline) {
                  return (
                    <code className="bg-bg-secondary px-1.5 py-0.5 text-xs font-mono text-neon-orange rounded">
                      {children}
                    </code>
                  );
                }
                return (
                  <code className="block bg-bg-secondary p-3 text-xs font-mono text-content-primary rounded overflow-x-auto">
                    {children}
                  </code>
                );
              },
              pre: ({ children }) => (
                <pre className="bg-bg-secondary p-4 rounded text-xs font-mono overflow-x-auto my-3 border border-border/40">
                  {children}
                </pre>
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto my-4">
                  <table className="w-full text-xs border-collapse">{children}</table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-bg-secondary border-b border-gray-200">{children}</thead>
              ),
              th: ({ children }) => (
                <th className="text-left px-3 py-2 text-[10px] uppercase font-orbitron tracking-wider text-content-muted border border-gray-200">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-3 py-2 text-sm text-content-primary border border-gray-100 align-top">
                  {children}
                </td>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  className="text-poison-green hover:underline"
                  target={href?.startsWith('http') ? '_blank' : undefined}
                  rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                >
                  {children}
                </a>
              ),
              img: ({ src, alt }) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={typeof src === 'string' ? src : ''}
                  alt={alt ?? ''}
                  className="my-4 rounded-lg border border-gray-200 shadow-sm max-w-full"
                  loading="lazy"
                />
              ),
              hr: () => <hr className="my-6 border-gray-200" />,
              strong: ({ children }) => (
                <strong className="font-semibold text-content-primary">{children}</strong>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </CyberpunkCard>

      <div>
        <Link
          href="/manual"
          className="inline-flex items-center gap-1 text-xs text-content-muted hover:text-content-primary"
        >
          <ChevronLeft className="w-3 h-3" />К списку методичек
        </Link>
      </div>
    </div>
  );
}
