import styles from './Footer.module.css';

const Footer = ({  }) => {
  // const siteName = siteData.profile?.name || siteData.hero?.title || 'Wray';

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p className={styles.copyright}>
          &copy; 2026 Wrayblog. All Rights Reserved.
        </p>
        <p className={styles.record}>
          <span>{'ICP备案信息：'}</span>
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">
            鄂ICP备2025167405号
          </a>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
