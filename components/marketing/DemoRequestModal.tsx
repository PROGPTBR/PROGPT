'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Loader2, ShieldCheck, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import styles from './DemoRequestModal.module.css';

type FieldErrors = Partial<Record<'name' | 'email' | 'whatsapp' | 'company', string>>;

export function DemoRequestModal({
  open,
  solution,
  onOpenChange,
  returnFocusElement,
}: {
  open: boolean;
  solution: string;
  onOpenChange: (open: boolean) => void;
  returnFocusElement?: HTMLButtonElement | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open && submitted) {
      formRef.current?.reset();
      setFieldErrors({});
      setServerError('');
      setSubmitted(false);
    }
  }, [open, submitted]);

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      window.requestAnimationFrame(() => returnFocusElement?.focus());
    }
  }

  function validate(form: HTMLFormElement): FieldErrors {
    const data = new FormData(form);
    const errors: FieldErrors = {};
    if (String(data.get('name') ?? '').trim().length < 3)
      errors.name = 'Informe seu nome completo.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(data.get('email') ?? '')))
      errors.email = 'Informe um e-mail válido.';
    const phoneDigits = String(data.get('whatsapp') ?? '').replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 15)
      errors.whatsapp = 'Informe um WhatsApp válido.';
    if (String(data.get('company') ?? '').trim().length < 2) errors.company = 'Informe a empresa.';
    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = event.currentTarget;
    const errors = validate(form);
    setFieldErrors(errors);
    setServerError('');
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      (form.elements.namedItem(firstInvalid) as HTMLElement | null)?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      const response = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, solution }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok)
        throw new Error(body?.error || 'Não foi possível enviar sua solicitação agora.');
      setSubmitted(true);
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : 'Não foi possível enviar sua solicitação agora.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const field = (name: keyof FieldErrors) => ({
    'aria-invalid': Boolean(fieldErrors[name]),
    'aria-describedby': fieldErrors[name] ? `${name}-error` : undefined,
    className: fieldErrors[name] ? styles.invalid : undefined,
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={styles.dialog}
        overlayClassName={styles.backdrop}
        showCloseButton={false}
        initialFocus={nameInputRef}
      >
        <button
          type="button"
          className={styles.close}
          onClick={() => handleOpenChange(false)}
          aria-label="Fechar solicitação de demonstração"
        >
          <X size={17} aria-hidden="true" />
        </button>

        <aside className={styles.side}>
          <span className={styles.pill}>PROGPT · uma plataforma 2BSUPPLY</span>
            <DialogTitle className={styles.title}>{solution}</DialogTitle>
          <DialogDescription className={styles.support}>
            Preencha seus dados. Nossa equipe entrará em contato para combinar o melhor horário da
            sua demonstração.
          </DialogDescription>
          <ul className={styles.benefits}>
            <li>
              <Check size={18} /> Demonstração guiada com casos reais de Compras
            </li>
            <li>
              <Check size={18} /> Análises de propostas, TCO, riscos e negociação
            </li>
            <li>
              <Check size={18} /> Conheça os assistentes adequados à sua rotina
            </li>
          </ul>
          <p className={styles.secure}>
            <ShieldCheck size={15} /> Seus dados ficam protegidos.
          </p>
        </aside>

        <div className={styles.formPanel}>
          {submitted ? (
            <div className={styles.success} role="status" aria-live="polite">
              <span className={styles.successIcon}>
                <Check size={31} />
              </span>
              <h3>Solicitação recebida!</h3>
              <p>Nossa equipe entrará em contato para agendar sua demonstração.</p>
            </div>
          ) : (
            <>
              <h3>Solicite sua demonstração</h3>
              <p>
                Solução selecionada: <strong>{solution}</strong>
              </p>
              <form ref={formRef} className={styles.form} onSubmit={handleSubmit} noValidate>
                <div className={styles.field}>
                  <label htmlFor="demo-name">
                    Nome completo <span className={styles.required}>*</span>
                  </label>
                  <input
                    ref={nameInputRef}
                    id="demo-name"
                    name="name"
                    autoComplete="name"
                    placeholder="Seu nome"
                    required
                    {...field('name')}
                  />
                  {fieldErrors.name && (
                    <span id="name-error" className={styles.error}>
                      {fieldErrors.name}
                    </span>
                  )}
                </div>
                <div className={styles.field}>
                  <label htmlFor="demo-email">
                    E-mail profissional <span className={styles.required}>*</span>
                  </label>
                  <input
                    id="demo-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="voce@empresa.com.br"
                    required
                    {...field('email')}
                  />
                  {fieldErrors.email && (
                    <span id="email-error" className={styles.error}>
                      {fieldErrors.email}
                    </span>
                  )}
                </div>
                <div className={styles.field}>
                  <label htmlFor="demo-whatsapp">
                    WhatsApp <span className={styles.required}>*</span>
                  </label>
                  <input
                    id="demo-whatsapp"
                    name="whatsapp"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="(21) 99999-9999"
                    required
                    {...field('whatsapp')}
                  />
                  {fieldErrors.whatsapp && (
                    <span id="whatsapp-error" className={styles.error}>
                      {fieldErrors.whatsapp}
                    </span>
                  )}
                </div>
                <div className={styles.field}>
                  <label htmlFor="demo-company">
                    Empresa <span className={styles.required}>*</span>
                  </label>
                  <input
                    id="demo-company"
                    name="company"
                    autoComplete="organization"
                    placeholder="Nome da empresa"
                    required
                    {...field('company')}
                  />
                  {fieldErrors.company && (
                    <span id="company-error" className={styles.error}>
                      {fieldErrors.company}
                    </span>
                  )}
                </div>
                <div className={`${styles.field} ${styles.full}`}>
                  <label htmlFor="demo-role">Cargo</label>
                  <input
                    id="demo-role"
                    name="role"
                    autoComplete="organization-title"
                    placeholder="Ex.: Gerente de Compras"
                    maxLength={120}
                  />
                </div>
                <div className={`${styles.field} ${styles.full}`}>
                  <label htmlFor="demo-message">O que você gostaria de conhecer?</label>
                  <textarea
                    id="demo-message"
                    name="message"
                    placeholder="Conte rapidamente o que gostaria de ver na demonstração."
                    maxLength={2000}
                  />
                </div>
                <div className={styles.honeypot} aria-hidden="true">
                  <label htmlFor="demo-website">Site</label>
                  <input id="demo-website" name="website" tabIndex={-1} autoComplete="off" />
                </div>
                {serverError && (
                  <p className={styles.serverError} role="alert">
                    {serverError}
                  </p>
                )}
                <button className={styles.submit} type="submit" disabled={submitting}>
                  {submitting ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <ArrowRight size={17} />
                  )}
                  {submitting ? 'Enviando…' : 'Solicitar demonstração'}
                </button>
                <p className={styles.legal}>
                  Ao enviar, você concorda com o contato da equipe PROGPT sobre a demonstração.
                </p>
              </form>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
