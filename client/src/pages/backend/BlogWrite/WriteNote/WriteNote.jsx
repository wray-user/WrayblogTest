/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Edit from '../../../../components/Edit/Edit';
import styles from '../WriteTech/WriteTech.module.css';
import noteStyles from './WriteNote.module.css';

const NOTE_CATEGORY = '心情随笔';

const defaultMeta = {
  access: 'public',
  coverImageUrl: '',
};

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

const WriteNote = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const postIdFromUrl = searchParams.get('post') || '';

  const coverInputRef = useRef(null);
  const toastTimerRef = useRef(null);

  const [currentPostId, setCurrentPostId] = useState(postIdFromUrl);
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagAddOpen, setTagAddOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [tagAdding, setTagAdding] = useState(false);
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

  const coverPreview = useMemo(() => meta.coverImageUrl || '', [meta.coverImageUrl]);

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
    navigate('/admin/write/note', { replace: true });
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
        throw new Error(data.message || '获取标签失败');
      }

      setTags(Array.isArray(data.tags) ? data.tags : []);
    } catch (error) {
      setMessage(error.message || '获取标签失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchPost = async (postId) => {
    if (!postId) {
      setExternalDraft({ title: '', content: '' });
      setExternalDraftKey(`empty:${Date.now()}`);
      setSelectedTags([]);
      setMeta({ ...defaultMeta });
      return;
    }

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

      setDraft({
        title: post.title || '',
        content: post.content || '',
      });
      setMeta({
        access: post.access || 'public',
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
        throw new Error(data.message || '上传图片失败');
      }

      if (!data.url) {
        throw new Error('上传图片失败');
      }

      updateMeta('coverImageUrl', data.url);
      setMessage('图片已上传');
    } catch (error) {
      setMessage(error.message || '上传图片失败');
    } finally {
      setImageUploading(false);
    }
  };

  const clearCoverImage = () => {
    updateMeta('coverImageUrl', '');
  };

  const handleImagePaste = (event) => {
    const items = Array.from(event.clipboardData?.items || []);
    const imageItem = items.find(
      (item) => item.kind === 'file' && item.type.startsWith('image/')
    );
    const file = imageItem?.getAsFile();

    if (!file) return;

    event.preventDefault();
    uploadCoverImage(file);
  };

  const createTag = async (event) => {
    event.preventDefault();

    const name = newTagName.trim();

    if (!name) {
      showToast('请输入标签名称');
      return;
    }

    setTagAdding(true);
    setMessage('');

    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '添加标签失败');
      }

      const createdTag = data.tag;

      if (createdTag) {
        setTags((current) => (
          current.some((tag) => tag.id === createdTag.id)
            ? current
            : [...current, createdTag]
        ));
      }

      setSelectedTags((current) => (
        current.includes(name) ? current : [...current, name]
      ));
      setNewTagName('');
      setTagAddOpen(false);
      setMessage('标签已添加');
    } catch (error) {
      setMessage(error.message || '添加标签失败');
    } finally {
      setTagAdding(false);
    }
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
          category: NOTE_CATEGORY,
          postType: 'note',
          access: meta.access,
          tags: selectedTags,
          status,
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
        navigate(`/admin/note?post=${savedPost.id || nextPostId}`, { replace: true });
      } else {
        navigate('/admin/note', { replace: true });
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

  const cancelWrite = () => {
    navigate('/admin/note');
  };

  useEffect(() => {
    setCurrentPostId(postIdFromUrl);
  }, [postIdFromUrl]);

  useEffect(() => {
    fetchTags();
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
          <div className={styles.field}>
            <div className={styles.sectionTitle}>
              <span>标签</span>
              <button
                type="button"
                className={styles.addButton}
                onClick={() => setTagAddOpen((open) => !open)}
                title={tagAddOpen ? '取消添加标签' : '添加标签'}
                aria-label={tagAddOpen ? '取消添加标签' : '添加标签'}
                aria-expanded={tagAddOpen}
              >
                {tagAddOpen ? '×' : '+'}
              </button>
            </div>
            {tagAddOpen && (
              <form className={noteStyles.tagAddForm} onSubmit={createTag}>
                <input
                  className={noteStyles.tagAddInput}
                  type="text"
                  value={newTagName}
                  onChange={(event) => setNewTagName(event.target.value)}
                  placeholder="输入新标签"
                  maxLength={30}
                  autoFocus
                  disabled={tagAdding}
                />
                <button type="submit" disabled={tagAdding}>
                  {tagAdding ? '添加中...' : '添加'}
                </button>
              </form>
            )}
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
                      disabled={loading}
                    >
                      {tag.name}
                    </button>
                  );
                })
              ) : (
                <button type="button" className={styles.emptyButton} disabled>
                  暂无标签
                </button>
              )}
            </div>
          </div>

          <div className={styles.field}>
            <span>上传图片</span>
            <div
              className={noteStyles.imageCard}
              onPaste={handleImagePaste}
              tabIndex={0}
              role="group"
              aria-label="图片上传区域"
            >
              <div className={noteStyles.imagePreview}>
                {coverPreview ? (
                  <>
                    <img src={coverPreview} alt="图片预览" />
                    <button
                      type="button"
                      className={noteStyles.removeImageButton}
                      onClick={clearCoverImage}
                      disabled={imageUploading}
                      title="删除图片"
                      aria-label="删除图片"
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <div className={noteStyles.imagePlaceholder}>
                    <strong>未选择图片</strong>
                    <span>上传或直接粘贴剪贴板图片</span>
                  </div>
                )}
              </div>

                <div className={noteStyles.imageBody}>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                  onChange={(event) => {
                    uploadCoverImage(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
                  <div className={noteStyles.imageActions}>
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      disabled={imageUploading}
                      className={noteStyles.uploadButton}
                    >
                      {imageUploading ? '上传中...' : '选择图片'}
                    </button>
                </div>
                </div>
            </div>
          </div>

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
                  disabled={loading}
                />
                {option.label}
              </label>
            ))}
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
            {savingAction === 'draft' ? '保存中...' : '保存草稿'}
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

export default WriteNote;
