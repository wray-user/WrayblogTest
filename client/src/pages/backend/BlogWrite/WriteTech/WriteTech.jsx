/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Edit from '../../../../components/Edit/Edit';
import styles from './WriteTech.module.css';

const defaultMeta = {
  category: '',
  postType: 'note',
  access: 'public',
  summary: '',
  coverImageUrl: '',
};

const postTypeOptions = [
  { value: 'note', label: '笔记' },
  { value: 'question', label: '问题' },
];

const accessOptions = [
  { value: 'public', label: '公开' },
  { value: 'login', label: '登录可见' },
  { value: 'private', label: '仅自己' },
];

const pad = (value) => String(value).padStart(2, '0');

const formatDateTimeLocal = (date) => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
);

const nextMinute = () => {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setMinutes(date.getMinutes() + 1);
  return formatDateTimeLocal(date);
};

const stripContent = (value) => (
  String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[[^\]]+\]\([^)]+\)/g, ' ')
    .replace(/[#>*_`~-]+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

const WriteTech = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const postIdFromUrl = searchParams.get('post') || '';

  const coverInputRef = useRef(null);
  const toastTimerRef = useRef(null);

  const [currentPostId, setCurrentPostId] = useState(postIdFromUrl);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [meta, setMeta] = useState(defaultMeta);
  const [draft, setDraft] = useState({ title: '', content: '' });
  const [externalDraft, setExternalDraft] = useState(null);
  const [externalDraftKey, setExternalDraftKey] = useState('');
  const [clearSignal, setClearSignal] = useState(0);
  const [scheduledAt, setScheduledAt] = useState('');
  const [scheduleMin, setScheduleMin] = useState(() => nextMinute());
  const [loading, setLoading] = useState(false);
  const [savingAction, setSavingAction] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const selectedCategory = useMemo(
    () => categories.find((item) => item.name === meta.category),
    [categories, meta.category]
  );

  const coverPreview = meta.coverImageUrl || selectedCategory?.imageUrl || '';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const updateMeta = (key, value) => {
    setMeta((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const showToast = (text) => {
    window.clearTimeout(toastTimerRef.current);
    setToastMessage(text);

    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage('');
    }, 1500);
  };

  const resetWriteForm = () => {
    setCurrentPostId('');
    setDraft({ title: '', content: '' });
    setMeta({ ...defaultMeta });
    setSelectedTags([]);
    setScheduledAt('');
    setMessage('草稿已保存');
    setExternalDraft({ title: '', content: '' });
    setExternalDraftKey(`empty:${Date.now()}`);
    setClearSignal((value) => value + 1);
    navigate('/admin/write/tech', { replace: true });
  };

  const fetchOptions = async () => {
    setLoading(true);
    setMessage('');

    try {
      const [categoryRes, tagRes] = await Promise.all([
        fetch('/api/category-tags', { headers: getAuthHeaders() }),
        fetch('/api/tags', { headers: getAuthHeaders() }),
      ]);

      const [categoryData, tagData] = await Promise.all([
        categoryRes.json(),
        tagRes.json(),
      ]);

      if (!categoryRes.ok) {
        throw new Error(categoryData.message || '获取分类失败');
      }

      if (!tagRes.ok) {
        throw new Error(tagData.message || '获取标签失败');
      }

      const nextCategories = Array.isArray(categoryData.tags) ? categoryData.tags : [];
      const nextTags = Array.isArray(tagData.tags) ? tagData.tags : [];

      setCategories(nextCategories);
      setTags(nextTags);
      setMeta((current) => ({
        ...current,
        category: current.category || nextCategories[0]?.name || '',
      }));
    } catch (error) {
      setMessage(error.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchPost = async (postId) => {
    if (!postId) return;

    setLoading(true);
    setMessage('');

    try {
      const res = await fetch(`/api/posts/${postId}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '获取文章失败');
      }

      const post = data.post || {};

      setMeta({
        category: post.category || '',
        postType: post.postType || 'note',
        access: post.access || 'public',
        summary: post.summary || '',
        coverImageUrl: post.coverImageUrl || '',
      });
      setSelectedTags(Array.isArray(post.tags) ? post.tags : []);
      setScheduledAt(post.scheduledAt ? post.scheduledAt.slice(0, 16) : '');
      setExternalDraft({
        title: post.title || '',
        content: post.content || '',
      });
      setExternalDraftKey(`${post.id || postId}:${post.updatedAt || Date.now()}`);
    } catch (error) {
      setMessage(error.message || '获取文章失败');
    } finally {
      setLoading(false);
    }
  };

  const uploadCoverImage = async (file) => {
    if (!file) return;

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
        throw new Error(data.message || '上传题图失败');
      }

      if (!data.url) {
        throw new Error('上传题图失败');
      }

      updateMeta('coverImageUrl', data.url);
      setMessage('题图已上传');
    } catch (error) {
      setMessage(error.message || '上传题图失败');
    } finally {
      setImageUploading(false);
    }
  };

  const handleCoverImagePaste = (event) => {
    const items = Array.from(event.clipboardData?.items || []);
    const imageItem = items.find(
      (item) => item.kind === 'file' && item.type.startsWith('image/')
    );
    const file = imageItem?.getAsFile();

    if (!file) return;

    event.preventDefault();
    uploadCoverImage(file);
  };

  const validateBeforeSave = (status) => {
    if (!draft.title.trim()) {
      showToast('请输入标题');
      return false;
    }

    if (!stripContent(draft.content)) {
      showToast('请输入内容');
      return false;
    }

    if (status === 'scheduled') {
      if (!scheduledAt) {
        showToast('请选择发布时间');
        return false;
      }

      const scheduledDate = new Date(scheduledAt);

      if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
        showToast('请选择未来的发布时间');
        return false;
      }
    }

    return true;
  };

  const savePost = async (status) => {
    if (!validateBeforeSave(status)) return;

    setSavingAction(status);
    setMessage('');

    try {
      const res = await fetch(currentPostId ? `/api/posts/${currentPostId}` : '/api/posts', {
        method: currentPostId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          title: draft.title.trim(),
          content: draft.content,
          category: meta.category,
          postType: meta.postType,
          access: meta.access,
          tags: selectedTags,
          status,
          summary: meta.summary,
          coverImageUrl: meta.coverImageUrl,
          scheduledAt: status === 'scheduled' ? scheduledAt : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '保存失败');
      }

      const savedPost = data.post || {};
      const nextPostId = savedPost.id || currentPostId;

      if (status === 'draft') {
        resetWriteForm();
        return;
      }

      setClearSignal((value) => value + 1);

      if (savedPost.id || nextPostId) {
        navigate(`/admin/posts?post=${savedPost.id || nextPostId}`, { replace: true });
      } else {
        navigate('/admin/posts', { replace: true });
      }
    } catch (error) {
      setMessage(error.message || '保存失败');
    } finally {
      setSavingAction('');
    }
  };

  const toggleTag = (tagName) => {
    setSelectedTags((current) => (
      current.includes(tagName)
        ? current.filter((item) => item !== tagName)
        : [...current, tagName]
    ));
  };

  const goToTagManage = () => {
    navigate('/admin/tags');
  };

  const goToCategoryManage = () => {
    navigate('/admin/categories');
  };

  const cancelWrite = () => {
    navigate('/admin/posts');
  };

  useEffect(() => {
    setCurrentPostId(postIdFromUrl);
  }, [postIdFromUrl]);

  useEffect(() => {
    fetchOptions();
  }, []);

  useEffect(() => {
    fetchPost(currentPostId);
  }, [currentPostId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setScheduleMin(nextMinute());
    }, 30000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => () => {
    window.clearTimeout(toastTimerRef.current);
  }, []);

  return (
    <div className={styles.write}>
      <div className={styles.editorArea}>
        <Edit
          onDraftChange={setDraft}
          externalDraft={externalDraft}
          externalDraftKey={externalDraftKey}
          clearSignal={clearSignal}
          onNewPost={resetWriteForm}
        />
      </div>

      {toastMessage && <div className={styles.toastMessage}>{toastMessage}</div>}

      <aside className={styles.sidebar}>
        <section className={styles.panel}>
          <label className={styles.field}>
            <span>分类</span>
            <div className={styles.categoryRow}>
              <select
                value={meta.category}
                onChange={(event) => updateMeta('category', event.target.value)}
                disabled={loading}
              >
                <option value="">请选择分类</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={styles.addButton}
                onClick={goToCategoryManage}
                title="去分类管理"
                aria-label="去分类管理"
              >
                +
              </button>
            </div>
          </label>

          <div className={styles.inlineGroup}>
            <label className={styles.field}>
              <span>Q / N</span>
              <select
                value={meta.postType}
                onChange={(event) => updateMeta('postType', event.target.value)}
              >
                {postTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.accessField}>
              <span>访问权限</span>
              {accessOptions.map((option) => (
                <label key={option.value}>
                  <input
                    type="radio"
                    name="access"
                    value={option.value}
                    checked={meta.access === option.value}
                    onChange={(event) => updateMeta('access', event.target.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.sectionTitle}>
              <span>标签</span>
              <button
                type="button"
                onClick={goToTagManage}
                title="去标签管理"
                aria-label="去标签管理"
              >
                +
              </button>
            </div>
            <div className={styles.tagList}>
              {tags.length ? (
                tags.map((tag) => {
                  const active = selectedTags.includes(tag.name);

                  return (
                    <button
                      key={tag.id}
                      type="button"
                      className={`${styles.tagItem} ${active ? styles.tagActive : ''}`}
                      onClick={() => toggleTag(tag.name)}
                      aria-pressed={active}
                    >
                      {tag.name}
                    </button>
                  );
                })
              ) : (
                <button type="button" className={styles.emptyButton} onClick={goToTagManage}>
                  去标签管理
                </button>
              )}
            </div>
          </div>
        </section>

        <section className={styles.panel}>
          <label className={styles.summaryField}>
            <span>摘要</span>
            <textarea
              value={meta.summary}
              onChange={(event) => updateMeta('summary', event.target.value)}
              placeholder="留空则自动生成"
            />
          </label>

          <div
            className={styles.coverTools}
            onPaste={handleCoverImagePaste}
            tabIndex={0}
            role="group"
            aria-label="题图上传区域"
          >
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={(event) => {
                uploadCoverImage(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={imageUploading}
            >
              {imageUploading ? '上传中...' : '上传题图'}
            </button>
            <button
              type="button"
              onClick={() => updateMeta('coverImageUrl', '')}
              disabled={imageUploading || !meta.coverImageUrl}
            >
              恢复默认题图
            </button>
            {coverPreview && <img src={coverPreview} alt="题图预览" />}
            <span className={styles.pasteHint}>可直接粘贴剪贴板图片</span>
          </div>
        </section>

        <section className={styles.actions}>
          <button
            type="button"
            onClick={() => savePost('published')}
            disabled={Boolean(savingAction)}
          >
            {savingAction === 'published' ? '发布中...' : '发布'}
          </button>
          <button
            type="button"
            onClick={() => savePost('draft')}
            disabled={Boolean(savingAction)}
          >
            {savingAction === 'draft' ? '保存中...' : '存为草稿'}
          </button>
          <label className={styles.scheduleField}>
            <input
              type="datetime-local"
              value={scheduledAt}
              min={scheduleMin}
              step="60"
              onChange={(event) => setScheduledAt(event.target.value)}
            />
            <button
              type="button"
              onClick={() => savePost('scheduled')}
              disabled={Boolean(savingAction)}
            >
              {savingAction === 'scheduled' ? '安排中...' : '定时发布'}
            </button>
          </label>
          <button type="button" onClick={cancelWrite} disabled={Boolean(savingAction)}>
            取消
          </button>
        </section>

        <p className={styles.shortcutText}>Ctrl + S 保存草稿，Ctrl + Enter 发布</p>
        {message && <div className={styles.message}>{message}</div>}
      </aside>
    </div>
  );
};

export default WriteTech;
