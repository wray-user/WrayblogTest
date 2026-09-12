/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './TagManage.module.css';

const emptyForm = {
  id: '',
  name: '',
};
const STUDY_CATEGORY = '学习记录';
const NOTE_CATEGORY = '心情随笔';

const getPostManagePath = (post) => {
  if (post.category === STUDY_CATEGORY) return '/admin/studies';
  if (post.category === NOTE_CATEGORY) return '/admin/note';
  return '/admin/posts';
};

const TagManage = () => {
  const navigate = useNavigate();
  const [tags, setTags] = useState([]);
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const isEditing = Boolean(form.id);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');

    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchTags = async () => {
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/tags', {
        headers: getAuthHeaders(),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '读取标签失败');
      }

      setTags(data.tags || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setForm(emptyForm);
    setPosts([]);
    setMessage('');
    setModalOpen(true);
  };

  const openEditModal = async (tag) => {
    setForm({
      id: tag.id,
      name: tag.name,
    });
    setPosts([]);
    setMessage('');
    setModalOpen(true);
    setDetailLoading(true);

    try {
      const res = await fetch(`/api/tags/${tag.id}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '读取标签详情失败');
      }

      setForm({
        id: data.tag.id,
        name: data.tag.name,
      });
      setPosts(data.posts || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const saveTag = async (event) => {
    event.preventDefault();

    const name = form.name.trim();

    if (!name) {
      setMessage('请输入标签名称');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const res = await fetch(isEditing ? `/api/tags/${form.id}` : '/api/tags', {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '保存标签失败');
      }

      setModalOpen(false);
      setForm(emptyForm);
      setPosts([]);
      await fetchTags();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteTag = async (tag) => {
    if (!window.confirm(`确认删除“${tag.name}”吗？相关文章会迁入默认标签。`)) return;

    setMessage('');

    try {
      const res = await fetch(`/api/tags/${tag.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '删除标签失败');
      }

      await fetchTags();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const jumpToPost = (post) => {
    navigate(`${getPostManagePath(post)}?post=${post.id}`);
  };

  useEffect(() => {
    fetchTags();
  }, []);

  return (
    <section className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.toolbar}>
          <button type="button" className={styles.createButton} onClick={openCreateModal}>
            新建标签
          </button>
        </div>

        {message && <div className={styles.message}>{message}</div>}

        {loading ? (
          <div className={styles.loading}>读取中...</div>
        ) : (
          <div className={styles.grid}>
            {tags.map((tag) => (
              <article className={styles.card} key={tag.id}>
                <div className={styles.cardActions}>
                  <button type="button" onClick={() => openEditModal(tag)} title="编辑">
                    编辑
                  </button>
                  <button type="button" onClick={() => deleteTag(tag)} title="删除">
                    删除
                  </button>
                </div>

                <p>
                  <strong>标签名称</strong>
                  <span>{tag.name}</span>
                </p>
                <p>
                  <strong>博客数量</strong>
                  <em>{tag.articleCount}</em>
                </p>
              </article>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className={styles.modalMask} onClick={() => setModalOpen(false)}>
          <form className={styles.modal} onSubmit={saveTag} onClick={(event) => event.stopPropagation()}>
            <header className={styles.modalHeader}>
              <h3>{isEditing ? '编辑标签' : '新建标签'}</h3>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="关闭">
                ×
              </button>
            </header>

            <div className={styles.modalBody}>
              <div className={styles.editArea}>
                <label>
                  <span>标签名称</span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))}
                    placeholder="例如：JavaScript"
                    autoFocus
                  />
                </label>
              </div>

              <div className={styles.postArea}>
                <div className={styles.postHeader}>
                  <strong>关联文章</strong>
                  <span>{posts.length} 篇</span>
                </div>

                <div className={styles.postList}>
                  {detailLoading ? (
                    <div className={styles.postEmpty}>读取中...</div>
                  ) : posts.length ? (
                    posts.map((post) => (
                      <button
                        type="button"
                        key={post.id}
                        className={styles.postItem}
                        onClick={() => jumpToPost(post)}
                      >
                        <span>{post.title}</span>
                        <em>{new Date(post.updatedAt || post.createdAt).toLocaleDateString()}</em>
                      </button>
                    ))
                  ) : (
                    <div className={styles.postEmpty}>暂无关联文章</div>
                  )}
                </div>
              </div>
            </div>

            <footer className={styles.modalFooter}>
              <button type="button" onClick={() => setModalOpen(false)}>
                取消
              </button>
              <button type="submit" disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
};

export default TagManage;
