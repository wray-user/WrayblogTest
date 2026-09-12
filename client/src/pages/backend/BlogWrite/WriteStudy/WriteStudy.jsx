/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from './WriteStudy.module.css';

const STUDY_CATEGORY = '学习记录';

const defaultMeta = {
  access: 'public',
};

const accessOptions = [
  { value: 'public', label: '公开' },
  { value: 'login', label: '登录可见' },
  { value: 'private', label: '仅自己' },
];

const pad = (value) => String(value).padStart(2, '0');

const getToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const createTask = () => ({
  id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: '',
  hours: 0,
  minutes: 30,
  summary: '',
  attachments: [],
});

const createInitialTask = () => ({
  ...createTask(),
  name: '',
  hours: 1,
  minutes: 0,
});

const formatDuration = (hours, minutes) => {
  const totalMinutes = Number(hours || 0) * 60 + Number(minutes || 0);
  const formattedHours = Math.floor(totalMinutes / 60);
  const formattedMinutes = totalMinutes % 60;

  if (!formattedHours) return `${formattedMinutes} 分钟`;
  if (!formattedMinutes) return `${formattedHours} С?`;
  return `${formattedHours} 小时 ${formattedMinutes} 分钟`;
};

const totalDuration = (tasks) => tasks.reduce(
  (total, task) => total + Number(task.hours || 0) * 60 + Number(task.minutes || 0),
  0
);

const formatTotalDuration = (tasks) => {
  const total = totalDuration(tasks);
  return formatDuration(Math.floor(total / 60), total % 60);
};

const encodeStudyContent = (recordDate, tasks) => {
  const payload = encodeURIComponent(JSON.stringify({ recordDate, tasks }));
  const lines = tasks.map((task, index) => {
    const attachments = (task.attachments || []).map((attachment) => (
      attachment.type === 'video'
        ? `<video src="${attachment.url}" controls width="100%"></video>`
        : `![${attachment.name || '学习记录图片'}](${attachment.url})`
    )).join('\n\n');

    return [
      `## 任务 ${index + 1}：${task.name}`,
      '',
      `- 用时：${formatDuration(task.hours, task.minutes)}`,
      '',
      '### 总结',
      '',
      task.summary || '暂无总结',
      attachments ? `\n\n${attachments}` : '',
    ].join('\n');
  });

  return `<!-- study-records:v1:${payload} -->\n\n${lines.join('\n\n')}`;
};

const decodeStudyContent = (content) => {
  const match = /<!-- study-records:v1:([^ ]+) -->/.exec(String(content || ''));

  if (!match) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(match[1]));

    if (!Array.isArray(parsed.tasks) || !parsed.tasks.length) {
      return null;
    }

    return {
      recordDate: parsed.recordDate || getToday(),
      tasks: parsed.tasks.map((task) => ({
        ...createTask(),
        ...task,
        attachments: Array.isArray(task.attachments) ? task.attachments : [],
      })),
    };
  } catch {
    return null;
  }
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

