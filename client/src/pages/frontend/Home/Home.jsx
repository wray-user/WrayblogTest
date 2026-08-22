import styles from './Home.module.css';
import React, { useEffect, useState } from 'react';
import Header from '../../../components/Header/Header';
import ThreeEarth from '../../../components/ThreeEarth/ThreeEarth';
import Contribution from '../../../components/Contribution/Contribution';
import FormatDate from '../../../components/FormatDate/FormatDate';
import Footer from '../../../components/Footer/Footer';

const categorys = ['All', '心情随笔', '技术分享', '学习记录'];
// const stats = [[]]

// Hero 
const Hero = ({ hero }) => {
  return (
    <section className={styles.hero}>
      <div className={styles.inner}>
        <div className={styles.copy}>
          <span className={styles.badge}>{hero.badge}</span>
          <h1 className={styles.title}>{hero.title}</h1>
          {hero.subtitle && <p className={styles.subtitle}>{hero.subtitle}</p>}
        </div>
      </div>
    </section>
  );
};

// profile 卡片
const Profile = ({ profile={}, posts={}, categories={}, tags={} }) => {
  const stats = [
    { value: 1, label: '文章' },
    { value: 2, label: '分类' },
    { value: 3, label: '标签' },
    { value: 4, label: '评论' },
  ];
  return (
    <div className={styles.profile}>
      <div className={styles.avatar}>
        <img src='./logo/嘟嘟.svg' alt='站点头像'/>
        <span>网站运行61天21小时21分21秒</span>
      </div>

      <div className={styles.stats}>
        {stats.map((item) => (
          <div className={styles.statItem} key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}

      </div>

      <div className={styles.social}>
        <img className={styles.socialLink} src="/logo/github.svg" alt="1" />
        <img className={styles.socialLink} src="/logo/gmail.svg" alt="1" />
        <img className={styles.socialLink} src="/logo/微信.svg" alt="1" />
        <img className={styles.socialLink} src="/logo/微信.svg" alt="1" />

      </div>
    </div>
  );
};



const Home = () => {

  // 设置 header 颜色变化
  useEffect(() => {
    const header = document.querySelector('header');

    const style = document.createElement('style');
    style.innerHTML = `
      header[data-home-top="true"] [class*="themeMenu"] {
        background: rgba(8, 20, 24, 0.78) !important;
        border-color: rgba(187, 255, 255, 0.18) !important;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28) !important;
        backdrop-filter: blur(10px);
      }

      header[data-home-top="true"] [class*="themeMenu"] button {
        color: rgba(255, 255, 255, 0.86) !important;
      }

      header[data-home-top="true"] [class*="themeMenu"] button:hover {
        background: rgba(187, 255, 255, 0.16) !important;
        color: rgba(255, 255, 255, 1) !important;
      }

      header[data-home-top="true"] [class*="themeMenu"] button + button {
        border-top-color: rgba(187, 255, 255, 0.16) !important;
      }

      header[data-home-top="true"] [class*="searchIcon"]::after,
      header[data-home-top="true"] [class*="loginIcon"]::after {
        background:  rgba(12, 34, 42, 0.92) !important;
        color: rgba(255, 255, 255, 1) !important;
        border: 1px solid rgba(187, 255, 255, 0.18) !important;
        backdrop-filter: blur(8px);
      }
    `;
  document.head.appendChild(style);

  const updateHeaderBackground = () => {
    if (!header) return;

    const isTop = window.scrollY <= 0;


    const navItems = header.querySelectorAll('a');
    const searchPaths = document.querySelectorAll('#icon-search path');

    header.dataset.homeTop = isTop ? 'true' : 'false';

    header.style.background = isTop
      ? 'rgba(187,255,255,0.1)'
      : 'rgba(255,255,255,1)';

    navItems.forEach((item) => {
      item.style.color = isTop
        ? 'rgba(255,255,255,0.86)'
        : 'rgba(0,0,0,0.9)';
    });

    searchPaths.forEach((path) => {
      path.setAttribute(
        'fill',
        isTop ? 'rgba(255,255,255,0.86)' : 'rgba(0,0,0,0.9)'
      );
    });

};

  updateHeaderBackground();
  window.addEventListener('scroll', updateHeaderBackground, { passive: true });

  return () => {
    window.removeEventListener('scroll', updateHeaderBackground);
    style.remove();

    if (header) {
      delete header.dataset.homeTop;
      header.style.background = 'rgba(255,255,255,1)';
    }
  };
  }, []);

  const [selectedCategory, setSelectedCategory] = useState('All');

  // 控制摘要行数
const getExcerpt = (content) => {
  const chars = Array.from(content.trim());
  const maxLength = chars.length % 130 + 8;

  if (chars.length <= maxLength) {
    return chars.join('');
  }

  return `${chars.slice(0, maxLength).join('')}...`;
};

  return (
    <div className={styles.home}>
      <Header/>
      <div className={styles.topSection}>
        <div className={styles.head}>
          <ThreeEarth />
          <Hero
            hero={{
              title: 'Wray 笔记',
              subtitle: '记录蜕变后的自己',
              badge: '首页',
            }}
          />
        </div>
        <div className={styles.contribution}>
          <div className={styles.card}>
              <Contribution />
          </div>
        </div>
      </div>
      
{/* 主要内容 */}
      <div className={styles.main}>
        <div className={styles.content}>
          <div className={styles.categorys}>
            {categorys.map((category, index) => (
              <React.Fragment key={category}>
                <button
                  type="button"
                  className={`${styles.category} ${
                    selectedCategory === category ? styles.categoryActive : ''
                  }`}

                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>

                {index < categorys.length - 1 && (
                  <span className={styles.categoryDivider}>|</span>
                )}
              </React.Fragment>
            ))}
          </div>
        
          
          <div className={styles.posts}>
            <div className={styles.post}>
             <div className={styles.postBody}>
              <div className={styles.postTitle}>
                <h2>
                  <a href="">Python简介</a>
                </h2>
              </div>
              <div className={styles.postMain}>
                <a href="">
                  <img 
                    className={styles.postCover}
                    src="./img/star.jpg" 
                    alt="文章封面" 
                  />
                </a>


                <p className={styles.postExcerpt}>
                   {getExcerpt(
                    '是开发了撒旦我得可以把但是你好则么吧发的是开发了撒旦我得可以把但是你好则么吧发的是开发了撒旦我得的范德萨看奥斯卡发生客服都是范德萨是滴飞洒理发师代理费技术地方撒是滴飞洒理发师代理费技术地方撒 啦啊开发了是滴飞洒理发师代理费技术地方撒是开发了撒旦我得可以把但是你好则么吧发的是开发了撒旦我得可以把但是你好则么吧发的是开发了撒旦我得的范德萨看奥斯卡发生客服都是范德萨是滴飞洒理发师代理费技术地方撒是滴飞洒理发师代理费技术地方撒 啦啊开发了是滴飞洒理发师代理费技术地方撒'
                   )}
                  </p>
              </div>
        
              <div className={styles.postMeta}>
                <span className={styles.author}>
                  <a href=" " className={styles.authorAvatar}>
                    <img 
                      src="./logo/嘟嘟.svg" 
                      alt="作者头像" 
                    />
                  </a>
                  <a href="" className={styles.authorName}>
                    wray
                  </a>
                   
                </span>
                <div className={styles.mateWord}> 
                  <span>
                    {FormatDate(new Date())}
                  </span> 
                  <span className={styles.wordSum}>
                    <span>
                      1213
                      字
                    </span>
                  </span>
                </div>

                <div className={styles.postStats}>
                  <a href="" className={styles.postStatLink}>
                    <svg aria-hidden="true">
                      <use href="#icon-31pinglun"></use>
                    </svg>
                    <span>0</span>
                  </a>

                  <a href="" className={styles.postStatLink}>
                    <svg aria-hidden="true">
                      <use href="#icon-icon"></use>
                    </svg>
                    <span>0</span>
                  </a>

                  <a href="" className={styles.postStatLink}>
                    <svg aria-hidden="true">
                      <use href="#icon-chakan"></use>
                    </svg>
                    <span>82</span>
                  </a>
                </div>  
                
              </div>
            </div>

          </div>
        </div>

      </div>

        <aside className={styles.aside}>
          <Profile className={styles.Profile} />
        </aside>

      </div>

      <Footer/>
    </div>



        
      


  );
};

export default Home;
