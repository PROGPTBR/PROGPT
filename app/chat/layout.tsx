/** export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}*/


import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/db/supabase-server';

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

 const { data: profile } = await supabase
  .from('profiles')
  .select(
    `
    role,
    created_at,
    plan,
    selected_plan,
    subscription_status
  `
  )
  .eq('id', user.id)
  .single();


  if (!profile) {
    redirect('/login');
  }

  // Admin sempre tem acesso (mesmo sem plano/assinatura) — espelha o bypass
  // de getAccessState/isPro em lib/billing/subscription.ts.
  if (profile.role === 'admin') {
    return <>{children}</>;
  }

  // PF e PJ liberados
//const currentPlan =
  // profile.plan || profile.selected_plan;

// const paidPlan =
 // currentPlan === 'pf' ||
 // currentPlan === 'pf-99' ||
//  currentPlan === 'pj' ||
 // currentPlan === 'pj-consulte';

  
  // Assinatura ativa liberada
  //const activeSubscription =
   // profile.subscription_status === 'ACTIVE';

//  const createdAt = new Date(profile.created_at);
//  const now = new Date();

//  const diffDays =
 //   (now.getTime() - createdAt.getTime()) /
  //  (1000 * 60 * 60 * 24);

 // const trialExpired =
  //  diffDays > 3 &&
 //   !paidPlan &&
  //  !activeSubscription;


//if (trialExpired) {
 // redirect('/planos?expired=true');
//}

  return <>{children}</>;
}