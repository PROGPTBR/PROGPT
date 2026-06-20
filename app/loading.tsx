import { PageLoader } from '@/components/ui/PageLoader';

export default function Loading() {
  return (
    <div className="bg-background">
      <PageLoader fullScreen />
    </div>
  );
}
