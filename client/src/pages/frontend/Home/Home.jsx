import styles from './Home.module.css';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../../components/Header/Header';
import ThreeEarth from '../../../components/ThreeEarth/ThreeEarth';
import Contribution from '../../../components/Contribution/Contribution';
import FormatDate from '../../../components/FormatDate/FormatDate';
import Footer from '../../../components/Footer/Footer';

const sectionTabs = ['All', '心情随笔', '技术分享', '学习记录'];

const getPostSection = (post = {}) => {
  if (post.category === '心情随笔') return 'note';
  if (post.category === '学习记录') return 'study';

  return 'tech';
};

const stripContent = (value = '') => String(value)
  .replace(/<!--[^]*?-->/g, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
  .replace(/\[[^\]]+]\([^)]+\)/g, ' ')
  .replace(/[#>*_`~|-]+/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const stripLeadingMedia = (value = '') => String(value)
  .replace(/^(?:!\[[^\]]*]\([^)]+\)\s*)+/g, '')
  .replace(/^(?:<img\b[^>]*>\s*)+/gi, '')
  .trim();

const getPostKey = (post = {}) => String(
  post.id
  || post._id
  || `${post.title || 'post'}-${post.publishedAt || post.createdAt || post.updatedAt || ''}`
);

const getPostTimestamp = (post = {}) => {
  const value = post.publishedAt || post.createdAt || post.updatedAt || 0;
  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getPostViews = (post = {}) => Number(post.viewCount || 0);

const getPostComments = (post = {}) => Number(post.commentCount || 0);

const sortByLatest = (a, b) => (
  getPostTimestamp(b) - getPostTimestamp(a)
  || getPostViews(b) - getPostViews(a)
  || getPostComments(b) - getPostComments(a)
);

const sortByHot = (a, b) => (
  getPostViews(b) - getPostViews(a)
  || getPostComments(b) - getPostComments(a)
  || getPostTimestamp(b) - getPostTimestamp(a)
);

const getRecommendedScore = (post = {}) => {
  const ageDays = Math.max(0, (Date.now() - getPostTimestamp(post)) / 86400000);
  const freshness = Math.max(0, 30 - ageDays);

  return (
    getPostViews(post) * 2
    + getPostComments(post) * 8
    + freshness * 3
  );
};

const sortByRecommended = (a, b) => (
  getRecommendedScore(b) - getRecommendedScore(a)
  || getPostViews(b) - getPostViews(a)
  || getPostTimestamp(b) - getPostTimestamp(a)
);

const pickSidebarPosts = (sortedPosts, count, excludedKeys = new Set()) => {
  const picked = [];
  const seen = new Set();

  const tryPush = (post) => {
    const key = getPostKey(post);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    picked.push(post);
    return true;
  };

  sortedPosts.forEach((post) => {
    if (picked.length >= count) {
      return;
    }

    const key = getPostKey(post);
    if (excludedKeys.has(key)) {
      return;
    }

    tryPush(post);
  });

  if (picked.length < count) {
    sortedPosts.forEach((post) => {
      if (picked.length >= count) {
        return;
      }

      tryPush(post);
    });
  }

  return picked;
};

const getSiteUptime = () => {
  const start = new Date('2026-07-08T00:00:00');
  const now = new Date();
  const totalSeconds = Math.max(0, Math.floor((now - start) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `网站运行${days}天${hours}小时${minutes}分${seconds}秒`;
};

const getExcerpt = (post) => {
  const raw = stripLeadingMedia(post.content || post.summary || '');
  const source = stripContent(raw);

  if (!source) {
    return '暂无摘要';
  }

  const excerptLimit = 72;
  const chineseRange = /[\u4e00-\u9fff]/;
  const englishWord = /^[A-Za-z0-9]+(?:'[A-Za-z0-9]+)*/;
  const parts = [];
  let index = 0;
  let tokenCount = 0;

  while (index < source.length && tokenCount < excerptLimit) {
    const char = source[index];

    if (/\s/.test(char)) {
      if (parts.length && parts[parts.length - 1] !== ' ') {
        parts.push(' ');
      }
      index += 1;
      continue;
    }

    const wordMatch = source.slice(index).match(englishWord);
    if (wordMatch) {
      const word = wordMatch[0];
      parts.push(word);
      tokenCount += 1;
      index += word.length;
      continue;
    }

    if (chineseRange.test(char)) {
      parts.push(char);
      tokenCount += 1;
      index += 1;
      continue;
    }

    parts.push(char);
    index += 1;
  }

  const excerpt = parts.join('').replace(/\s+([,.;:!?])/g, '$1').trim();
  return index < source.length ? `${excerpt}...` : excerpt;
};

const getPostHref = (post) => {
  const section = getPostSection(post);

  if (section === 'note') {
    return `/mood?post=${post.id}`;
  }

  if (section === 'study') {
    return `/study?post=${post.id}`;
  }

  return `/tech?post=${post.id}`;
};

const Hero = ({ hero }) => (
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

const SidebarSection = ({ title, posts, emptyText }) => (
  <section className={styles.sideSection}>
    <h3 className={styles.sideSectionHead}>{title}</h3>

    {posts.length ? (
      <div className={styles.sidePosts}>
        {posts.map((post) => {
          const postHref = getPostHref(post);
          const titleText = post.title || '未命名文章';

          return (
            <Link key={getPostKey(post)} to={postHref} className={styles.sidePost}>
              <strong>{titleText}</strong>
            </Link>
          );
        })}
      </div>
    ) : (
      <div className={styles.sideEmpty}>{emptyText}</div>
    )}
  </section>
);

const Profile = () => {
  const [uptime, setUptime] = useState(() => getSiteUptime());
  const stats = [
    { value: 1, label: '文章' },
    { value: 2, label: '分类' },
    { value: 3, label: '标签' },
    { value: 4, label: '评论' },
  ];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setUptime(getSiteUptime());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className={styles.profile}>
      <div className={styles.profileCard}>
        <div className={styles.avatar}>
          <img src="/logo/嘟嘟.svg" alt="站点头像" />
          <strong>Wray's Blog</strong>
          <span>{uptime}</span>
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
          <span className={styles.socialLink} aria-label="GitHub">
            <img src="/logo/github.svg" alt="" />
          </span>
          <a className={styles.socialLink} href="mailto:wray@example.com" aria-label="发送邮件">
            <img src="/logo/gmail.svg" alt="" />
          </a>
          <span className={styles.socialLink} aria-label="微信">
            <img src="/logo/微信.svg" alt="" />
          </span>
        </div>
      </div>
    </div>
  );
};

const Home = () => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return undefined;

    const style = document.createElement('style');
    style.textContent = `
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
        background: rgba(12, 34, 42, 0.92) !important;
        color: rgba(255, 255, 255, 1) !important;
        border: 1px solid rgba(187, 255, 255, 0.18) !important;
        backdrop-filter: blur(8px);
      }
    `;
    document.head.appendChild(style);

    const updateHeaderBackground = () => {
      const isTop = window.scrollY <= 0;

      header.dataset.homeTop = isTop ? 'true' : 'false';
      header.style.background = isTop
        ? 'rgba(187,255,255,0.1)'
        : 'rgba(255,255,255,1)';

      header.querySelectorAll('a').forEach((item) => {
        item.style.color = isTop
          ? 'rgba(255,255,255,0.86)'
          : 'rgba(0,0,0,0.9)';
      });

      document.querySelectorAll('#icon-search path').forEach((path) => {
        path.setAttribute('fill', isTop ? 'rgba(255,255,255,0.86)' : 'rgba(0,0,0,0.9)');
      });
    };

    updateHeaderBackground();
    window.addEventListener('scroll', updateHeaderBackground, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateHeaderBackground);
      style.remove();
      delete header.dataset.homeTop;
      header.style.background = 'rgba(255,255,255,1)';
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    const fetchPosts = async () => {
      setLoading(true);
      setError('');

      try {
        const res = await fetch('/api/posts?status=published&pageSize=50&sort=publishedDesc');
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || '获取文章失败');
        }

        if (!ignore) {
          setPosts(Array.isArray(data.posts) ? data.posts : []);
        }
      } catch (fetchError) {
        if (!ignore) {
          setPosts([]);
          setError(fetchError.message || '获取文章失败');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchPosts();

    return () => {
      ignore = true;
    };
  }, []);

  const filteredPosts = useMemo(() => {
    if (selectedCategory === 'All') {
      return posts;
    }

    const section = selectedCategory === '心情随笔'
      ? 'note'
      : selectedCategory === '学习记录'
        ? 'study'
        : 'tech';

    return posts.filter((post) => getPostSection(post) === section);
  }, [posts, selectedCategory]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / pageSize));

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const pagedPosts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPosts.slice(start, start + pageSize);
  }, [filteredPosts, currentPage]);

  const paginationPages = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const maxButtons = 5;
    let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let end = Math.min(totalPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [currentPage, totalPages]);

  const sidebarPosts = useMemo(() => {
    const safePosts = posts.filter(Boolean);
    const latestPosts = safePosts.slice().sort(sortByLatest).slice(0, 4);
    const hotPosts = safePosts.slice().sort(sortByHot).slice(0, 4);
    const excludedKeys = new Set([
      ...latestPosts,
      ...hotPosts,
    ].map(getPostKey));
    const recommendedPosts = pickSidebarPosts(
      safePosts.slice().sort(sortByRecommended),
      4,
      excludedKeys,
    );

    return {
      latestPosts,
      hotPosts,
      recommendedPosts,
    };
  }, [posts]);

  return (
    <div className={styles.home}>
      <Header />
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
            <Contribution posts={posts} />
          </div>
        </div>
      </div>

      <div className={styles.main}>
        <div className={styles.content}>
          <div className={styles.categorys}>
            {sectionTabs.map((category, index) => (
              <React.Fragment key={category}>
                <button
                  type="button"
                  className={`${styles.category} ${selectedCategory === category ? styles.categoryActive : ''}`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>

                {index < sectionTabs.length - 1 && (
                  <span className={styles.categoryDivider}>|</span>
                )}
              </React.Fragment>
            ))}
          </div>

          {loading ? (
            <div className={styles.emptyState}>正在读取数据库文章...</div>
          ) : error ? (
            <div className={styles.emptyState}>{error}</div>
          ) : pagedPosts.length ? (
            <div className={styles.posts}>
              {pagedPosts.map((post) => {
                const postHref = getPostHref(post);
                const authorName = post.author?.nickname || post.author?.username || 'Wray';
                const wordCount = Array.from(stripContent(post.content || post.summary || '')).length;

                return (
                  <article key={post.id} className={styles.post}>
                    <div className={styles.postBody}>
                      <div className={styles.postTitle}>
                        <h2>
                          <Link to={postHref}>{post.title || '未命名文章'}</Link>
                        </h2>
                      </div>

                      <div className={styles.postMain}>
                        <Link to={postHref}>
                          <img
                            className={styles.postCover}
                            src={post.coverImageUrl || '/img/star.jpg'}
                            alt={post.title || '文章封面'}
                          />
                        </Link>

                        <p className={styles.postExcerpt}>{getExcerpt(post)}</p>
                      </div>

                      <div className={styles.postMeta}>
                        <span className={styles.author}>
                          <span className={styles.authorAvatar}>
                            <img
                              src={post.author?.avatarUrl || '/logo/嘟嘟.svg'}
                              alt={authorName}
                            />
                          </span>
                          <span className={styles.authorName}>
                            {authorName}
                          </span>
                        </span>

                        <div className={styles.mateWord}>
                          <span>{FormatDate(post.publishedAt || post.createdAt || new Date())}</span>
                          <span className={styles.wordSum}>
                            <span>{wordCount} 字</span>
                          </span>
                        </div>

                        <div className={styles.postStats}>
                          <span className={styles.postStatLink}>
                            <svg aria-hidden="true">
                              <use href="#icon-31pinglun" />
                            </svg>
                            <span>{post.commentCount || 0}</span>
                          </span>

                          <span className={styles.postStatLink}>
                            <svg aria-hidden="true">
                              <use href="#icon-icon" />
                            </svg>
                            <span>{post.viewCount || 0}</span>
                          </span>

                          <span className={styles.postStatLink}>
                            <svg aria-hidden="true">
                              <use href="#icon-chakan" />
                            </svg>
                            <span>{post.viewCount || 0}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>暂无文章</div>
          )}

          {!loading && !error && posts.length > pageSize && (
            <div className={styles.paginationDock}>
              <div className={styles.pagination}>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                >
                  上一页
                </button>

                {paginationPages[0] > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(1)}
                    >
                      1
                    </button>
                    {paginationPages[0] > 2 && <span className={styles.paginationEllipsis}>...</span>}
                  </>
                )}

                {paginationPages.map((page) => (
                  <button
                    type="button"
                    key={page}
                    className={page === currentPage ? styles.paginationActive : ''}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}

                {paginationPages[paginationPages.length - 1] < totalPages && (
                  <>
                    {paginationPages[paginationPages.length - 1] < totalPages - 1 && (
                      <span className={styles.paginationEllipsis}>...</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setCurrentPage(totalPages)}
                    >
                      {totalPages}
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className={styles.aside}>
          <Profile />
          <SidebarSection
            title="最新文章"
            posts={sidebarPosts.latestPosts}
            emptyText="暂无最新文章"
          />
          <SidebarSection
            title="最热文章"
            posts={sidebarPosts.hotPosts}
            emptyText="暂无热门文章"
          />
          <SidebarSection
            title="推荐文章"
            posts={sidebarPosts.recommendedPosts}
            emptyText="暂无推荐文章"
          />
        </aside>
      </div>

      <Footer />
    </div>
  );
};

export default Home;
