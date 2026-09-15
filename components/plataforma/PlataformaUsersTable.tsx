'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// /plataforma/usuarios — gestão cross-org: mover usuário de org e
// conceder/revogar o flag global super_admin. Ativar/desativar login e
// reenviar reset de senha continuam em /admin/users (sub-projeto 55) — não
// duplicados aqui, já cobrem qualquer usuário independente de org.

type Org = { id: string; name: string; slug: string };

type PlataformaUser = {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'gestor';
  display_name: string | null;
  org_id: string;
  super_admin: boolean;
  active: boolean;
  org: Org | null;
};

export function PlataformaUsersTable() {
  const [users, setUsers] = useState<PlataformaUser[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/plataforma/users');
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { users: PlataformaUser[]; orgs: Org[] };
      setUsers(data.users);
      setOrgs(data.orgs);
    } catch (err) {
      toast.error('Falha ao carregar usuários', { description: String(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function assignOrg(user: PlataformaUser, orgId: string) {
    if (!orgId || orgId === user.org_id) return;
    try {
      const res = await fetch(`/api/plataforma/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      toast.success('Usuário movido de org');
      void load();
    } catch (err) {
      toast.error('Falha ao mover usuário', { description: String(err) });
    }
  }

  async function toggleSuperAdmin(user: PlataformaUser) {
    try {
      const res = await fetch(`/api/plataforma/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ superAdmin: !user.super_admin }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(
          data.error === 'cannot_revoke_self'
            ? 'Você não pode revogar seu próprio super_admin'
            : 'Falha ao atualizar',
        );
        return;
      }
      void load();
    } catch (err) {
      toast.error('Falha ao atualizar', { description: String(err) });
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuários (cross-org)</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ativar/desativar login e redefinição de senha continuam em{' '}
          <code>/admin/users</code>. Aqui: mover entre orgs e conceder/revogar{' '}
          <strong>super_admin</strong>.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-mail</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Org</TableHead>
              <TableHead>Login</TableHead>
              <TableHead>Super Admin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.email}</TableCell>
                <TableCell className="text-muted-foreground">{u.role}</TableCell>
                <TableCell>
                  <select
                    value={u.org_id}
                    onChange={(e) => assignOrg(u, e.target.value)}
                    className="rounded-md border border-input bg-background p-1.5 text-xs"
                  >
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                      u.active
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {u.active ? 'Ativo' : 'Inativo'}
                  </span>
                </TableCell>
                <TableCell>
                  <Button
                    variant={u.super_admin ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleSuperAdmin(u)}
                  >
                    {u.super_admin ? 'Revogar' : 'Conceder'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
