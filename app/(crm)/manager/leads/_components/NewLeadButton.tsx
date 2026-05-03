'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { NewLeadModal } from './NewLeadModal';

export function NewLeadButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <CyberpunkButton onClick={() => setOpen(true)} variant="primary" size="sm">
        <Plus className="w-4 h-4 mr-1.5" />
        Новая заявка
      </CyberpunkButton>
      {open && <NewLeadModal onClose={() => setOpen(false)} />}
    </>
  );
}
