'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, KeyRound, Pencil, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CyberpunkButton } from '@/components/cyberpunk/CyberpunkButton';
import { CyberpunkCard } from '@/components/cyberpunk/CyberpunkCard';
import { NeonInput } from '@/components/cyberpunk/NeonInput';
import { createUser, updateUser, resetUserPassword } from './actions';
import { userRoleEnum, type UserRole } from '@/lib/db/schema/users';

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Администратор',
  manager: 'Менеджер',
  master: 'Мастер',
};

export type UserRow = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  passwordMustChange: boolean;
  lastLoginAt: string | null;
};

export function UsersClient({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [tempPassword, setTempPassword] = useState<{ email: string; password: string } | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-content-muted">
          Всего юзеров: {users.length} ({users.filter((u) => u.isActive).length} активных)
        </p>
        <CyberpunkButton variant="primary" onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Создать юзера
        </CyberpunkButton>
      </div>

      <CyberpunkCard variant="default" hoverEffect={false} className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary border-b border-gray-200">
            <tr className="text-xs uppercase font-orbitron tracking-wider text-content-muted">
              <th className="text-left px-4 py-3">Email / Имя</th>
              <th className="text-left px-4 py-3 w-32">Роль</th>
              <th className="text-left px-4 py-3 w-44">Последний вход</th>
              <th className="text-left px-4 py-3 w-24">Активен</th>
              <th className="text-right px-4 py-3 w-28"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className={u.isActive ? '' : 'opacity-50'}>
                <td className="px-4 py-3">
                  <div className="font-mono text-xs text-content-secondary">{u.email}</div>
                  <div className="text-content-primary">{u.fullName}</div>
                  {u.passwordMustChange && (
                    <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-cyber-blue/10 text-cyber-blue font-orbitron uppercase">
                      Сменит пароль
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-orbitron uppercase tracking-wider text-content-secondary">
                    {ROLE_LABEL[u.role]}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-content-secondary">
                  {u.lastLoginAt
                    ? new Date(u.lastLoginAt).toLocaleString('ru-RU')
                    : '—'}
                </td>
                <td className="px-4 py-3 text-xs">
                  {u.isActive ? (
                    <span className="text-poison-green">да</span>
                  ) : (
                    <span className="text-content-muted">нет</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-1">
                  <button
                    onClick={() => setEditing(u)}
                    className="p-2 text-content-muted hover:text-neon-orange"
                    aria-label="Редактировать"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <ResetPasswordButton
                    userId={u.id}
                    email={u.email}
                    onReset={(p) => setTempPassword({ email: u.email, password: p })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CyberpunkCard>

      {creating && (
        <CreateDialog
          onClose={() => setCreating(false)}
          onCreated={(email, password) => {
            setCreating(false);
            setTempPassword({ email, password });
          }}
        />
      )}
      {editing && (
        <EditDialog
          user={editing}
          isSelf={editing.id === currentUserId}
          onClose={() => setEditing(null)}
        />
      )}
      {tempPassword && (
        <PasswordDialog
          email={tempPassword.email}
          password={tempPassword.password}
          onClose={() => setTempPassword(null)}
        />
      )}
    </div>
  );
}

function ResetPasswordButton({
  userId,
  email,
  onReset,
}: {
  userId: string;
  email: string;
  onReset: (password: string) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Сбросить пароль для ${email}? Старый пароль перестанет работать.`)) return;
    startTransition(async () => {
      const res = await resetUserPassword(userId);
      if (!res.ok) toast.error(res.error);
      else {
        onReset(res.data.tempPassword);
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="p-2 text-content-muted hover:text-cyber-blue disabled:opacity-50"
      aria-label="Сбросить пароль"
      title="Сбросить пароль"
    >
      <KeyRound className="w-4 h-4" />
    </button>
  );
}

function CreateDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (email: string, tempPassword: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('manager');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createUser({ email, fullName, phone, role });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Юзер создан');
      onCreated(email.trim().toLowerCase(), res.data.tempPassword);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-orbitron uppercase tracking-wide">Новый юзер</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="u-email">Email</Label>
            <NeonInput
              id="u-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isPending}
            />
          </div>
          <div>
            <Label htmlFor="u-name">ФИО</Label>
            <NeonInput
              id="u-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={isPending}
            />
          </div>
          <div>
            <Label htmlFor="u-phone">Телефон</Label>
            <NeonInput
              id="u-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 988 ..."
              disabled={isPending}
            />
          </div>
          <div>
            <Label htmlFor="u-role">Роль</Label>
            <select
              id="u-role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              disabled={isPending}
              className="w-full mt-1 px-3 py-2 text-sm bg-bg-primary border border-gray-300 rounded-md focus:border-neon-orange focus:outline-none"
            >
              {userRoleEnum.enumValues.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-content-muted">
            После создания будет показан временный пароль. Юзер обязан сменить его при первом входе.
          </p>
          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-sm text-content-secondary hover:text-content-primary"
            >
              Отмена
            </button>
            <CyberpunkButton type="submit" variant="primary" disabled={isPending}>
              {isPending ? 'Создаём…' : 'Создать'}
            </CyberpunkButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  user,
  isSelf,
  onClose,
}: {
  user: UserRow;
  isSelf: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [role, setRole] = useState<UserRole>(user.role);
  const [isActive, setIsActive] = useState(user.isActive);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateUser(user.id, { fullName, phone, role, isActive });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Изменения сохранены');
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-orbitron uppercase tracking-wide">
            Юзер: {user.email}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="ue-name">ФИО</Label>
            <NeonInput
              id="ue-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={isPending}
            />
          </div>
          <div>
            <Label htmlFor="ue-phone">Телефон</Label>
            <NeonInput
              id="ue-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div>
            <Label htmlFor="ue-role">Роль</Label>
            <select
              id="ue-role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              disabled={isPending || isSelf}
              className="w-full mt-1 px-3 py-2 text-sm bg-bg-primary border border-gray-300 rounded-md focus:border-neon-orange focus:outline-none disabled:opacity-50"
            >
              {userRoleEnum.enumValues.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            {isSelf && <p className="text-[10px] text-content-muted mt-1">Нельзя сменить свою роль</p>}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="ue-active"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={isPending || isSelf}
            />
            <Label htmlFor="ue-active">Активен</Label>
            {isSelf && (
              <span className="text-[10px] text-content-muted">Нельзя деактивировать себя</span>
            )}
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-sm text-content-secondary hover:text-content-primary"
            >
              Отмена
            </button>
            <CyberpunkButton type="submit" variant="primary" disabled={isPending}>
              {isPending ? 'Сохранение…' : 'Сохранить'}
            </CyberpunkButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({
  email,
  password,
  onClose,
}: {
  email: string;
  password: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      toast.success('Пароль скопирован');
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-orbitron uppercase tracking-wide">
            Временный пароль
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-content-secondary">
            Передай юзеру <span className="font-mono text-content-primary">{email}</span> вручную:
          </p>
          <div className="flex items-center gap-2 p-3 bg-bg-secondary border border-neon-orange/40 rounded-lg font-mono text-lg text-neon-orange">
            <span className="flex-1 select-all">{password}</span>
            <button
              onClick={handleCopy}
              className="p-2 text-content-muted hover:text-content-primary"
              title="Скопировать"
            >
              {copied ? <Check className="w-4 h-4 text-poison-green" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-content-muted">
            Этот пароль не сохранён в открытом виде нигде, включая БД (хранится только bcrypt-хеш).
            Если потеряешь — придётся сбросить заново.
          </p>
          <p className="text-xs text-content-muted">
            При первом входе юзер обязательно сменит пароль на свой.
          </p>
        </div>
        <DialogFooter>
          <CyberpunkButton variant="primary" onClick={onClose}>
            Понятно
          </CyberpunkButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
