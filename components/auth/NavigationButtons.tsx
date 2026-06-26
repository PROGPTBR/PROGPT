import { Loader2 } from "lucide-react";

type NavigationButtonsProps = {
  step: number;
  loading: boolean;
  onNext: () => void;
  onBack: () => void;
};

export default function NavigationButtons({
  step,
  loading,
  onNext,
  onBack,
}: NavigationButtonsProps) {
  return (
    <div className="mt-8 flex items-center justify-between">
      <div>
        {step > 1 && (
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            ← Voltar
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={loading}
        className="w-40 inline-flex items-center justify-center gap-2 bg-brand-gradient text-black h-11 rounded-full text-sm font-semibold brand-glow hover:brightness-110 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Criando...
          </>
        ) : step === 4 ? (
          "Começar teste grátis"
        ) : (
          "Continuar →"
        )}
      </button>
    </div>
  );
}