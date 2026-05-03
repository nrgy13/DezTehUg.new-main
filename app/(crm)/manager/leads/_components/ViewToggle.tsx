import Link from 'next/link';
import { List, LayoutGrid } from 'lucide-react';

export function ViewToggle({ current }: { current: 'list' | 'board' }) {
  return (
    <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
      <Link
        href="/manager/leads"
        className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-orbitron uppercase tracking-wider transition-colors ${
          current === 'list'
            ? 'bg-neon-orange text-white'
            : 'text-content-secondary hover:bg-gray-50 hover:text-neon-orange'
        }`}
      >
        <List className="w-3.5 h-3.5" />
        Список
      </Link>
      <Link
        href="/manager/leads/board"
        className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-orbitron uppercase tracking-wider border-l border-gray-200 transition-colors ${
          current === 'board'
            ? 'bg-neon-orange text-white'
            : 'text-content-secondary hover:bg-gray-50 hover:text-neon-orange'
        }`}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        Доска
      </Link>
    </div>
  );
}
