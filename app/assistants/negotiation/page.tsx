import { Suspense } from 'react';
import { NegotiationAssistant } from '@/components/assistants/NegotiationAssistant';

export const dynamic = 'force-dynamic';

export default function NegotiationAssistantPage() {
  return (
    <Suspense fallback={null}>
      <NegotiationAssistant />
    </Suspense>
  );
}
