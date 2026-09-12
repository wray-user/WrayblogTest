import { Component, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import Header from '../../../components/Header/Header';
import styles from './MoodNotes.module.css';
import '@uiw/react-markdown-preview/markdown.css';
import 'katex/dist/katex.min.css';

const NOTE_CATEGORY = '心情随笔';

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
      id: `mood-heading-${index + 1}`,
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
      heading.id = toc[index]?.id || `mood-heading-${index + 1}`;
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

const MoodNotes = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const postIdFromUrl = searchParams.get('post') || '';
  const [posts, setPosts] = useState([]);
  const [activePostId, setActivePostId] = useState('');
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (postIdFromUrl) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, [postIdFromUrl]);

  const activePost = useMemo(
    () => posts.find((post) => post.id === activePostId) || posts[0] || null,
    [posts, activePostId]
  );

  const toc = useMemo(
    () => extractToc(activePost?.content || ''),
    [activePost?.content]
  );

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
    let ignore = false;

    const fetchSelectedPost = async () => {
      if (!postIdFromUrl) return;

      setMessage('');

      try {
        const res = await fetch(`/api/public/posts/${postIdFromUrl}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || '获取文章失败');
        }

        if (ignore) return;

        const post = data.post || {};

        if (post.category !== NOTE_CATEGORY) {
          throw new Error('这篇文章不属于心情随笔');
        }

        setPosts((current) => {
          const exists = current.some((item) => item.id === post.id);
          return exists
            ? current.map((item) => (item.id === post.id ? post : item))
            : [post, ...current];
        });
        setActivePostId(post.id || postIdFromUrl);
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
    let ignore = false;

    const fetchPosts = async () => {
      const params = new URLSearchParams({
        category: NOTE_CATEGORY,
        status: 'published',
        sort: 'manual',
        pageSize: '100',
      });

      setLoadingPosts(true);
      setMessage('');

      try {
        const res = await fetch(`/api/posts?${params.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || '获取文章失败');
        }

        if (ignore) return;

        const nextPosts = Array.isArray(data.posts) ? data.posts : [];

        setPosts((current) => {
          const extraPost = postIdFromUrl
            ? current.find((post) => post.id === postIdFromUrl && !nextPosts.some((item) => item.id === post.id))
            : null;

          return extraPost ? [extraPost, ...nextPosts] : nextPosts;
        });
        setActivePostId((current) => {
          if (postIdFromUrl && nextPosts.some((post) => post.id === postIdFromUrl)) {
            return postIdFromUrl;
          }

          return current && nextPosts.some((post) => post.id === current)
            ? current
            : nextPosts[0]?.id || '';
        });
      } catch (error) {
        if (!ignore) {
          setPosts([]);
          setActivePostId('');
          setMessage(error.message || '获取文章失败');
        }
      } finally {
        if (!ignore) {
          setLoadingPosts(false);
        }
      }
    };

    fetchPosts();

    return () => {
      ignore = true;
    };
  }, [postIdFromUrl]);

  return (
    <div className={styles.mood}>
      <Header />

      <main className={styles.page}>
        <section className={styles.moodHero}>
          <div>
            <span>Daily Notes</span>
            <h1>心情随笔</h1>
            <p>把情绪、片刻和日常写下来，慢慢看见自己的变化。</p>
          </div>
        </section>

        {message && <div className={styles.message}>{message}</div>}

        <section className={styles.contentGrid}>
          <aside className={styles.categoryCard}>
            <h2>随笔目录</h2>

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
                    href={`/mood?post=${activePost.id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      selectPost(activePost.id);
                    }}
                  >
                    {activePost.title}
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

export default MoodNotes;
