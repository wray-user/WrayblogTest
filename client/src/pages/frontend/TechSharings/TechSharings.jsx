import { Component, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import Header from '../../../components/Header/Header';
import styles from './TechSharings.module.css';
import '@uiw/react-markdown-preview/markdown.css';
import 'katex/dist/katex.min.css';

const visibleCount = 18;

const typeOptions = [
  { value: 'note', label: '笔记' },
  { value: 'question', label: '问题' },
];

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const cleanHeadingText = (text) =>
  String(text || '')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const extractToc = (content = '') => {
  const entries = [];
  const lines = String(content).split(/\r?\n/);
  let inFence = false;

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (/^```/.test(trimmed)) {
      inFence = !inFence;
      return;
    }

    if (inFence) return;

    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(trimmed);
    if (!match) return;

    entries.push({
      id: `heading-${index + 1}`,
      level: match[1].length,
      line: index + 1,
      text: cleanHeadingText(match[2]),
    });
  });

  return entries;
};

const MarkdownContent = ({ content, toc }) => {
  const articleRef = useRef(null);

  useEffect(() => {
    const root = articleRef.current;
    if (!root) return;

    const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');

    headings.forEach((heading, index) => {
      heading.id = toc[index]?.id || `heading-${index + 1}`;
      heading.classList.add(styles.markdownHeading);
    });
  }, [content, toc]);

  return (
    <div ref={articleRef} className={`wmde-markdown wmde-markdown-var ${styles.markdownRoot}`}>
      <MDEditor.Markdown
        source={content}
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      />
    </div>
  );
};

class MarkdownBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.content !== this.props.content) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error) {
    console.error('Markdown render failed', error);
  }

  render() {
    const { content, toc } = this.props;

    if (this.state.hasError) {
      return <pre className={styles.markdownFallback}>{content}</pre>;
    }

    return <MarkdownContent content={content} toc={toc} />;
  }
}

const TechSharings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const postIdFromUrl = searchParams.get('post') || '';
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [activeType, setActiveType] = useState('note');
  const [posts, setPosts] = useState([]);
  const [activePostId, setActivePostId] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (postIdFromUrl) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, [postIdFromUrl]);

  const visibleCategories = useMemo(
    () => categories.slice(0, visibleCount),
    [categories]
  );

  const moreCategories = useMemo(
    () => categories.slice(visibleCount),
    [categories]
  );

  const activePost = useMemo(
    () => (activeCategory ? (posts.find((post) => post.id === activePostId) || posts[0] || null) : null),
    [activeCategory, posts, activePostId]
  );

  const toc = useMemo(
    () => extractToc(activePost?.content || ''),
    [activePost?.content]
  );

  const selectCategory = (categoryName) => {
    setActiveCategory(categoryName);
    setMoreOpen(false);
    if (postIdFromUrl) {
      setSearchParams({}, { replace: true });
    }
  };

  const selectCategoryType = (type) => {
    setActiveType(type);
    setMoreOpen(false);
    if (postIdFromUrl) {
      setSearchParams({}, { replace: true });
    }
  };

  const selectPost = (postId) => {
    if (postId) {
      setActivePostId(postId);
      setSearchParams({ post: postId }, { replace: true });
    }
  };

  const scrollToHeading = (headingId) => {
    const element = document.getElementById(headingId);

    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true);
      setMessage('');

      try {
        const res = await fetch('/api/category-tags', {
          headers: getAuthHeaders(),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || '获取分类失败');
        }

        const nextCategories = Array.isArray(data.tags) ? data.tags : [];

        setCategories(nextCategories);
        setActiveCategory((current) => {
          if (postIdFromUrl) return current || '';

          return current && nextCategories.some((category) => category.name === current)
            ? current
            : nextCategories[0]?.name || '';
        });
      } catch (error) {
        setMessage(error.message || '获取分类失败');
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, [postIdFromUrl]);

  useEffect(() => {
    if (!postIdFromUrl) return;

    let ignore = false;

    const fetchSelectedPost = async () => {
      setMessage('');

      try {
        const res = await fetch(`/api/public/posts/${postIdFromUrl}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || '获取文章失败');
        }

        if (ignore) return;

        const post = data.post || {};

        setActivePostId(post.id || postIdFromUrl);
        setActiveCategory(post.category || '');
        setActiveType(post.postType === 'question' ? 'question' : 'note');
        setMoreOpen(false);
      } catch (error) {
        if (!ignore) {
          setMessage(error.message || '获取文章失败');
        }
      }
    };

    fetchSelectedPost();

    return () => {
      ignore = true;
    };
  }, [postIdFromUrl]);

  useEffect(() => {
    if (!activeCategory) {
      return;
    }

    const fetchPosts = async () => {
      const params = new URLSearchParams({
        category: activeCategory,
        postType: activeType,
        status: 'published',
        sort: activeType === 'note' ? 'manual' : 'publishedAsc',
        pageSize: '50',
      });

      setLoadingPosts(true);
      setMessage('');

      try {
        const res = await fetch(`/api/posts?${params.toString()}`, {
          headers: getAuthHeaders(),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || '获取文章失败');
        }

        const nextPosts = Array.isArray(data.posts) ? data.posts : [];

        setPosts(nextPosts);
        setActivePostId((current) => {
          const preferredPostId = postIdFromUrl && nextPosts.some((post) => post.id === postIdFromUrl)
            ? postIdFromUrl
            : '';

          return preferredPostId
            || (current && nextPosts.some((post) => post.id === current)
              ? current
              : nextPosts[0]?.id || '');
        });
      } catch (error) {
        setPosts([]);
        setActivePostId('');
        setMessage(error.message || '获取文章失败');
      } finally {
        setLoadingPosts(false);
      }
    };

    fetchPosts();
  }, [activeCategory, activeType, postIdFromUrl]);

  return (
    <div className={styles.tech}>
      <Header />

      <main className={styles.page}>
        <section className={styles.categoryHero}>
          <div className={styles.heroTop}>
            <h1>技术分享</h1>
          </div>

          <div className={styles.categoryBar}>
            {loadingCategories ? (
              <span className={styles.stateText}>分类读取中...</span>
            ) : (
              visibleCategories.map((category) => (
                <button
                  type="button"
                  key={category.id}
                  className={`${styles.categoryPill} ${
                    activeCategory === category.name ? styles.categoryActive : ''
                  }`}
                  onClick={() => selectCategory(category.name)}
                >
                  {category.name}
                </button>
              ))
            )}

            {moreCategories.length > 0 && (
              <div className={styles.moreWrap}>
                <button
                  type="button"
                  className={`${styles.categoryPill} ${styles.moreButton}`}
                  onClick={() => setMoreOpen((value) => !value)}
                >
                  更多
                </button>

                {moreOpen && (
                  <div className={styles.morePanel}>
                    {moreCategories.map((category) => (
                      <button
                        type="button"
                        key={category.id}
                        className={`${styles.moreItem} ${
                          activeCategory === category.name ? styles.moreItemActive : ''
                        }`}
                        onClick={() => selectCategory(category.name)}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {message && <div className={styles.message}>{message}</div>}

        <section className={styles.contentGrid}>
          <aside className={styles.categoryCard}>
            <h2>{activeCategory || '暂无分类'}</h2>

            <div className={styles.typeTabs}>
              {typeOptions.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={activeType === option.value ? styles.typeActive : ''}
                  onClick={() => selectCategoryType(option.value)}
                  disabled={!activeCategory}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {loadingPosts ? (
              <div className={styles.emptyState}>文章读取中...</div>
            ) : posts.length ? (
              <div className={styles.postDirectory}>
                {posts.map((post) => {
                  const active = post.id === activePost?.id;

                  return (
                    <button
                      type="button"
                      key={post.id}
                      className={`${styles.postDirectoryItem} ${
                        active ? styles.postDirectoryActive : ''
                      }`}
                      onClick={() => selectPost(post.id)}
                    >
                      <span className={styles.postDirectoryTitle}>{post.title}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyState}>暂无文章</div>
            )}
          </aside>

          <section className={styles.articlePanel}>
            {activePost ? (
              <article className={styles.articleDetail}>
                <header className={styles.articleTitle}>
                  <a
                    href={`/tech?post=${activePost.id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      selectPost(activePost.id);
                    }}
                  >
                    {activePost?.title}
                  </a>
                </header>

                <div className={styles.articleContent}>
                  <MarkdownBoundary content={activePost.content || ''} toc={toc} />
                </div>
              </article>
            ) : (
              <div className={styles.emptyState}>暂无文章</div>
            )}
          </section>

          <aside className={styles.catalogCard}>
            <h2>本文目录</h2>

            {toc.length ? (
              <div className={styles.catalogList}>
                {toc.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`${styles.catalogItem} ${styles[`catalogLevel${item.level}`] || ''}`}
                    onClick={() => scrollToHeading(item.id)}
                  >
                    {item.text}
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.catalogEmpty}>暂无目录</div>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
};

export default TechSharings;
