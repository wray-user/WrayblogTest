/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import styles from './UserManage.module.css';

const emptyForm = {
  username: '',
  nickname: '',
  password: '',
  role: 'user',
};

const roleText = {
  admin: '管理员',
  user: '普通账号',
};

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const readJson = async (res) => {
  const text = await res.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text);
  }
};

const formatDate = (value) => {
  if (!value) return '-';

  const date = new Date(value);
  const pad = (item) => String(item).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const UserManage = () => {
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingUserId, setEditingUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isAdmin = currentUser.role === 'admin';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/profile', {
        headers: getAuthHeaders(),
      });
      const data = await readJson(res);

      if (res.ok && data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        setCurrentUser(data.user);
        return data.user;
      }
    } catch {
      return currentUser;
    }

    return currentUser;
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError('');

    try {
      const profile = await fetchCurrentUser();

      if (profile.role !== 'admin') {
        setUsers([]);
        return;
      }

      const res = await fetch('/api/users', {
        headers: getAuthHeaders(),
      });
      const data = await readJson(res);

      if (!res.ok) {
        throw new Error(data.message || '读取用户列表失败');
      }

      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (fetchError) {
      setError(fetchError.message || '读取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const updateForm = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const createUser = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch(editingUserId ? `/api/users/${editingUserId}` : '/api/users', {
        method: editingUserId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(form),
      });
      const data = await readJson(res);

      if (!res.ok) {
        throw new Error(data.message || '新增用户失败');
      }

      setForm(emptyForm);
      setEditingUserId('');
      setMessage(editingUserId ? '用户已更新' : '用户已创建');

      if (editingUserId === currentUser.id && data.token && data.user) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setCurrentUser(data.user);
      }

      await fetchUsers();
    } catch (createError) {
      setError(createError.message || '新增用户失败');
    } finally {
      setSaving(false);
    }
  };

  const editUser = (user) => {
    setEditingUserId(user.id);
    setForm({
      username: user.username || '',
      nickname: user.nickname || '',
      password: '',
      role: user.role || 'user',
    });
    setMessage('');
    setError('');
  };

  const cancelEdit = () => {
    setEditingUserId('');
    setForm(emptyForm);
    setMessage('');
    setError('');
  };

  const deleteUser = async (user) => {
    if (!window.confirm(`确认删除账号“${user.username}”吗？该账号下的文章和资源也会被删除。`)) {
      return;
    }

    setMessage('');
    setError('');

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await readJson(res);

      if (!res.ok) {
        throw new Error(data.message || '删除用户失败');
      }

      setMessage('用户已删除');
      await fetchUsers();
    } catch (deleteError) {
      setError(deleteError.message || '删除用户失败');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  if (!isAdmin) {
    return (
      <section className={styles.forbiddenPanel}>
        <div>
          <h2>用户管理</h2>
          <p>当前账号只能管理自己的文章和个人资料，用户账号由管理员统一维护。</p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.headerPanel}>
        <div>
          <h2>用户管理</h2>
        </div>
        <span className={styles.roleBadge}>当前：管理员</span>
      </div>

      <div className={styles.createPanel}>
        <h3>{editingUserId ? '编辑账号' : '新增账号'}</h3>
        <form className={styles.createForm} onSubmit={createUser}>
          <label>
            <span>账户名</span>
            <input
              type="text"
              value={form.username}
              onChange={(event) => updateForm('username', event.target.value)}
              placeholder="用于登录"
              required
            />
          </label>
          <label>
            <span>昵称</span>
            <input
              type="text"
              value={form.nickname}
              onChange={(event) => updateForm('nickname', event.target.value)}
              placeholder="显示名称"
            />
          </label>
          <label>
            <span>{editingUserId ? '新密码（可选）' : '初始密码'}</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => updateForm('password', event.target.value)}
              placeholder={editingUserId ? '留空则不修改' : '至少 6 位'}
              required={!editingUserId}
            />
          </label>
          <label>
            <span>角色</span>
            <select
              value={form.role}
              onChange={(event) => updateForm('role', event.target.value)}
            >
              <option value="user">普通账号</option>
              <option value="admin">管理员</option>
            </select>
          </label>
          <button type="submit" className={styles.primaryButton} disabled={saving}>
            {saving ? '保存中...' : editingUserId ? '保存修改' : '创建账号'}
          </button>
          {editingUserId && (
            <button type="button" className={styles.deleteButton} onClick={cancelEdit} disabled={saving}>
              取消编辑
            </button>
          )}
        </form>
      </div>

      {message && <div className={styles.message}>{message}</div>}
      {error && <div className={`${styles.message} ${styles.error}`}>{error}</div>}

      <div className={styles.listPanel}>
        <h3>账号列表</h3>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>用户</th>
              <th>角色</th>
              <th>创建时间</th>
              <th>最近更新</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className={styles.emptyCell} colSpan="5">读取中...</td>
              </tr>
            ) : users.length ? (
              users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className={styles.userCell}>
                      {user.avatarUrl ? (
                        <img className={styles.avatar} src={user.avatarUrl} alt={user.nickname || user.username} />
                      ) : (
                        <span className={styles.avatarFallback}>
                          {(user.nickname || user.username || '?').slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <div className={styles.userName}>
                        <strong>{user.nickname || user.username}</strong>
                        <span>{user.username}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.roleTag} ${user.role === 'admin' ? styles.roleAdmin : ''}`}>
                      {roleText[user.role] || user.role}
                    </span>
                  </td>
                  <td className={styles.muted}>{formatDate(user.createdAt)}</td>
                  <td className={styles.muted}>{formatDate(user.updatedAt)}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.deleteButton}
                      onClick={() => deleteUser(user)}
                      disabled={user.id === currentUser.id}
                    >
                      删除
                    </button>
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => editUser(user)}
                    >
                      编辑
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className={styles.emptyCell} colSpan="5">暂无用户</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default UserManage;
