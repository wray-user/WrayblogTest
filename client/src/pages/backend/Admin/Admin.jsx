import { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import styles from './Admin.module.css';

const navItems = [
  { label: '后台首页', href: '/admin/home', icon: 'icon-icon_857' },
  { label: '文章撰写', href: '/admin/write', icon: 'icon-Agent_wenzhangzhuanxie' },
  { label: '分享管理', href: '/admin/posts', icon: 'icon-fenxiangguanli' },
  { label: '学习管理', href: '/admin/studies', icon: 'icon-xuexiguanli' },
  { label: '随笔管理', href: '/admin/note', icon: 'icon-icon-suibi' },
  { label: '分类管理', href: '/admin/categories', icon: 'icon-01_hangyefenleiguanli' },
  { label: '标签管理', href: '/admin/tags', icon: 'icon-24gf-tags3' },
  { label: '评论管理', href: '/admin/comments', icon: 'icon-pinglun' },
  { label: '用户管理', href: '/admin/users', icon: 'icon-yonghu' },
  { label: '个人中心', href: '/admin/profile', icon: 'icon-geren' },
];

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

const Admin = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const location = useLocation();
  const [user, setUser] = useState(getStoredUser);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const syncStoredUser = () => {
    setUser(getStoredUser());
  };

  useEffect(() => {
    if (!token) return;

    let ignore = false;

    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await readJson(res);

        if (!ignore && res.ok && data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
          setUser(data.user);
        }
      } catch {
        syncStoredUser();
      }
    };

    fetchProfile();

    return () => {
      ignore = true;
    };
  }, [token]);

  useEffect(() => {
    window.addEventListener('profile-updated', syncStoredUser);

    return () => {
      window.removeEventListener('profile-updated', syncStoredUser);
    };
  }, []);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const currentItem = navItems.find((item) =>
    location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
  );

  const pageTitle = currentItem?.label || '博客后台管理系统';
  const displayName = user.nickname || user.username || '我的后台';
  const visibleNavItems = navItems.filter((item) => (
    item.href !== '/admin/users' || user.role === 'admin'
  ));

  return (
    <main className={styles.page}>
      <aside className={styles.sidebar}>
        <button type="button" className={styles.userCard} onClick={() => navigate('/admin/profile')}>
          <img src={user.avatarUrl || DEFAULT_AVATAR_URL} alt={displayName} />
          <strong>{displayName}</strong>
        </button>

        <nav className={styles.menu}>
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                `${styles.menuItem} ${isActive ? styles.active : ''}`
              }
            >
              <span className={styles.menuIcon} aria-hidden="true">
                <svg>
                  <use href={`#${item.icon}`} />
                </svg>
              </span>
              <span className={styles.menuLabel}>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <section className={styles.main}>
        <header className={styles.header}>
          <button type="button" className={styles.collapseButton}>|||</button>
          <h1>{pageTitle}</h1>
          <button type="button" className={styles.logoutButton} onClick={logout}>
            退出登录
          </button>
        </header>

        <div className={styles.content}>
          <Outlet />
        </div>
      </section>
    </main>
  );
};

export default Admin;
