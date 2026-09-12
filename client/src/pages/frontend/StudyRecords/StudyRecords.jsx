import { useEffect, useMemo, useState } from 'react';
import Header from '../../../components/Header/Header';
import styles from './StudyRecors.module.css';

const STUDY_CATEGORY = '学习记录';

const pad = (value) => String(value).padStart(2, '0');

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return String(dateValue).slice(0, 10);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const formatDisplayDate = (dateValue) => {
  const value = formatDate(dateValue);
  if (!value) return '未记录日期';
  const date = new Date(`${value}T00:00:00`);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};

const formatDuration = (hours, minutes) => {
  const totalMinutes = Number(hours || 0) * 60 + Number(minutes || 0);
  const finalHours = Math.floor(totalMinutes / 60);
  const finalMinutes = totalMinutes % 60;

  if (!finalHours) return `${finalMinutes} 分钟`;
  if (!finalMinutes) return `${finalHours} С?`;
  return `${finalHours} 小时 ${finalMinutes} 分钟`;
};

const getTotalMinutes = (tasks) => tasks.reduce(
  (total, task) => total + Number(task.hours || 0) * 60 + Number(task.minutes || 0),
  0
);

const formatTotalDuration = (tasks) => {
  const total = getTotalMinutes(tasks);
  return formatDuration(Math.floor(total / 60), total % 60);
};

const decodeStudyRecord = (post) => {
  const content = String(post.content || '');
  const match = /<!-- study-records:v1:([^ ]+) -->/.exec(content);

  if (match) {
    try {
      const parsed = JSON.parse(decodeURIComponent(match[1]));
      const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];

      if (tasks.length) {
        return {
          recordDate: parsed.recordDate || formatDate(post.publishedAt || post.createdAt),
          tasks: tasks.map((task, index) => ({
            id: task.id || `${post.id}-${index}`,
            name: task.name || `任务 ${index + 1}`,
            hours: Number(task.hours || 0),
            minutes: Number(task.minutes || 0),
            summary: task.summary || '',
            attachments: Array.isArray(task.attachments) ? task.attachments : [],
          })),
        };
      }
    } catch {
      // Older records can fall through to the plain-text display below.
    }
  }

  return {
    recordDate: formatDate(post.publishedAt || post.createdAt),
    tasks: [{
      id: `${post.id}-fallback`,
      name: post.title || '学习记录',
      hours: 0,
      minutes: 0,
      summary: content.replace(match?.[0] || '', '').trim(),
      attachments: [],
    }],
  };
};

const createCalendarDays = (baseDate) => {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);

    return {
      date,
      key: formatDate(date),
      inMonth: date.getMonth() === month,
      isFuture: compareDate > today,
    };
  });
};

