import { useMemo, useState } from 'react';
import styles from './Contribution.module.css';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const weeks = ['Sun', 'Mon','Tue','Wed','Thu','Fri','Sat'];


const pad = (value) => String(value).padStart(2, '0');

const formatDateKey = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const stripContent = (value) => (
  String(value || '')
    .replace(/<!-- study-records:v1:[^>]+-->/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]+]\([^)]+\)/g, ' ')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

const getPostDate = (post) => {
  const date = new Date(post.publishedAt || post.createdAt || post.updatedAt || '');

  return Number.isNaN(date.getTime()) ? null : date;
};

const getPostContributionValue = (post) => {
  const contentLength = Array.from(stripContent(post.content || post.summary || '')).length;
  const wordBonus = Math.min(Math.floor(contentLength / 800), 4);
  const viewBonus = Math.min(Math.floor(Number(post.viewCount || 0) / 10), 5);
  const commentBonus = Math.min(Number(post.commentCount || 0) * 2, 10);

  return 3 + wordBonus + viewBonus + commentBonus;
};

const getContributionLevel = (value) => {
  if (value >= 14) return 4;
  if (value >= 8) return 3;
  if (value >= 4) return 2;
  if (value >= 1) return 1;

  return 0;
};

const Contribution = ({ posts = [] }) => {
  const currentYear = new Date().getFullYear();
  const [yearPageIndex, setYearPageIndex] = useState(0);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const years = useMemo(() => {
    const startYear = currentYear - yearPageIndex * 4;

    return Array.from({length:4}, (_, index) => startYear - index);
  }, [currentYear, yearPageIndex]);

  const year = selectedYear;
  const firstDay = new Date(year, 0, 1); 
  const daysInYear = new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;

  const contributionByDate = useMemo(() => {
    const map = new Map();

    posts.forEach((post) => {
      const date = getPostDate(post);
      if (!date || date.getFullYear() !== year) return;

      const key = formatDateKey(date);
      const current = map.get(key) || {
        value: 0,
        count: 0,
        titles: [],
      };

      current.value += getPostContributionValue(post);
      current.count += 1;
      current.titles.push(post.title);
      map.set(key, current);
    });

    return map;
  }, [posts, year]);

  const totalContribution = useMemo(
    () => Array.from(contributionByDate.values()).reduce((sum, item) => sum + item.value, 0),
    [contributionByDate]
  );

  const days = Array.from({ length: daysInYear }, (_, index) => {
    const date = new Date(year, 0, index + 1);
    const offset = firstDay.getDay() + index;
    const dateKey = formatDateKey(date);
    const contribution = contributionByDate.get(dateKey) || {
      value: 0,
      count: 0,
      titles: [],
    };

    return {
      index,
      dateKey,
      row: date.getDay() + 1,
      column: Math.floor(offset / 7) + 1,
      contribution,
      level: getContributionLevel(contribution.value),
    };
  });

  const totalColumns = Math.max(...days.map((day) => day.column));
  const monthLabels = months.map((month, monthIndex) => {
    const date = new Date(year, monthIndex, 1);
    const dayOfYear = Math.floor((date - firstDay) / (24*60*60*1000));
    const offset = firstDay.getDay() + dayOfYear;
    return {
      month,
      column: Math.floor(offset / 7) + 1,
    };
  });

  return (
    <section className={styles.contribution}>
      <div className={styles.main}> 
  {/* 介绍和标题 */}
        <div className={styles.header}>
          <div className={styles.hero}>
            <h3>{year} 年贡献值 {totalContribution}</h3>
          </div>
          <div className={styles.legend}>
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <i key={level} className={styles.cell} data-level={level} />
            ))}
            <span>More</span>
          </div>
        </div>

  {/* 贡献主图 */}
        <div className={styles.graph} style={{ '--columns': totalColumns }}>
  {/* 月份标签行 */}
          <div className={styles.monthLabels}>
            {monthLabels.map((item) => (
              <span
                key={item.month}
                className={styles.monthName}
                style={{ gridColumn: item.column }}
              >
                {item.month}
              </span>
            ))}
          </div>

  {/* 星期标签列 */}
          <div className={styles.weekLabels}>
            {weeks.map((item) => (
              <span key={item}>
                {item}
              </span>
            ))
            }
          </div>

          <div className={styles.cellGrid}>
            {days.map((day) => (
              <span
                key={day.index}
                className={styles.cell}
                style={{
                  gridRow: day.row,
                  gridColumn: day.column,
                }}
                data-level={day.level}
                title={`${day.dateKey}：${day.contribution.value} 贡献值，${day.contribution.count} 篇文章`}
              />
            ))}
          </div>
        </div>

      </div>

{/* 年份列表 */}
    <div className={styles.years}>
      {years.map((yearItem) => (
        <button 
          key={yearItem}
          type="button"
          className={`${styles.yearName} ${ 
            yearItem === selectedYear ? styles.yearNameActive : ''
          }`}
          onClick={() => setSelectedYear(yearItem)}
          >
          <span>
            {yearItem}
          </span>
        </button>
      ))}
      <div className={styles.changePage}>
        <button 
          type="button" 
          onClick={() => {
            if (yearPageIndex === 0) return;

            const nextPageIndex = yearPageIndex - 1;
            const nextStartYear = currentYear - nextPageIndex * 4;

            setYearPageIndex(nextPageIndex);
            setSelectedYear(nextStartYear);
          }}
          >
          <svg className="next" aria-hidden="true">
            <use href="#icon-fanye1"></use>
          </svg>
        </button>

        <button 
          className={styles.pre}
          onClick={() => {
          const nextPageIndex = yearPageIndex + 1;
          const nextStartYear = currentYear - nextPageIndex * 4;

          setYearPageIndex(nextPageIndex);
          setSelectedYear(nextStartYear);
        }}
        >
          <svg className="previous" aria-hidden="true">
            <use href="#icon-fanye2"></use>
          </svg>
        </button>
      </div>
    </div>


    </section>
  );
};

export default Contribution;
