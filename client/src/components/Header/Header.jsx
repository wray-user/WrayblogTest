import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './Header.module.css';
import { Link } from 'react-router-dom';

const navItems = [
  { label: '首页', href: '/' },
  { label: '图库', href: '/image-host' },
  { label: '邮局', href: '/mail' },
  { label: '资源', href: '/resources' },
  { label: '统计', href: '/analytics' },
  { label: '监控', href: '/monitoring' },
  { label: '探针', href: '/probe' },
  { label: '关于我', href: '/about' },
  { label: '开往', href: '/travelling' },
];

const themeOptions = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

const SunIcon = () => (
  <svg className="light" aria-hidden="true">
    <use href="#icon-taiyang1"></use>
  </svg>
  
);

const MoonIcon = () => (
  <svg className="dark" aria-hidden="true">
    <use href="#icon-yueliang"></use>
  </svg>
);

const SearchIcon = () => (
  <svg className={styles.search} aria-hidden="true" >
    <use href="#icon-search"></use>
  </svg>
);

const LoginIcon = () => (
    <svg className="search" aria-hidden="true">
    <use href="#icon-admin"></use>
  </svg>
)

const getStoredTheme = () => {
  if (typeof window === 'undefined') {
    return 'light';
  }

const mode = window.localStorage.getItem('themeMode');
  return mode === 'dark' || mode === 'light' ? mode : 'light';
};

const Header = ({posts = [] }) => {
  const [popOpen, setPopOpen] = useState(false);
  const themeRef = useRef(null);
  const [theme, setTheme] = useState(getStoredTheme);
  const changeTheme = (mode) => {
    setTheme(mode);
    window.localStorage.setItem('themeMode', mode);
    document.documentElement.dataset.theme = mode;
  };
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a className={styles.brand} href="/" aria-label="返回首页">
          <img src="/logo/嘟嘟.svg" alt="站点头像" className={styles.logo} />
        </a>

        <nav className={styles.nav} aria-label="站点导航">
          {navItems.map((item) => (
            <a key={item.label} href={item.href} className={styles.navItem}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className={styles.actions}>
          <div className={styles.theme} 
          onMouseEnter={() => setThemeMenuOpen(true)}
          onMouseLeave={() => setThemeMenuOpen(false)}>
            <div className={styles.themeIcon}>
              {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
            </div>

            <div className={`${styles.themeMenu} ${themeMenuOpen ? styles.themeMenuOpen : ''}`}>
              <button type="button" 
              onClick={() => {changeTheme('light')
              setThemeMenuOpen(false);
              }}>
                <SunIcon />
                <span>Light</span>
              </button>

              <button type="button" 
              onClick={() => {changeTheme('dark');
              setThemeMenuOpen(false);}}>
                <MoonIcon />
                <span>Dark</span>
              </button>
            </div>
          </div>


          <button className={styles.searchIcon}>
            <SearchIcon/>
          </button>
            <Link 
              to="/login" 
              target="_blank"
              className={styles.loginIcon} 
              aria-label="登录" 
              title="登录">
              <LoginIcon />
            </Link>
        </div>
      </div>
    </header>
  );
};


export default Header;