const StudyRecords = () => {
  const [posts, setPosts] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [activeDate, setActiveDate] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [expandedTasks, setExpandedTasks] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const records = useMemo(() => posts.map((post) => {
    const decoded = decodeStudyRecord(post);
    return {
      ...post,
      authorName: post.author?.nickname || post.author?.username || 'Wray',
      recordDate: decoded.recordDate,
      tasks: decoded.tasks,
    };
  }), [posts]);

  const recordDates = useMemo(
    () => new Set(records.map((record) => record.recordDate).filter(Boolean)),
    [records]
  );

  const calendarDays = useMemo(
    () => createCalendarDays(calendarMonth),
    [calendarMonth]
  );

  const filteredRecords = useMemo(() => {
    const searchText = keyword.trim().toLowerCase();

    return records.filter((record) => {
      if (activeDate && record.recordDate !== activeDate) return false;

      if (!searchText) return true;

      const haystack = [
        record.title,
        record.authorName,
        record.summary,
        ...(record.tags || []),
        ...record.tasks.flatMap((task) => [task.name, task.summary]),
      ].join(' ').toLowerCase();

      return haystack.includes(searchText);
    });
  }, [records, keyword, activeDate]);

  const stats = useMemo(() => {
    const taskCount = records.reduce((count, record) => count + record.tasks.length, 0);
    const minuteCount = records.reduce((count, record) => count + getTotalMinutes(record.tasks), 0);
    const authorCount = new Set(records.map((record) => record.authorName)).size;

    return {
      recordCount: records.length,
      taskCount,
      authorCount,
      duration: formatDuration(Math.floor(minuteCount / 60), minuteCount % 60),
    };
  }, [records]);

  const changeMonth = (offset) => {
    setCalendarMonth((current) => {
      const next = new Date(current);
      next.setMonth(current.getMonth() + offset);
      return next;
    });
  };

  const toggleTask = (recordId, taskId) => {
    const key = `${recordId}:${taskId}`;
    setExpandedTasks((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  useEffect(() => {
    const fetchRecords = async () => {
      const params = new URLSearchParams({
        category: STUDY_CATEGORY,
        status: 'published',
        pageSize: '50',
      });

      setLoading(true);
      setMessage('');

      try {
        const res = await fetch(`/api/posts?${params.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || '获取学习记录失败');
        }

        setPosts(Array.isArray(data.posts) ? data.posts : []);
      } catch (error) {
        setPosts([]);
        setMessage(error.message || '获取学习记录失败');
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, []);

  return (
    <div className={styles.study}>
      <Header />

      <main className={styles.page}>
        <section className={styles.hero}>
          <div>
            <span>学习记录</span>
            <h1>今天也在进步</h1>
            <p>把每一天的任务、时间和总结整理起来，慢慢看见成长的轨迹。</p>
          </div>
          <div className={styles.stats}>
            <div>
              <strong>{stats.recordCount}</strong>
              <span>记录</span>
            </div>
            <div>
              <strong>{stats.taskCount}</strong>
              <span>任务</span>
            </div>
            <div>
              <strong>{stats.authorCount}</strong>
              <span>账号</span>
            </div>
            <div>
              <strong>{stats.duration}</strong>
              <span>累计用时</span>
            </div>
          </div>
        </section>

        <section className={styles.toolbar}>
          <label className={styles.searchBox}>
            <span>搜索</span>
            <input
              type="search"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索标题、账号、任务、总结或标签"
            />
          </label>
          {activeDate && (
            <button type="button" onClick={() => setActiveDate('')}>
              清除日期筛选：{activeDate}
            </button>
          )}
        </section>

        {message && <div className={styles.message}>{message}</div>}

        <section className={styles.contentGrid}>
          <aside className={styles.calendarPanel}>
            <div className={styles.calendarHeader}>
              <button type="button" onClick={() => changeMonth(-1)} aria-label="上个月">
                ?
              </button>
              <strong>{calendarMonth.getFullYear()}年{calendarMonth.getMonth() + 1}月</strong>
              <button type="button" onClick={() => changeMonth(1)} aria-label="下个月">
                ?
              </button>
            </div>

            <div className={styles.weekdays}>
              {['日', '?', '二', '三', '四', '五', '六'].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className={styles.calendarGrid}>
              {calendarDays.map((day) => {
                const hasRecord = recordDates.has(day.key);
                const active = activeDate === day.key;

                return (
                  <button
                    type="button"
                    key={day.key}
                    className={[
                      styles.calendarDay,
                      day.inMonth ? '' : styles.mutedDay,
                      hasRecord ? styles.recordedDay : styles.pastDay,
                      day.isFuture ? styles.futureDay : '',
                      active ? styles.activeDay : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => !day.isFuture && setActiveDate(day.key)}
                    disabled={day.isFuture}
                    title={
                      hasRecord
                        ? `${day.key} 有学习记录`
                        : day.isFuture
                          ? `${day.key} 未到日期`
                          : `${day.key} 暂无学习记录`
                    }
                  >
                    {day.date.getDate()}
                  </button>
                );
              })}
            </div>
          </aside>

          <section className={styles.recordList}>
            {loading ? (
              <div className={styles.emptyState}>学习记录读取中...</div>
            ) : filteredRecords.length ? (
              filteredRecords.map((record) => (
                <article className={styles.recordCard} key={record.id}>
                  <header className={styles.recordCardHeader}>
                    <div>
                      <span className={styles.recordDate}>{formatDisplayDate(record.recordDate)}</span>
                      <h2>{record.title}</h2>
                    </div>
                    <div className={styles.authorBadge}>{record.authorName}</div>
                  </header>

                  <div className={styles.recordMeta}>
                    <span>{record.tasks.length} 项任务</span>
                    <span>共 {formatTotalDuration(record.tasks)}</span>
                    {(record.tags || []).map((tag) => (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => setKeyword(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>

                  <div className={styles.taskList}>
                    {record.tasks.map((task, index) => {
                      const expandKey = `${record.id}:${task.id}`;
                      const expanded = Boolean(expandedTasks[expandKey]);

                      return (
                        <section className={styles.taskItem} key={task.id}>
                          <button
                            type="button"
                            className={styles.taskToggle}
                            onClick={() => toggleTask(record.id, task.id)}
                            aria-expanded={expanded}
                          >
                            <span className={styles.taskIndex}>{index + 1}</span>
                            <span className={styles.taskName}>{task.name}</span>
                            <span className={styles.taskTime}>{formatDuration(task.hours, task.minutes)}</span>
                            <span className={styles.chevron}>{expanded ? '收起' : '展开'}</span>
                          </button>

                          {expanded && (
                            <div className={styles.taskDetail}>
                              <p>{task.summary || '暂无总结'}</p>
                              {task.attachments.length > 0 && (
                                <div className={styles.attachments}>
                                  {task.attachments.map((attachment, attachmentIndex) => (
                                    <figure key={`${attachment.url}-${attachmentIndex}`}>
                                      {attachment.type === 'video' ? (
                                        <video src={attachment.url} controls />
                                      ) : (
                                        <img src={attachment.url} alt={attachment.name || '学习记录图片'} />
                                      )}
                                    </figure>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                </article>
              ))
            ) : activeDate ? (
              <div className={styles.emptyState}>{activeDate} 暂无学习记录</div>
            ) : (
              <div className={styles.emptyState}>还没有匹配的学习记录</div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
};

export default StudyRecords;
