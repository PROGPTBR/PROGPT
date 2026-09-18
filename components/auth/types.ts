export interface SignupForm {

    email: string;
    password: string;
    confirmPassword: string;

    fullName: string;
    cpf: string;
    phone: string;

    companyName: string;
    position: string;

    plan: string;

    cardNumber: string;
    cardHolder: string;
    cardExpiry: string;
    cardCvv: string;

    postalCode: string;
    addressNumber: string;
    addressComplement: string;
    street: string;
    district: string;
    city: string;
    state: string;
    turnstileToken: string | null;
    personType: "pf" | "pj";

    /** Assinatura por usuário: quantos acessos estão sendo contratados.
     *  1 = comportamento de sempre. */
    seats: number;

    /** E-mails dos usuários adicionais (opcional — nunca bloqueia). */
    seatEmails: string[];
}