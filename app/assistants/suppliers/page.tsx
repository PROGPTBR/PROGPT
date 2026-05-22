import { Suspense } from 'react';
import { SuppliersAssistant } from '@/components/assistants/SuppliersAssistant';

export const dynamic = 'force-dynamic';

export default function SuppliersAssistantPage() {
  return (
    <Suspense fallback={null}>
      <SuppliersAssistant />
    </Suspense>
  );
}
