'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';
import { apiError, apiSend } from '@/lib/apiClient';
import Modal from '@/components/Modal';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
}

export default function UsersManager({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'DESIGNER' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = useState<UserRow | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  function openCreate() {
    setEditingUser(null);
    setForm({ name: '', email: '', password: '', role: 'DESIGNER' });
    setError(null);
    setShowForm(true);
  }

  function openEdit(user: UserRow) {
    setEditingUser(user);
    setForm({ name: user.name, email: user.email, password: '', role: user.role });
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = editingUser
      ? await apiSend(`/api/users/${editingUser.id}`, 'PATCH', {
            name: form.name,
            role: form.role,
            ...(form.password ? { password: form.password } : {}),
        })
      : await apiSend('/api/users', 'POST', form);

    setSaving(false);

    if (!res.ok) {
      setError(await apiError(res, 'Something went wrong.'));
      return;
    }

    setShowForm(false);
    router.refresh();
  }

  async function toggleActive(user: UserRow) {
    if (user.active) {
      setDeactivateError(null);
      setPendingDeactivate(user);
      return;
    }
    await apiSend(`/api/users/${user.id}`, 'PATCH', { active: true });
    router.refresh();
  }

  async function confirmDeactivate() {
    if (!pendingDeactivate) return;
    setDeactivating(true);
    setDeactivateError(null);

    const res = await apiSend(`/api/users/${pendingDeactivate.id}`, 'PATCH', { active: false });
    setDeactivating(false);

    if (!res.ok) {
      setDeactivateError(await apiError(res, 'Failed to deactivate user.'));
      return;
    }

    setPendingDeactivate(null);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={openCreate}>
          + Add Teammate
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-taupe/30 text-sm">
          <thead className="bg-taupe/10 text-left text-xs font-medium uppercase tracking-[0.24em] text-taupe">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-taupe/20">
            {initialUsers.map((user) => (
              <tr key={user.id} className="hover:bg-taupe/5">
                <td className="px-4 py-3 font-medium text-brown">
                  {user.name} {user.id === currentUserId && <span className="text-xs text-brown/40">(you)</span>}
                </td>
                <td className="px-4 py-3 text-brown/70">{user.email}</td>
                <td className="px-4 py-3 text-brown/70">{user.role === 'ADMIN' ? 'Administrator' : 'Designer'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      user.active ? 'bg-green-100 text-green-800' : 'bg-taupe/30 text-brown/60'
                    }`}
                  >
                    {user.active ? 'Active' : 'Deactivated'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="mr-3 text-sm text-brown hover:text-gold" onClick={() => openEdit(user)}>
                    Edit
                  </button>
                  <button
                    className={`text-sm ${user.active ? 'text-red-700 hover:text-red-900' : 'text-green-700 hover:text-green-900'}`}
                    onClick={() => toggleActive(user)}
                  >
                    {user.active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal width="md" onSubmit={handleSubmit} className="space-y-4">
          <h2 className="text-lg font-medium text-brown">{editingUser ? 'Edit Teammate' : 'Add Teammate'}</h2>

          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Name</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Email</label>
            <input
              type="email"
              className="input"
              required
              disabled={!!editingUser}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">
              {editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
            </label>
            <input
              type="password"
              className="input"
              required={!editingUser}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brown">Role</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="DESIGNER">Designer</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!pendingDeactivate}
        title="Deactivate teammate?"
        message={
          deactivateError ??
          `"${pendingDeactivate?.name}" will no longer be able to sign in. You can reactivate them later.`
        }
        confirmLabel="Deactivate"
        busy={deactivating}
        onConfirm={confirmDeactivate}
        onCancel={() => setPendingDeactivate(null)}
      />
    </div>
  );
}
