import './App.css';
import Home from './pages/frontend/Home/Home';
import { useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import Login from './service/login/login'; 
import Admin from './pages/backend/Admin/Admin';
import AdHome from './pages/backend/AdHome/AdHome';
import BlogManage from './pages/backend/BlogManage/BlogManage';
import UserManage from './pages/backend/UserManage/UserManage';
import ProfileCenter from './pages/backend/ProfileCenter/ProfileCenter';
import CategoryManage from './pages/backend/CategoryManage/CategoryManage';
import TagManage from './pages/backend/TagManage/TagManage';
import BlogWrite from './pages/backend/BlogWrite/BlogWrite';
import WriteTech from './pages/backend/BlogWrite/WriteTech/WriteTech';
import WriteStudy from './pages/backend/BlogWrite/WriteStudy/WriteStudy';
import WriteNote from './pages/backend/BlogWrite/WriteNote/WriteNote';
import TechSharings from './pages/frontend/TechSharings/TechSharings';
import StudyRecords from './pages/frontend/StudyRecords/StudyRecords';
import MoodNotes from './pages/frontend/MoodNotes/MoodNotes';

const VisitTracker = () => {
  const location = useLocation();
  const lastKeyRef = useRef('');

  useEffect(() => {
    const path = `${location.pathname}${location.search}`;

    if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/login')) {
      return;
    }

    const now = Date.now();
    const cacheKey = 'wray-last-visit';
    const routeKey = path;

    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey) || '{}');
      if (
        cached.routeKey === routeKey
        && Number(cached.time || 0) > now - 5000
      ) {
        return;
      }

      sessionStorage.setItem(cacheKey, JSON.stringify({ routeKey, time: now }));
    } catch {
      // Tracking is best-effort; routing should never depend on storage.
    }

    if (lastKeyRef.current === routeKey) {
      return;
    }

    lastKeyRef.current = routeKey;

    const searchParams = new URLSearchParams(location.search);
    const body = JSON.stringify({
      path,
      pageTitle: document.title,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      postId: searchParams.get('post') || '',
    });

    fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }, [location.pathname, location.search]);

  return null;
};


function App() {
  return (
    <div id="App" className="appShell">
      <VisitTracker />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/mood" element={<MoodNotes />} />
        <Route path="/tech" element={<TechSharings />} />
        <Route path="/study" element={<StudyRecords />} />

        <Route path="/admin" element={<Admin />}>
          <Route index element={<Navigate to="/admin/home" replace />} />
          <Route path="home" element={<AdHome />} />
          <Route path="posts" element={<BlogManage key="posts" manageName="分享" excludeCategories="学习记录,心情随笔" editPath="/admin/write/tech" emptyText="暂无技术分享文章" />} />
          <Route path="studies" element={<BlogManage key="studies" manageName="??" fixedCategory="学习记录" editPath="/admin/write/study" emptyText="暂无学习记录" />} />
          <Route path="note" element={<BlogManage key="note" manageName="随笔" fixedCategory="心情随笔" editPath="/admin/write/note" emptyText="暂无心情随笔" />} />
          <Route path="users" element={<UserManage />} />
          <Route path="profile" element={<ProfileCenter />} />
          <Route path="categories" element={<CategoryManage />} />
          <Route path="tags" element={<TagManage />} />
          <Route path="write" element={<BlogWrite />}>
            <Route index element={<Navigate to="/admin/write/tech" replace />} />
            <Route path="tech" element={<WriteTech />} />
            <Route path="study" element={<WriteStudy />} />
            <Route path="note" element={<WriteNote />} />
          </Route>
        </Route>
      </Routes>
    </div>
  );
}

export default App;
