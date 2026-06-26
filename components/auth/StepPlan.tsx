import { ShieldCheck, CheckCircle2 } from "lucide-react";

//const benefits = [
 // "Acesso imediato à IA de Strategic Sourcing",
 // "8 Assistentes especializados",
 // "Documentos e templates ilimitados",
 // "Atualizações constantes",
 // "Cancele quando quiser",
//];

export default function StepPlan() {
  return (
    <div className="space-y-8">


    {/* Benefícios */}
    <div className="rounded-xl bg-brand/5 p-5 space-y-4">

    <div className="flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-brand"/>
        <span>Acesso imediato.</span>
    </div>

    <div className="flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-brand"/>
        <span>Cancele quando quiser.</span>

    </div>

    <div className="flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-brand"/>
        <span>Cobrança somente após 3 dias.</span>

    </div>

</div>


 {/* Valores */}
 <div className="space-y-4">

  <div className="flex items-center justify-between">

    <span>Hoje</span>

    <strong>R$ 0,00</strong>

  </div>

  <div className="flex items-center justify-between">

    <span>Primeira cobrança</span>

    <strong>Após o 3º dia</strong>

  </div>

  <div className="flex items-center justify-between">

    <span>Depois</span>

    <strong>R$ 197,99/mês</strong>

  </div>

<div className="text-left text-sm text-muted-foreground leading-relaxed">
  Ao clicar em <strong>Continuar</strong>, você será direcionado para a etapa
  segura de cadastro do cartão. Nenhuma cobrança será realizada durante o
  período de teste gratuito.
</div>

</div>

    </div>
  );
}