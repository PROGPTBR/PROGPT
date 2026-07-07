type SignupStepperProps = {
  step: number;
};

export default function SignupStepper({ step }: SignupStepperProps) {
  return (
    <div className="mb-10">

      <p className="text-lg text-brand font-medium">
        Etapa {step} de 4
      </p>

      <h1 className="mt-2 text-3xl font-bold">
        Crie sua conta <span className="text-brand">.</span>
      </h1>

      <p className="mt-2 text-muted-foreground">
        Comece seu teste gratuito em menos de 2 minutos.
      </p>

      <div className="mt-8 flex items-center gap-3">

        <div className={`h-2 flex-1 rounded-full ${
          step >= 1
            ? "bg-brand"
            : "bg-muted"
        }`} />

        <div className={`h-2 flex-1 rounded-full ${
          step >= 2
            ? "bg-brand"
            : "bg-muted"
        }`} />

        <div className={`h-2 flex-1 rounded-full ${
          step >= 3
            ? "bg-brand"
            : "bg-muted"
        }`} />

        <div className={`h-2 flex-1 rounded-full ${
          step >= 4
            ? "bg-brand"
            : "bg-muted"
        }`} />

      </div>

    </div>
  );
}