'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Eye, Loader2 } from 'lucide-react';

type SessionRow = { id: string; title: string | null; updated_at: string };
type Message = { role: string; content: string };

// "Ver como o cliente" — visão de suporte SOMENTE LEITURA. Não manda
// mensagem nem age como o cliente (decisão do diretor 2026-09-15: v1 é
// view-only). O banner fica sempre visível enquanto essa tela está aberta;
// "Encerrar visualização" volta pro painel do usuário. Cada sessão aberta
// grava audit_log no servidor (GET .../sessions/[sessionId]).
export function SupportViewer({ userId, userEmail }: { userId: string; userEmail: string }) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    fetch(`/api/plataforma/users/${userId}/sessions`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json() as Promise<{ sessions: SessionRow[] }>;
      })
      .then((data) => setSessions(data.sessions))
      .catch((err) => toast.error('Falha ao carregar sessões', { description: String(err) }))
      .finally(() => setLoadingSessions(false));
  }, [userId]);

  const openSession = useCallback(
    async (sessionId: string) => {
      setSelected(sessionId);
      setLoadingMessages(true);
      setMessages(null);
      try {
        const res = await fetch(`/api/plataforma/users/${userId}/sessions/${sessionId}`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as { messages: Message[] };
        setMessages(data.messages);
      } catch (err) {
        toast.error('Falha ao carregar a conversa', { description: String(err) });
      } finally {
        setLoadingMessages(false);
      }
    },
    [userId],
  );

  return (
    <div className="space-y-4 -m-8">
      {/* Banner de suporte — sempre visível nesta tela. */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-amber-500/15 border-b border-amber-500/30 px-8 py-3">
        <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
          <Eye className="h-4 w-4 shrink-0" />
          <span>
            Você está vendo a conta de <strong>{userEmail}</strong> como suporte. Só leitura — a equipe vê seu
            acesso e tudo fica na trilha de auditoria.
          </span>
        </div>
        <Link
          href={`/plataforma/usuarios/${userId}`}
          className="inline-flex items-center gap-1.5 shrink-0 rounded-full border border-amber-600/40 bg-background px-3 py-1.5 text-xs font-medium hover:bg-amber-500/10 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Encerrar visualização
        </Link>
      </div>

      <div className="flex gap-4 px-8 pb-8" style={{ minHeight: '60vh' }}>
        <div className="w-64 shrink-0 rounded-xl border border-border bg-card overflow-y-auto">
          {loadingSessions ? (
            <p className="p-3 text-xs text-muted-foreground">Carregando…</p>
          ) : sessions.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">Nenhuma conversa.</p>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => void openSession(s.id)}
                className={`block w-full text-left px-3 py-2.5 text-xs border-b border-border/60 last:border-0 hover:bg-accent transition-colors ${
                  selected === s.id ? 'bg-accent' : ''
                }`}
              >
                <div className="truncate font-medium">{s.title ?? '(sem título)'}</div>
                <div className="text-muted-foreground mt-0.5">
                  {new Date(s.updated_at).toLocaleString('pt-BR')}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="flex-1 rounded-xl border border-border bg-card p-4 overflow-y-auto">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Selecione uma conversa à esquerda.</p>
          ) : loadingMessages ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : !messages || messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem mensagens nessa conversa.</p>
          ) : (
            <div className="space-y-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap max-w-[85%] ${
                    m.role === 'user'
                      ? 'ml-auto bg-brand/10 text-foreground'
                      : 'bg-muted/50 text-foreground'
                  }`}
                >
                  {m.content}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
