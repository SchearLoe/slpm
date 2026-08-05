import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import { LoginPage } from './pages/LoginPage';
import { AuthProvider } from './context/AuthContext';
import { QueryProvider } from './context/QueryProvider';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryProvider>
        <AuthProvider>
          <Routes>
            {/* 登录页：公开路由 */}
            <Route path="/login" element={<LoginPage />} />
            {/* 其余全部走 App（内含 RequireAuth 守卫） */}
            <Route path="/*" element={<App />} />
          </Routes>
        </AuthProvider>
      </QueryProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
