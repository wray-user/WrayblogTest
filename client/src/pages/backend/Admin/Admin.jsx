import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import styles from './Admin.module.css';

const navItems = [
  { label: '后台首页', href: '/admin/home' },
  { label: '文章管理', href: '/admin/posts' },
  { label: '用户管理', href: '/admin/users' },
  { label: '文章撰写', href: '/admin/write' },
  { label: '分类管理', href: '/admin/categories' },
  { label: '标签管理', href: '/admin/tags' },
  { label: '评论管理', href: '/admin/comments' },
  { label: '随笔管理', href: '/admin/notes' },
  { label: '项目管理', href: '/admin/projects' },
  { label: '个人中心', href: '/admin/profile' },
];

const Admin = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const currentItem = navItems.find((item) =>
  location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
);

const pageTitle = currentItem?.label || '博客后台管理系统';

  return (
    <main className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>博客后台</div>

        <nav className={styles.menu}>
          {navItems.map((item, index) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                `${styles.menuItem} ${isActive ? styles.active : ''}`
              }
            >
              <span className={styles.menuIcon}>{index + 1}</span>
              {item.label}
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
