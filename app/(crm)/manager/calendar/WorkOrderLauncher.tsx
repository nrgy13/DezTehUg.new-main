'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { WorkOrderDialog } from '@/components/crm/WorkOrderDialog';
import type { WorkOrderFormData } from './work-order-actions';

/** Кнопка «Заказ-наряд» в шапке календаря → открывает форму наряда (без preset). */
export function WorkOrderLauncher({ data }: { data: WorkOrderFormData }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <CyberpunkButton variant="primary" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 mr-1" />
        Заказ-наряд
      </CyberpunkButton>
      {open && <WorkOrderDialog data={data} onClose={() => setOpen(false)} />}
    </>
  );
}