const WriteStudy = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const postIdFromUrl = searchParams.get('post') || '';

  const toastTimerRef = useRef(null);
  const fileInputRefs = useRef({});

  const [currentPostId, setCurrentPostId] = useState(postIdFromUrl);
  const [recordDate, setRecordDate] = useState(getToday);
  const [recordTitle, setRecordTitle] = useState('今日学习记录');
  const [tasks, setTasks] = useState([createInitialTask()]);
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagAddOpen, setTagAddOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [tagAdding, setTagAdding] = useState(false);
  const [meta, setMeta] = useState(defaultMeta);
  const [scheduledAt, setScheduledAt] = useState('');
  const [scheduleMin, setScheduleMin] = useState(() => {
    const date = new Date();
    date.setSeconds(0, 0);
    date.setMinutes(date.getMinutes() + 1);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  });
  const [loading, setLoading] = useState(false);
  const [savingAction, setSavingAction] = useState('');
  const [uploadingTaskId, setUploadingTaskId] = useState('');
  const [message, setMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const showToast = (text) => {
    window.clearTimeout(toastTimerRef.current);
    setToastMessage(text);

    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage('');
    }, 1500);
  };

  const updateTask = (taskId, key, value) => {
    setTasks((current) => current.map((task) => (
      task.id === taskId ? { ...task, [key]: value } : task
    )));
  };

  const addTask = () => {
    setTasks((current) => [...current, createTask()]);
  };

  const removeTask = (taskId) => {
    setTasks((current) => {
      if (current.length === 1) {
        return [createInitialTask()];
      }

      return current.filter((task) => task.id !== taskId);
    });
  };

  const uploadTaskMedia = async (taskId, file, type) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    setUploadingTaskId(taskId);
    setMessage('');

    try {
      const endpoint = type === 'video' ? '/api/videos' : '/api/images';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.message || '上传失败');
      }

      setTasks((current) => current.map((task) => (
        task.id === taskId
          ? {
              ...task,
              attachments: [
                ...task.attachments,
                {
                  type,
                  url: data.url,
                  name: file.name || (type === 'video' ? '学习记录视频' : '学习记录图片'),
                },
              ],
            }
          : task
      )));
      setMessage(type === 'video' ? '视频已上传' : '图片已上传');
    } catch (error) {
      setMessage(error.message || '上传失败');
    } finally {
      setUploadingTaskId('');
    }
  };

  const handleSummaryPaste = (event, taskId) => {
    const imageItem = Array.from(event.clipboardData?.items || []).find(
      (item) => item.kind === 'file' && item.type.startsWith('image/')
    );
    const file = imageItem?.getAsFile();

    if (!file) return;

    event.preventDefault();
    uploadTaskMedia(taskId, file, 'image');
  };

  const removeAttachment = (taskId, attachmentIndex) => {
    setTasks((current) => current.map((task) => (
      task.id === taskId
        ? {
            ...task,
            attachments: task.attachments.filter((_, index) => index !== attachmentIndex),
          }
        : task
    )));
  };

  const fetchTags = async () => {
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
    }
  };

  const fetchPost = async (postId) => {
    if (!postId) return;

    setLoading(true);

    try {
      const res = await fetch(`/api/posts/${postId}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '获取记录失败');
      }

      const post = data.post || {};
      const parsedContent = decodeStudyContent(post.content);

      setRecordTitle(post.title || '今日学习记录');
      setMeta({ access: post.access || 'public' });
      setSelectedTags(Array.isArray(post.tags) ? post.tags : []);
      setScheduledAt(post.scheduledAt ? post.scheduledAt.slice(0, 16) : '');

      if (parsedContent) {
        setRecordDate(parsedContent.recordDate);
        setTasks(parsedContent.tasks);
      } else {
        setTasks([{
          ...createInitialTask(),
          name: '学习记录',
          summary: post.content || '',
        }]);
      }
    } catch (error) {
      setMessage(error.message || '获取记录失败');
    } finally {
      setLoading(false);
    }
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

      if (data.tag) {
        setTags((current) => (
          current.some((tag) => tag.id === data.tag.id) ? current : [...current, data.tag]
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

  const resetWriteForm = () => {
    setCurrentPostId('');
    setRecordDate(getToday());
    setRecordTitle('今日学习记录');
    setTasks([createInitialTask()]);
    setSelectedTags([]);
    setMeta({ ...defaultMeta });
    setScheduledAt('');
    setMessage('草稿已保存');
    navigate('/admin/write/study', { replace: true });
  };

  const validateBeforeSave = (status) => {
    if (!recordTitle.trim()) {
      showToast('请输入记录标题');
      return false;
    }

    if (!recordDate) {
      showToast('请选择记录日期');
      return false;
    }

    if (!tasks.length) {
      showToast('请至少添加一项任务');
      return false;
    }

    const invalidTask = tasks.find((task) => (
      !task.name.trim()
      || (Number(task.hours || 0) * 60 + Number(task.minutes || 0) <= 0)
    ));

    if (invalidTask) {
      showToast('请填写每项任务和用时');
      return false;
    }

    if (status === 'scheduled') {
      const scheduledDate = new Date(scheduledAt);

      if (!scheduledAt || Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
        showToast('请选择未来的发布时间');
        return false;
      }
    }

    return stripContent(encodeStudyContent(recordDate, tasks)).length > 0;
  };

  const savePost = async (status) => {
    if (!validateBeforeSave(status)) return;

    setSavingAction(status);
    setMessage('');

    try {
      const content = encodeStudyContent(recordDate, tasks);
      const res = await fetch(currentPostId ? `/api/posts/${currentPostId}` : '/api/posts', {
        method: currentPostId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          title: recordTitle.trim(),
          content,
          category: STUDY_CATEGORY,
          postType: 'note',
          access: meta.access,
          tags: selectedTags,
          status,
          summary: `${recordDate} 共学习 ${formatTotalDuration(tasks)}`,
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

      navigate(
        nextPostId ? `/admin/studies?post=${nextPostId}` : '/admin/studies',
        { replace: true }
      );
    } catch (error) {
      setMessage(error.message || '保存失败');
    } finally {
      setSavingAction('');
    }
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
      const date = new Date();
      date.setSeconds(0, 0);
      date.setMinutes(date.getMinutes() + 1);
      setScheduleMin(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`);
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => {
    window.clearTimeout(toastTimerRef.current);
  }, []);

  return (
    <div className={styles.page}>
      {toastMessage && <div className={styles.toastMessage}>{toastMessage}</div>}

      <section className={styles.recordHeader}>
        <div>
          <span className={styles.eyebrow}>学习记录</span>
          <h1>记录今天做了什么</h1>
          <p>把任务、投入时间和当天的收获整理在一起。</p>
        </div>
        <div className={styles.totalTime}>
          <span>今日累计</span>
          <strong>{formatTotalDuration(tasks)}</strong>
        </div>
      </section>

      <section className={styles.recordInfo}>
        <label>
          <span>记录标题</span>
          <input
            type="text"
            value={recordTitle}
            onChange={(event) => setRecordTitle(event.target.value)}
            placeholder="例如：今天的学习记录"
            disabled={loading}
          />
        </label>
        <label>
          <span>记录日期</span>
          <input
            type="date"
            value={recordDate}
            onChange={(event) => setRecordDate(event.target.value)}
            disabled={loading}
          />
        </label>
      </section>

      <section className={styles.tasksSection}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>今天完成的任务</h2>
            <span>可以添加多项任务，分别记录投入时间和总结。</span>
          </div>
          <button type="button" className={styles.addTaskButton} onClick={addTask}>
            <span aria-hidden="true">+</span>
            添加任务
          </button>
        </div>

        <div className={styles.taskList}>
          {tasks.map((task, index) => (
            <article className={styles.taskItem} key={task.id}>
              <div className={styles.taskTopline}>
                <span className={styles.taskNumber}>任务 {index + 1}</span>
                <button
                  type="button"
                  className={styles.removeTaskButton}
                  onClick={() => removeTask(task.id)}
                  title="删除任务"
                  aria-label={`删除任务 ${index + 1}`}
                >
                  ×
                </button>
              </div>

              <div className={styles.taskFields}>
                <label className={styles.taskNameField}>
                  <span>任务内容</span>
                  <input
                    type="text"
                    value={task.name}
                    onChange={(event) => updateTask(task.id, 'name', event.target.value)}
                    placeholder="例如：完成 React 组件练习"
                    disabled={loading}
                  />
                </label>

                <div className={styles.durationField}>
                  <span>用时</span>
                  <div className={styles.durationInputs}>
                    <label>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={task.hours}
                        onChange={(event) => updateTask(task.id, 'hours', Math.max(0, Number(event.target.value) || 0))}
                        disabled={loading}
                      />
                      小时
                    </label>
                    <label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={task.minutes}
                        onChange={(event) => updateTask(task.id, 'minutes', Math.max(0, Number(event.target.value) || 0))}
                        disabled={loading}
                      />
                      分钟
                    </label>
                  </div>
                </div>
              </div>

              <label className={styles.summaryField}>
                <span>任务总结</span>
                <textarea
                  value={task.summary}
                  onChange={(event) => updateTask(task.id, 'summary', event.target.value)}
                  onPaste={(event) => handleSummaryPaste(event, task.id)}
                  placeholder="写下今天完成了什么、遇到了什么问题、下一步准备做什么……"
                  rows={5}
                  disabled={loading}
                />
              </label>

              <div className={styles.taskMedia}>
                <input
                  ref={(element) => {
                    fileInputRefs.current[`${task.id}-image`] = element;
                  }}
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    uploadTaskMedia(task.id, event.target.files?.[0], 'image');
                    event.target.value = '';
                  }}
                />
                <input
                  ref={(element) => {
                    fileInputRefs.current[`${task.id}-video`] = element;
                  }}
                  type="file"
                  accept="video/*"
                  onChange={(event) => {
                    uploadTaskMedia(task.id, event.target.files?.[0], 'video');
                    event.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRefs.current[`${task.id}-image`]?.click()}
                  disabled={uploadingTaskId === task.id}
                >
                  {uploadingTaskId === task.id ? '上传中...' : '上传图片'}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRefs.current[`${task.id}-video`]?.click()}
                  disabled={uploadingTaskId === task.id}
                >
                  上传视频
                </button>
                <span>总结框内也可以直接粘贴图片</span>
              </div>

              {task.attachments.length > 0 && (
                <div className={styles.attachments}>
                  {task.attachments.map((attachment, attachmentIndex) => (
                    <div className={styles.attachmentItem} key={`${attachment.url}-${attachmentIndex}`}>
                      {attachment.type === 'video' ? (
                        <video src={attachment.url} controls />
                      ) : (
                        <img src={attachment.url} alt={attachment.name || '任务图片'} />
                      )}
                      <button
                        type="button"
                        onClick={() => removeAttachment(task.id, attachmentIndex)}
                        title="删除附件"
                        aria-label="删除附件"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className={styles.optionsSection}>
        <div className={styles.optionPanel}>
          <div className={styles.sectionTitle}>
            <span>标签</span>
            <button
              type="button"
              className={styles.addButton}
              onClick={() => setTagAddOpen((open) => !open)}
              title={tagAddOpen ? '取消添加标签' : '添加标签'}
              aria-label={tagAddOpen ? '取消添加标签' : '添加标签'}
            >
              {tagAddOpen ? '×' : '+'}
            </button>
          </div>

          {tagAddOpen && (
            <form className={styles.tagAddForm} onSubmit={createTag}>
              <input
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
            {tags.length ? tags.map((tag) => {
              const active = selectedTags.includes(tag.name);

              return (
                <button
                  type="button"
                  key={tag.id}
                  className={`${styles.tagItem} ${active ? styles.tagActive : ''}`}
                  onClick={() => setSelectedTags((current) => (
                    active
                      ? current.filter((item) => item !== tag.name)
                      : [...current, tag.name]
                  ))}
                  aria-pressed={active}
                  disabled={loading}
                >
                  {tag.name}
                </button>
              );
            }) : (
              <span className={styles.emptyText}>暂无标签</span>
            )}
          </div>
        </div>

        <div className={styles.optionPanel}>
          <div className={styles.sectionTitle}>访问权限</div>
          <div className={styles.accessOptions}>
            {accessOptions.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="study-access"
                  value={option.value}
                  checked={meta.access === option.value}
                  onChange={(event) => setMeta({ access: event.target.value })}
                  disabled={loading}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.actions}>
        <button type="button" onClick={() => savePost('published')} disabled={Boolean(savingAction)}>
          {savingAction === 'published' ? '发布中...' : '发布记录'}
        </button>
        <button type="button" onClick={() => savePost('draft')} disabled={Boolean(savingAction)}>
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
          <button type="button" onClick={() => savePost('scheduled')} disabled={Boolean(savingAction)}>
            {savingAction === 'scheduled' ? '安排中...' : '定时发布'}
          </button>
        </label>
        <button type="button" onClick={() => navigate('/admin/studies')} disabled={Boolean(savingAction)}>
          取消
        </button>
      </section>

      {message && <div className={styles.message}>{message}</div>}
    </div>
  );
};

export default WriteStudy;
