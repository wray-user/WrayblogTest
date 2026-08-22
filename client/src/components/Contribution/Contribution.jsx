import { useMemo, useState } from 'react';
import styles from './Contribution.module.css';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const weeks = ['Sun', 'Mon','Tue','Wed','Thu','Fri','Sat'];


const Contribution = ({ posts }) => {

  // 设置年份
  const currentYear = new Date().getFullYear();
  const [yearPageIndex, setYearPageIndex] = useState(0);

  const years = useMemo(() => {
    const startYear = currentYear - yearPageIndex * 4;

    return Array.from({length:4}, (_, index) => startYear - index);
  }, [currentYear, yearPageIndex]);

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const year = selectedYear;
  const firstDay = new Date(year, 0, 1); 
  const daysInYear = new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;


// 每天的位置(特别是1.1)
  const Days = Array.from({ length: daysInYear }, (_, index) => {
    const date = new Date(year, 0, index + 1);
    const offset = firstDay.getDay() + index;
    return {
      index,
      row: date.getDay() + 1,
      column: Math.floor(offset / 7) + 1,
    };
  });

// 每个月在第几列、占几列
  const totalColumns = Math.max(...Days.map((day) => day.column));
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
            <h3>{13} contributions in {year}</h3>
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
  {/* 贡献图方格 */}
            {Days.map((day) => (
              <span
                key={day.index}
                className={styles.cell}
                style={{
                  gridRow: day.row,
                  gridColumn: day.column,
                }}
                // data-level={
                //   day.index % 37 === 0
                //     ? 4
                //     : day.index % 23 === 0
                //       ? 3
                //       : day.index % 17 === 0
                //         ? 2
                //         : day.index % 11 === 0
                //           ? 1
                //           : 0
                // }
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
