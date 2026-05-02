import Link from 'next/link';

export default function Landing() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md px-6 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">ProcurementGPT</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Especialista em teorias e práticas de procurement, treinado em centenas de artigos.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Entrar
        </Link>
      </div>
    </main>
  );
}
