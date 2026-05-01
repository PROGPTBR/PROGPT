export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-4xl font-bold text-primary">ProcurementGPT</h1>
        <p className="text-lg text-muted-foreground">
          Especialista em teorias de procurement — em construção.
        </p>
        <p className="text-sm text-muted-foreground">
          Verifique a saúde dos serviços em{' '}
          <a className="underline text-primary" href="/api/health">
            /api/health
          </a>
          .
        </p>
        <footer className="pt-12 text-xs text-muted-foreground">
          Produto da{' '}
          <a
            className="underline"
            href="https://www.iagentics.com.br"
            target="_blank"
            rel="noreferrer"
          >
            IAgentics
          </a>
          .
        </footer>
      </div>
    </main>
  );
}
