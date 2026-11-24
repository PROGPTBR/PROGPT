// Ponto de entrada do agendador interno (sub-projeto 101). O código de
// verdade fica em instrumentation-node.ts: este arquivo também é compilado
// para o runtime Edge, que não tem os módulos do Node, e o import precisa
// ficar DENTRO do `if` para o empacotador descartá-lo lá.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { iniciarAgendador } = await import('./instrumentation-node');
    iniciarAgendador();
  }
}
