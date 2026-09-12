/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './CategoryManage.module.css';

const emptyForm = {
  id: '',
  name: '',
  imageUrl: '',
};

const fallbackImage =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22180%22 viewBox=%220 0 320 180%22%3E%3Cdefs%3E%3ClinearGradient id=%22g%22 x1=%220%22 y1=%220%22 x2=%221%22 y2=%221%22%3E%3Cstop stop-color=%22%23409eff%22/%3E%3Cstop offset=%221%22 stop-color=%22%237c3aed%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%22320%22 height=%22180%22 fill=%22url(%23g)%22/%3E%3Ccircle cx=%22255%22 cy=%2235%22 r=%2256%22 fill=%22%23ffffff%22 opacity=%22.18%22/%3E%3Ccircle cx=%2262%22 cy=%22148%22 r=%2274%22 fill=%22%23ffffff%22 opacity=%22.12%22/%3E%3Cpath d=%22M96 72h94c7.7 0 14 6.3 14 14v8c0 4.2-1.9 8.2-5.2 10.9l-55 45.1a14 14 0 0 1-17.8 0l-55-45.1A14 14 0 0 1 66 94v-8c0-7.7 6.3-14 14-14h16Z%22 fill=%22%23fff%22 opacity=%22.92%22/%3E%3Ccircle cx=%2295%22 cy=%2294%22 r=%229%22 fill=%22%23409eff%22/%3E%3C/svg%3E';
const STUDY_CATEGORY = '学习记录';
const NOTE_CATEGORY = '心情随笔';

const getPostManagePath = (post) => {
  if (post.category === STUDY_CATEGORY) return '/admin/studies';
  if (post.category === NOTE_CATEGORY) return '/admin/note';
  return '/admin/posts';
};

const CategoryManage = () => {
  const navigate = useNavigate();
  const imageInputRef = useRef(null);
  const [tags, setTags] = useState([]);
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [message, setMessage] = useState('');

  const isEditing = Boolean(form.id);
  const previewImage = useMemo(
    () => form.imageUrl.trim() || fallbackImage,
    [form.imageUrl]
  );

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');

    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchTags = async () => {
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/category-tags', {
        headers: getAuthHeaders(),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '读取分类标签失败');
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
    const imageUrl = tag.imageUrl === fallbackImage ? '' : tag.imageUrl || '';

    setForm({
      id: tag.id,
      name: tag.name,
      imageUrl,
    });
    setPosts([]);
    setMessage('');
    setModalOpen(true);
    setDetailLoading(true);

    try {
      const res = await fetch(`/api/category-tags/${tag.id}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '读取分类标签详情失败');
      }

      setForm({
        id: data.tag.id,
        name: data.tag.name,
        imageUrl: data.tag.imageUrl === fallbackImage ? '' : data.tag.imageUrl || '',
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
      setMessage('请输入分类标签名称');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const res = await fetch(
        isEditing ? `/api/category-tags/${form.id}` : '/api/category-tags',
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            name,
            imageUrl: form.imageUrl.trim() || fallbackImage,
          }),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '保存分类标签失败');
      }

      setModalOpen(false);
      setPosts([]);
      setForm(emptyForm);
      await fetchTags();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const uploadTagImage = async (file) => {
    const formData = new FormData();

    formData.append('file', file);
    setImageUploading(true);
    setMessage('');

    try {
      const res = await fetch('/api/images', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '图片上传失败');
      }

      setForm((value) => ({
        ...value,
        imageUrl: data.url,
      }));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setImageUploading(false);
    }
  };

  const handleImagePaste = (event) => {
    const items = Array.from(event.clipboardData?.items || []);
    const imageItem = items.find(
      (item) => item.kind === 'file' && item.type.startsWith('image/')
    );
    const file = imageItem?.getAsFile();

    if (!file) return;

    event.preventDefault();
    uploadTagImage(file);
  };

  const handleImageFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    uploadTagImage(file);
    event.target.value = '';
  };

  const deleteTag = async (tag) => {
    if (!window.confirm(`确认删除“${tag.name}”吗？`)) return;

    setMessage('');

    try {
      const res = await fetch(`/api/category-tags/${tag.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '删除分类标签失败');
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
      {/* <div className={styles.breadcrumb}>首页 / 分类管理</div> */}

      <div className={styles.panel}>
        <div className={styles.toolbar}>
          <button type="button" className={styles.createButton} onClick={openCreateModal}>
            新建分类
          </button>
        </div>

        {message && <div className={styles.message}>{message}</div>}

        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.indexCell}></th>
              <th className={styles.imageCell}>图片</th>
              <th>分类标签名称</th>
              <th>博客数量</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className={styles.loadingCell}>读取中...</td>
              </tr>
            ) : (
              tags.map((tag, index) => (
                <tr key={tag.id}>
                  <td className={styles.indexCell}>{index + 1}</td>
                  <td className={styles.imageCell}>
                    <img src={tag.imageUrl || fallbackImage} alt={tag.name} />
                  </td>
                  <td>{tag.name}</td>
                  <td>{tag.articleCount}</td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.editButton}
                        onClick={() => openEditModal(tag)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={() => deleteTag(tag)}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className={styles.modalMask} onClick={() => setModalOpen(false)}>
          <form
            className={styles.modal}
            onSubmit={saveTag}
            onPaste={handleImagePaste}
            onClick={(event) => event.stopPropagation()}
          >
            <header className={styles.modalHeader}>
              <h3>{isEditing ? '编辑分类标签' : '新建分类标签'}</h3>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="关闭">
                ×
              </button>
            </header>

            <div className={styles.modalBody}>
              <div className={styles.editArea}>
                <label>
                  <span>默认图片</span>
                  <img className={styles.previewImage} src={previewImage} alt="默认图片" />
                </label>

                <div className={styles.imageActions}>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={imageUploading}
                  >
                    {imageUploading ? '上传中...' : '本地上传'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((value) => ({ ...value, imageUrl: '' }))}
                    disabled={imageUploading}
                  >
                    恢复默认
                  </button>
                </div>

                <label>
                  <span>图片地址</span>
                  <input
                    type="text"
                    value={form.imageUrl}
                    onChange={(event) => setForm((value) => ({ ...value, imageUrl: event.target.value }))}
                    placeholder={imageUploading ? '图片上传中...' : '请输入图片地址'}
                    disabled={imageUploading}
                  />
                </label>

                <label>
                  <span>分类标签名称</span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))}
                    placeholder="例如：web前端"
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
              <button type="submit" disabled={saving || imageUploading}>
                {saving ? '保存中...' : '保存'}
              </button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
};

export default CategoryManage;
