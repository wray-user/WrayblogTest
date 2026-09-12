import { NavLink, Outlet } from 'react-router-dom';
import styles from './BlogWrite.module.css';

const categories = [
  {label: '技术分享',href: '/admin/write/tech',},
  {label: '心情随笔',href: '/admin/write/note',},
  {label: '学习记录', href: '/admin/write/study',},
];

const BlogWrite = () => {
  return (
    <section className={styles.layout}>
      <div className={styles.categories}>
        {categories.map((item) => (
          <NavLink 
            key={item.href}   
            to={item.href} 
            className={({isActive}) =>
              `${styles.category} ${isActive ? styles.categoryActive : ''}`
            }
            >
            <span className={styles.cateBody}>{item.label}</span>
          </NavLink>
        ))}
      </div>
      <div className={styles.gap}>
        
      </div>
      <div className={styles.main}>
        <Outlet/>
      </div>
    </section>
  );
};

export default BlogWrite;
