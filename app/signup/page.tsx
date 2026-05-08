import { Suspense } from 'react';
import { SignupForm } from '@/components/auth/SignupForm';

export default function SignupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </main>
  );
}
