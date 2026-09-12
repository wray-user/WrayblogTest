/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from 'react';
import styles from './ProfileCenter.module.css';

const emptyForm = {
  username: '',
  nickname: '',
  avatarUrl: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const roleText = {
  admin: '管理员',
  user: '普通账号',
};

const DEFAULT_AVATAR_URL = '/logo/嘟嘟.svg';

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

const ProfileCenter = () => {
  const fileInputRef = useRef(null);
  const [user, setUser] = useState(getStoredUser);
  const [form, setForm] = useState(() => {
    const storedUser = getStoredUser();

    return {
      ...emptyForm,
      username: storedUser.username || '',
      nickname: storedUser.nickname || '',
      avatarUrl: storedUser.avatarUrl || '',
    };
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const displayName = form.nickname || form.username || '个人中心';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const updateForm = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const syncUser = (nextUser) => {
    setUser(nextUser);
    localStorage.setItem('user', JSON.stringify(nextUser));
    window.dispatchEvent(new Event('profile-updated'));
  };

  const fetchProfile = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/profile', {
        headers: getAuthHeaders(),
      });
      const data = await readJson(res);

      if (!res.ok) {
        throw new Error(data.message || '读取个人资料失败');
      }

      const nextUser = data.user || {};
      syncUser(nextUser);
      setForm((current) => ({
        ...current,
        username: nextUser.username || '',
        nickname: nextUser.nickname || '',
        avatarUrl: nextUser.avatarUrl || '',
      }));
    } catch (fetchError) {
      setError(fetchError.message || '读取个人资料失败');
    } finally {
      setLoading(false);
    }
  };

  const uploadAvatar = async (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    setAvatarUploading(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/images', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });
      const data = await readJson(res);

      if (!res.ok || !data.url) {
        throw new Error(data.message || '头像上传失败');
      }

      updateForm('avatarUrl', data.url);
      syncUser({
        ...user,
        avatarUrl: data.url,
      });
      setMessage('头像已上传，保存资料后生效');
    } catch (uploadError) {
      setError(uploadError.message || '头像上传失败');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarPaste = (event) => {
    const file = Array.from(event.clipboardData?.items || [])
      .find((item) => item.kind === 'file' && item.type.startsWith('image/'))
      ?.getAsFile();

    if (!file) return;

    event.preventDefault();
    uploadAvatar(file);
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      if (form.newPassword && form.newPassword !== form.confirmPassword) {
        throw new Error('两次输入的新密码不一致');
      }

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          username: form.username,
          nickname: form.nickname,
          avatarUrl: form.avatarUrl,
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      const data = await readJson(res);

      if (!res.ok) {
        throw new Error(data.message || '保存个人资料失败');
      }

      if (data.token) {
        localStorage.setItem('token', data.token);
      }

      if (data.user) {
        syncUser(data.user);
      }

      setForm((current) => ({
        ...current,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
      setMessage('个人资料已保存');
    } catch (saveError) {
      setError(saveError.message || '保存个人资料失败');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return (
    <section className={styles.page}>
      <aside className={styles.profileCard}>
        <div
          className={styles.avatarBlock}
          onPaste={handleAvatarPaste}
          tabIndex={0}
          role="group"
          aria-label="头像上传区域"
        >
          <img
            className={styles.avatarPreview}
            src={form.avatarUrl || DEFAULT_AVATAR_URL}
            alt={displayName}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(event) => {
              uploadAvatar(event.target.files?.[0]);
              event.target.value = '';
            }}
          />

          <div className={styles.avatarActions}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading || loading}
            >
              {avatarUploading ? '上传中...' : '本地上传'}
            </button>
            <button
              type="button"
              onClick={() => updateForm('avatarUrl', '')}
              disabled={avatarUploading || !form.avatarUrl}
            >
              清除头像
            </button>
          </div>
          <span className={styles.pasteHint}>也可以复制图片后点这里直接粘贴</span>
        </div>

        <div className={styles.identity}>
          <h2>{displayName}</h2>
          <span>@{form.username || 'username'}</span>
        </div>
        <span className={styles.roleTag}>{roleText[user.role] || '普通账号'}</span>
      </aside>

      <main className={styles.formPanel}>
        <header className={styles.formHeader}>
          <div>
            <h2>个人中心</h2>
          </div>
        </header>

        <form className={styles.form} onSubmit={saveProfile}>
          {message && <div className={styles.message}>{message}</div>}
          {error && <div className={`${styles.message} ${styles.error}`}>{error}</div>}

          <section className={styles.section}>
            <h3>基础资料</h3>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span>昵称</span>
                <input
                  type="text"
                  value={form.nickname}
                  onChange={(event) => updateForm('nickname', event.target.value)}
                  placeholder="例如：Wray"
                  disabled={loading}
                />
              </label>
              <label className={styles.field}>
                <span>账户名</span>
                <input
                  type="text"
                  value={form.username}
                  onChange={(event) => updateForm('username', event.target.value)}
                  placeholder="用于登录"
                  disabled={loading}
                  required
                />
              </label>
            </div>
          </section>

          <section className={styles.section}>
            <h3>修改密码</h3>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span>当前密码</span>
                <input
                  type="password"
                  value={form.currentPassword}
                  onChange={(event) => updateForm('currentPassword', event.target.value)}
                  placeholder="改密码时必填"
                  disabled={loading}
                />
              </label>
              <label className={styles.field}>
                <span>新密码</span>
                <input
                  type="password"
                  value={form.newPassword}
                  onChange={(event) => updateForm('newPassword', event.target.value)}
                  placeholder="至少 6 位"
                  disabled={loading}
                />
              </label>
              <label className={styles.field}>
                <span>确认新密码</span>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(event) => updateForm('confirmPassword', event.target.value)}
                  placeholder="再次输入新密码"
                  disabled={loading}
                />
              </label>
            </div>
          </section>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={fetchProfile}
              disabled={loading || saving}
            >
              重置
            </button>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={loading || saving || avatarUploading}
            >
              {saving ? '保存中...' : '保存资料'}
            </button>
          </div>
        </form>
      </main>
    </section>
  );
};

export default ProfileCenter;
