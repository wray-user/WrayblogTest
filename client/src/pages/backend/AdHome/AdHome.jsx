import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './AdHome.module.css';

const sectionColors = {
  tech: '#2f80ed',
  note: '#e85d75',
  study: '#16a085',
  site: '#8a6de9',
};

const statusText = {
  published: '已发布',
  draft: '草稿',
  scheduled: '定时',
};

const formatNumber = (value) => new Intl.NumberFormat('zh-CN').format(Number(value || 0));

const formatDateTime = (value) => {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const pad = (item) => String(item).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const getLocationText = (visitor) => {
  const parts = [visitor.country, visitor.region, visitor.city].filter(Boolean);

  return parts.length ? parts.join(' / ') : '未知位置';
};

const projectPoint = (latitude, longitude) => ({
  x: ((Number(longitude) + 180) / 360) * 1000,
  y: ((90 - Number(latitude)) / 180) * 460,
});

const LineChart = ({ data }) => {
  const width = 720;
  const height = 260;
  const padding = 36;
  const maxValue = Math.max(
    1,
    ...data.flatMap((item) => [Number(item.visits || 0), Number(item.posts || 0)])
  );
  const xStep = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;
  const plotX = (index) => padding + index * xStep;
  const plotY = (value) => height - padding - (Number(value || 0) / maxValue) * (height - padding * 2);
  const createPath = (key) => data
    .map((item, index) => `${index === 0 ? 'M' : 'L'} ${plotX(index)} ${plotY(item[key])}`)
    .join(' ');

  return (
    <svg className={styles.lineChart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="最近 14 天趋势">
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = padding + ratio * (height - padding * 2);
        const label = Math.round(maxValue * (1 - ratio));

        return (
          <g key={ratio}>
            <line x1={padding} y1={y} x2={width - padding} y2={y} />
            <text x={padding - 10} y={y + 4}>{label}</text>
          </g>
        );
      })}
      <path className={styles.visitLine} d={createPath('visits')} />
      <path className={styles.postLine} d={createPath('posts')} />
      {data.map((item, index) => (
        <g key={item.date}>
          <circle className={styles.visitDot} cx={plotX(index)} cy={plotY(item.visits)} r="4" />
          <circle className={styles.postDot} cx={plotX(index)} cy={plotY(item.posts)} r="4" />
          {(index === 0 || index === data.length - 1 || index % 3 === 1) && (
            <text className={styles.axisDate} x={plotX(index)} y={height - 10}>
              {item.date.slice(5)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
};

const DonutChart = ({ data }) => {
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);
  let cursor = 0;
  const gradient = total
    ? data.map((item) => {
      const value = Number(item.value || 0);
      const start = cursor;
      const end = cursor + (value / total) * 100;
      cursor = end;

      return `${sectionColors[item.key] || '#94a3b8'} ${start}% ${end}%`;
    }).join(', ')
    : '#e6edf5 0% 100%';

  return (
    <div className={styles.donutWrap}>
      <div className={styles.donut} style={{ background: `conic-gradient(${gradient})` }}>
        <div>
          <strong>{formatNumber(total)}</strong>
          <span>文章</span>
        </div>
      </div>
      <div className={styles.legend}>
        {data.map((item) => (
          <div key={item.key}>
            <i style={{ background: sectionColors[item.key] || '#94a3b8' }} />
            <span>{item.label}</span>
            <strong>{formatNumber(item.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

const WorldMap = ({ visitors }) => {
  const points = visitors
    .filter((visitor) => Number.isFinite(visitor.latitude) && Number.isFinite(visitor.longitude))
    .map((visitor) => ({
      ...visitor,
      point: projectPoint(visitor.latitude, visitor.longitude),
    }));

  return (
    <div className={styles.mapShell}>
      <svg className={styles.worldMap} viewBox="0 0 1000 460" role="img" aria-label="访客全球地图">
        <rect x="0" y="0" width="1000" height="460" rx="8" />
        {[-120, -60, 0, 60, 120].map((longitude) => (
          <line
            key={`lng-${longitude}`}
            className={styles.mapGrid}
            x1={projectPoint(0, longitude).x}
            y1="32"
            x2={projectPoint(0, longitude).x}
            y2="428"
          />
        ))}
        {[-60, -30, 0, 30, 60].map((latitude) => (
          <line
            key={`lat-${latitude}`}
            className={styles.mapGrid}
            x1="40"
            y1={projectPoint(latitude, 0).y}
            x2="960"
            y2={projectPoint(latitude, 0).y}
          />
        ))}
        <path className={styles.land} d="M130 112c54-38 138-44 196-10 42 25 48 62 22 98-35 49-23 82 10 128 20 28 9 56-30 66-55 14-97-24-120-71-19-39-38-67-79-78-55-15-67-95 1-133z" />
        <path className={styles.land} d="M425 86c58-35 155-37 220-8 76 35 139 31 197 55 44 18 51 61 16 87-31 23-84 21-128 15-72-10-98 21-120 72-19 45-57 61-103 41-39-17-31-56-10-89 31-49 14-73-45-81-59-7-74-63-27-92z" />
        <path className={styles.land} d="M486 249c43-20 96 10 113 55 16 43-3 84-30 119-24 31-79 21-93-18-16-44-41-64-41-101 0-24 20-42 51-55z" />
        <path className={styles.land} d="M745 272c55-19 106-8 135 33 19 27 10 66-23 83-55 28-130 0-155-54-11-24 8-50 43-62z" />
        <path className={styles.land} d="M286 256c40 10 64 47 61 96-4 62-40 102-85 80-36-18-50-67-30-114 13-31 24-70 54-62z" />
        {points.map((visitor) => (
          <g key={`${visitor.ip}-${visitor.lastSeenAt}`}>
            <circle
              className={styles.mapPulse}
              cx={visitor.point.x}
              cy={visitor.point.y}
              r={Math.min(20, 7 + Number(visitor.count || 1))}
            />
            <circle
              className={styles.mapPoint}
              cx={visitor.point.x}
              cy={visitor.point.y}
              r={Math.min(8, 4 + Number(visitor.count || 1) / 2)}
            />
            <title>{`${visitor.ip} ${getLocationText(visitor)}`}</title>
          </g>
        ))}
      </svg>
      {!points.length && (
        <div className={styles.mapEmpty}>
          暂无带坐标的访问记录，部署环境提供 IP 地理请求头后会自动点亮地图。
        </div>
      )}
    </div>
  );
};

const AdHome = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const statCards = useMemo(() => {
    const summary = dashboard?.summary || {};
    const cards = [
      { label: '访客数', value: summary.visitors, tone: 'blue' },
      { label: '访问次数', value: summary.visits, tone: 'violet' },
      { label: '文章数量', value: summary.posts, tone: 'green' },
      { label: '总阅读量', value: summary.views, tone: 'orange' },
      { label: '评论数量', value: summary.comments, tone: 'red' },
    ];

    if (summary.isAdmin) {
      cards.push({ label: '账户数量', value: summary.users, tone: 'slate' });
    }

    return cards;
  }, [dashboard]);

  const maxCategoryCount = Math.max(
    1,
    ...(dashboard?.categoryStats || []).map((item) => Number(item.count || 0))
  );

  useEffect(() => {
    let ignore = false;

    const fetchDashboard = async () => {
      const token = localStorage.getItem('token');

      if (!token) {
        setMessage('请先登录后台');
        setLoading(false);
        return;
      }

      setLoading(true);
      setMessage('');

      try {
        const res = await fetch('/api/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || '读取后台首页数据失败');
        }

        if (!ignore) {
          setDashboard(data);
        }
      } catch (error) {
        if (!ignore) {
          setMessage(error.message || '读取后台首页数据失败');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchDashboard();

    return () => {
      ignore = true;
    };
  }, []);

  if (loading) {
    return <section className={styles.statePanel}>后台数据读取中...</section>;
  }

  if (message) {
    return <section className={styles.statePanel}>{message}</section>;
  }

  const summary = dashboard?.summary || {};
  const sections = dashboard?.sections || [];
  const visitors = dashboard?.visitors || [];
  const topPosts = dashboard?.topPosts || [];
  const categoryStats = dashboard?.categoryStats || [];

  return (
    <section className={styles.dashboard}>
      <div className={styles.hero}>
        <div>
          <span>数据总览</span>
          <h2>后台首页</h2>
          <p>访客、内容、阅读和分类分布都集中在这里，技术分享、心情随笔、学习记录分开统计。</p>
        </div>
        <div className={styles.statusPills}>
          <span>已发布 {formatNumber(summary.published)}</span>
          <span>草稿 {formatNumber(summary.drafts)}</span>
          <span>定时 {formatNumber(summary.scheduled)}</span>
        </div>
      </div>

      <div className={styles.statGrid}>
        {statCards.map((card) => (
          <article className={`${styles.statCard} ${styles[card.tone]}`} key={card.label}>
            <span>{card.label}</span>
            <strong>{formatNumber(card.value)}</strong>
          </article>
        ))}
      </div>

      <div className={styles.sectionGrid}>
        {sections.map((section) => (
          <article className={styles.sectionCard} key={section.key}>
            <div className={styles.sectionTitle}>
              <i style={{ background: sectionColors[section.key] }} />
              <h3>{section.label}</h3>
            </div>
            <div className={styles.sectionMetrics}>
              <span>文章 <strong>{formatNumber(section.posts)}</strong></span>
              <span>阅读 <strong>{formatNumber(section.views)}</strong></span>
              <span>访问 <strong>{formatNumber(section.visits)}</strong></span>
              <span>评论 <strong>{formatNumber(section.comments)}</strong></span>
            </div>
          </article>
        ))}
      </div>

      <div className={styles.mainGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Visitors</span>
              <h3>全球访客地图</h3>
            </div>
            <strong>{formatNumber(visitors.length)} 个最近 IP</strong>
          </div>
          <WorldMap visitors={visitors} />
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Trend</span>
              <h3>最近 14 天趋势</h3>
            </div>
            <div className={styles.chartLegend}>
              <span><i className={styles.visitMark} />访问</span>
              <span><i className={styles.postMark} />文章</span>
            </div>
          </div>
          <LineChart data={dashboard?.trend || []} />
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Content</span>
              <h3>文章类型占比</h3>
            </div>
          </div>
          <DonutChart data={dashboard?.pie || []} />
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Rank</span>
              <h3>热门文章</h3>
            </div>
            <Link to="/admin/posts">管理文章</Link>
          </div>
          <div className={styles.rankList}>
            {topPosts.length ? topPosts.map((post, index) => (
              <Link
                className={styles.rankItem}
                key={post.id}
                to={`/admin/write/${post.section === 'study' ? 'study' : post.section === 'note' ? 'note' : 'tech'}?post=${post.id}`}
              >
                <span>{index + 1}</span>
                <div>
                  <strong>{post.title}</strong>
                  <small>{post.category || '未分类'} · {statusText[post.status] || post.status}</small>
                </div>
                <em>{formatNumber(post.views)}</em>
              </Link>
            )) : (
              <div className={styles.empty}>暂无文章数据</div>
            )}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Category</span>
              <h3>技术分类分布</h3>
            </div>
          </div>
          <div className={styles.barList}>
            {categoryStats.length ? categoryStats.map((item) => (
              <div className={styles.barItem} key={item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{formatNumber(item.count)} 篇 · {formatNumber(item.views)} 阅读</span>
                </div>
                <i>
                  <b style={{ width: `${Math.max(8, (Number(item.count || 0) / maxCategoryCount) * 100)}%` }} />
                </i>
              </div>
            )) : (
              <div className={styles.empty}>暂无技术分类数据</div>
            )}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Recent</span>
              <h3>最近访客</h3>
            </div>
          </div>
          <div className={styles.visitorList}>
            {visitors.length ? visitors.slice(0, 8).map((visitor) => (
              <div className={styles.visitorItem} key={`${visitor.ip}-${visitor.lastSeenAt}`}>
                <span>{visitor.ip}</span>
                <strong>{getLocationText(visitor)}</strong>
                <small>{formatDateTime(visitor.lastSeenAt)}</small>
              </div>
            )) : (
              <div className={styles.empty}>暂无访客记录</div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
};

export default AdHome;
