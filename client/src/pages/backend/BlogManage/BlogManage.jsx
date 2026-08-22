const posts = [
  {
    title: '餐厅经营模拟游戏实战项目',
    category: 'web前端',
    tags: ['JavaScript', 'html'],
    views: 4,
    updatedAt: '2021-07-25',
  },
  {
    title: '博客系统评论功能的实现',
    category: 'web前端',
    tags: ['React', 'css'],
    views: 83,
    updatedAt: '2021-07-24',
  },
  {
    title: 'Nginx反向代理实现图片上传到Ubuntu服务器',
    category: 'java',
    tags: ['Nginx'],
    views: 73,
    updatedAt: '2021-07-23',
  },
  {
    title: '用原生CSS实现标签样式',
    category: 'web前端',
    tags: ['html', 'vue'],
    views: 475,
    updatedAt: '2021-07-01',
  },
];

const BlogManage = () => {
  return (
    <section>
      <div>首页 / 博客管理</div>
      <h2>博客管理</h2>

      <div>
        <input type="text" placeholder="标题" />
        <select defaultValue="">
          <option value="" disabled>分类</option>
          <option value="web前端">web前端</option>
          <option value="java">java</option>
        </select>
        <button type="button">清除</button>
        <button type="button">搜索</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>标题</th>
            <th>分类</th>
            <th>标签</th>
            <th>阅读量</th>
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.title}>
              <td>{post.title}</td>
              <td>{post.category}</td>
              <td>{post.tags.join(' / ')}</td>
              <td>{post.views}</td>
              <td>{post.updatedAt}</td>
              <td>
                <button type="button">改</button>
                <button type="button">删</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};

export default BlogManage;
