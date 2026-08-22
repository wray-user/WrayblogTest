import './App.css';
import Home from './pages/frontend/Home/Home';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './service/login/login'; 
import Admin from './pages/backend/Admin/Admin';
import AdHome from './pages/backend/AdHome/AdHome';
import BlogManage from './pages/backend/BlogManage/BlogManage';
import UserManage from './pages/backend/UserManage/UserManage';
import BlogWrite from './pages/backend/BlogWrite/BlogWrite';
import WriteTech from './pages/backend/BlogWrite/WriteTech/WriteTech';
import WriteStudy from './pages/backend/BlogWrite/WriteStudy/WriteStudy';
// import WriteNote from './pages/backend/BlogWrite/WriteNote/WriteNote';


function App() {
  return (
    <div id="App" className="appShell">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        <Route path="/admin" element={<Admin />}>
          <Route index element={<Navigate to="/admin/home" replace />} />
          <Route path="home" element={<AdHome />} />
          <Route path="posts" element={<BlogManage />} />
          <Route path="users" element={<UserManage />} />
          {/* <Route path="write" element={<BlogWrite />} /> */}

          <Route path="write" element={<BlogWrite />}>
            <Route index element={<Navigate to="/admin/write/tech" replace />} />
            <Route path="tech" element={<WriteTech />} />
            <Route path="study" element={<WriteStudy />} />
            {/* <Route path="tech" element={<WriteTech />} /> */}
          </Route>
        </Route>
      </Routes>
    </div>
  );
}

export default App;
