/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from './BlogManage.module.css';

const STUDY_CATEGORY = '学习记录';
const NOTE_CATEGORY = '心情随笔';

const statusText = {
  draft: '未发布',
  published: '已发布',
  scheduled: '定时发布',
};

const typeText = {
  note: 'N',
  question: 'Q',
};

const BlogManage = ({
  manageName = '分享',
  fixedCategory = '',
  excludeCategories = '',
  editPath = '/admin/write/tech',
  emptyText = '暂无分享文章',
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [filters, setFilters] = useState({
    keyword: '',
    category: '',
    tag: '',
    postType: '',
    status: '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const highlightedPostId = searchParams.get('post');
  const pageStart = total ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(page * pageSize, total);
  const showPostType = !fixedCategory;
  const tableColumnCount = showPostType ? 10 : 9;
  const excludedCategoryNames = useMemo(
    () => String(excludeCategories || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    [excludeCategories]
  );
  const selectableCategories = useMemo(
    () => categories.filter((category) => !excludedCategoryNames.includes(category.name)),
    [categories, excludedCategoryNames]
  );
  const orderCategories = useMemo(
    () => (fixedCategory
      ? [{ id: fixedCategory, name: fixedCategory }]
      : selectableCategories),
    [fixedCategory, selectableCategories]
  );
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderCategory, setOrderCategory] = useState('');
  const [orderPosts, setOrderPosts] = useState([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderMessage, setOrderMessage] = useState('');
  const [dragPostId, setDragPostId] = useState('');
  const [orderFullscreen, setOrderFullscreen] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });

    Object.entries(filters).forEach(([key, value]) => {
      if (key === 'category' && fixedCategory) {
        return;
      }

      if (value) {
        params.set(key, value);
      }
    });

    if (fixedCategory) {
      params.set('category', fixedCategory);
    }

    if (excludeCategories) {
      params.set('excludeCategories', excludeCategories);
    }

    return params.toString();
  }, [excludeCategories, filters, fixedCategory, page, pageSize]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');

    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchOptions = async () => {
    try {
      const [categoryRes, tagRes] = await Promise.all([
        fetch('/api/category-tags', { headers: getAuthHeaders() }),
        fetch('/api/tags', { headers: getAuthHeaders() }),
      ]);
      const [categoryData, tagData] = await Promise.all([
        categoryRes.json(),
        tagRes.json(),
      ]);

      if (categoryRes.ok) {
        setCategories(categoryData.tags || []);
      }

      if (tagRes.ok) {
        setTags(tagData.tags || []);
      }
    } catch (error) {
      console.warn('读取分类或标签失败', error);
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch(`/api/posts?${queryString}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `读取${manageName}列表失败`);
      }

      setPosts(data.posts || []);
      setTotal(data.total || 0);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const changeFilter = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      keyword: '',
      category: fixedCategory || '',
      tag: '',
      postType: '',
      status: '',
    });
    setPage(1);
  };

  const fetchOrderPosts = async (categoryName) => {
    if (!categoryName) return;

    setOrderCategory(categoryName);
    setOrderLoading(true);
    setOrderMessage('');

    try {
      const params = new URLSearchParams({ category: categoryName });
      const res = await fetch(`/api/posts/sort-order?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '读取排序列表失败');
      }

      setOrderPosts(Array.isArray(data.posts) ? data.posts : []);
    } catch (error) {
      setOrderPosts([]);
      setOrderMessage(error.message || '读取排序列表失败');
    } finally {
      setOrderLoading(false);
    }
  };

  const openOrderModal = () => {
    setOrderOpen(true);
    setOrderFullscreen(false);
    setOrderMessage('');
    setDragPostId('');

    if (fixedCategory) {
      fetchOrderPosts(fixedCategory);
      return;
    }

    setOrderCategory('');
    setOrderPosts([]);
  };

  const closeOrderModal = () => {
    setOrderOpen(false);
    setOrderCategory('');
    setOrderPosts([]);
    setOrderMessage('');
    setDragPostId('');
    setOrderFullscreen(false);
  };

  const moveOrderPost = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;

    setOrderPosts((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const handleOrderDrop = (targetPostId) => {
    const fromIndex = orderPosts.findIndex((post) => post.id === dragPostId);
    const toIndex = orderPosts.findIndex((post) => post.id === targetPostId);

    moveOrderPost(fromIndex, toIndex);
    setDragPostId('');
  };

  const saveOrder = async () => {
    if (!orderCategory || !orderPosts.length) {
      setOrderMessage('请选择分类并排列笔记');
      return;
    }

    setOrderSaving(true);
    setOrderMessage('');

    try {
      const res = await fetch('/api/posts/sort-order', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          category: orderCategory,
          postIds: orderPosts.map((post) => post.id),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '保存排序失败');
      }

      setOrderPosts(Array.isArray(data.posts) ? data.posts : orderPosts);
      setOrderMessage('排序已保存');
      await fetchPosts();
    } catch (error) {
      setOrderMessage(error.message || '保存排序失败');
    } finally {
      setOrderSaving(false);
    }
  };

  const deletePost = async (post) => {
    if (!window.confirm(`确认删除“${post.title}”吗？`)) return;

    setMessage('');

    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '删除文章失败');
      }

      await fetchPosts();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const editPost = (post) => {
    if (post.category === STUDY_CATEGORY) {
      navigate(`/admin/write/study?post=${post.id}`);
      return;
    }

    if (post.category === NOTE_CATEGORY) {
      navigate(`/admin/write/note?post=${post.id}`);
      return;
    }

    navigate(`${editPath}?post=${post.id}`);
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return '-';

    const date = new Date(dateValue);
    const pad = (value) => String(value).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  useEffect(() => {
    fetchOptions();
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [queryString]);

  return (
    <section className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.searchBar}>
          <input
            type="text"
            value={filters.keyword}
            onChange={(event) => changeFilter('keyword', event.target.value)}
            placeholder="标题"
          />

          {!fixedCategory && (
            <select
              value={filters.category}
              onChange={(event) => changeFilter('category', event.target.value)}
            >
              <option value="">全部分类</option>
              {selectableCategories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={filters.tag}
            onChange={(event) => changeFilter('tag', event.target.value)}
          >
            <option value="">全部标签</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.name}>
                {tag.name}
              </option>
            ))}
          </select>

          {showPostType && (
            <select
              value={filters.postType}
              onChange={(event) => changeFilter('postType', event.target.value)}
            >
              <option value="">Q / N</option>
              <option value="note">N 笔记</option>
              <option value="question">Q 问题</option>
            </select>
          )}

          <select
            value={filters.status}
            onChange={(event) => changeFilter('status', event.target.value)}
          >
            <option value="">发布状态</option>
            <option value="draft">未发布</option>
            <option value="published">已发布</option>
            <option value="scheduled">定时发布</option>
          </select>

          <button type="button" className={styles.searchButton} onClick={fetchPosts}>
            搜索
          </button>
          <button type="button" className={styles.clearButton} onClick={clearFilters}>
            清除
          </button>
          {!fixedCategory && (
            <button type="button" className={styles.sortButton} onClick={openOrderModal}>
              排序
            </button>
          )}
        </div>

        {message && <div className={styles.message}>{message}</div>}

        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.titleCell}>标题</th>
              <th>分类</th>
              {showPostType && <th>Q/N</th>}
              <th>标签</th>
              <th>发布时间</th>
              <th>发布状态</th>
              <th>评论数</th>
              <th>阅读数</th>
              <th>操作</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={tableColumnCount} className={styles.emptyCell}>读取中...</td>
              </tr>
            ) : posts.length ? (
              posts.map((post) => (
                <tr
                  key={post.id}
                  className={highlightedPostId === post.id ? styles.highlightRow : ''}
                >
                  <td className={styles.titleCell}>
                    <button type="button" className={styles.titleButton} onClick={() => editPost(post)}>
                      {post.title}
                    </button>
                  </td>
                  <td>{post.category || '-'}</td>
                  {showPostType && <td>{typeText[post.postType] || '-'}</td>}
                  <td>
                    <div className={styles.tags}>
                      {(post.tags || []).length ? (
                        post.tags.map((tag) => <span key={tag}>{tag}</span>)
                      ) : (
                        <em>-</em>
                      )}
                    </div>
                  </td>
                  <td>{formatDate(post.publishedAt || post.scheduledAt || post.createdAt)}</td>
                  <td>{statusText[post.status] || post.status || '-'}</td>
                  <td>{post.commentCount || 0}</td>
                  <td>{post.viewCount || 0}</td>
                  <td>
                    <button type="button" className={styles.linkButton} onClick={() => editPost(post)}>
                      编辑
                    </button>
                  </td>
                  <td>
                    <button type="button" className={styles.linkButton} onClick={() => deletePost(post)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={tableColumnCount} className={styles.emptyCell}>{emptyText}</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className={styles.footer}>
          <span>第 {pageStart}-{pageEnd} 篇，共 {total} 篇</span>

          <div className={styles.pager}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(value - 1, 1))}
            >
              上一页
            </button>
            <strong>{page}</strong>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
            <span>/ 页</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => Math.min(value + 1, totalPages))}
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      {orderOpen && (
        <div className={styles.modalMask} role="presentation" onMouseDown={closeOrderModal}>
          <section
            className={`${styles.orderModal} ${orderFullscreen ? styles.orderModalFullscreen : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label="笔记排序"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className={styles.orderHeader}>
              <div>
                <h2>笔记排序</h2>
                <span>{orderCategory || '选择分类后排列该分类下的 N 笔记'}</span>
              </div>
              <div className={styles.orderHeaderActions}>
                <button
                  type="button"
                  onClick={() => setOrderFullscreen((current) => !current)}
                  aria-label={orderFullscreen ? '还原排序窗口' : '全屏排序窗口'}
                >
                  {orderFullscreen ? '还原' : '全屏'}
                </button>
                <button type="button" onClick={closeOrderModal} aria-label="关闭排序">
                  ×
                </button>
              </div>
            </header>

            {!fixedCategory && (
              <div className={styles.orderCategories}>
                {orderCategories.length ? orderCategories.map((category) => (
                  <button
                    type="button"
                    key={category.id}
                    className={orderCategory === category.name ? styles.orderCategoryActive : ''}
                    onClick={() => fetchOrderPosts(category.name)}
                  >
                    {category.name}
                  </button>
                )) : (
                  <span>暂无可排序分类</span>
                )}
              </div>
            )}

            {orderMessage && <div className={styles.orderMessage}>{orderMessage}</div>}

            <div className={styles.orderBody}>
              {!orderCategory ? (
                <div className={styles.orderEmpty}>请选择一个分类</div>
              ) : orderLoading ? (
                <div className={styles.orderEmpty}>读取中...</div>
              ) : orderPosts.length ? (
                <ul className={styles.orderList}>
                  {orderPosts.map((post, index) => (
                    <li
                      key={post.id}
                      className={`${styles.orderItem} ${dragPostId === post.id ? styles.orderItemDragging : ''}`}
                      draggable
                      onDragStart={(event) => {
                        setDragPostId(post.id);
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleOrderDrop(post.id)}
                      onDragEnd={() => setDragPostId('')}
                    >
                      <span className={styles.dragHandle}>?</span>
                      <strong>{index + 1}</strong>
                      <span className={styles.orderTitle}>{post.title}</span>
                      <div className={styles.orderActions}>
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveOrderPost(index, index - 1)}
                        >
                          上移
                        </button>
                        <button
                          type="button"
                          disabled={index === orderPosts.length - 1}
                          onClick={() => moveOrderPost(index, index + 1)}
                        >
                          下移
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className={styles.orderEmpty}>该分类下暂无 N 笔记</div>
              )}
            </div>

            <footer className={styles.orderFooter}>
              <button type="button" className={styles.clearButton} onClick={closeOrderModal}>
                取消
              </button>
              <button
                type="button"
                className={styles.searchButton}
                onClick={saveOrder}
                disabled={!orderCategory || !orderPosts.length || orderSaving}
              >
                {orderSaving ? '保存中...' : '保存排序'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
};

export default BlogManage;
