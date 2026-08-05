import React, { useRef, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { TaskManagementPage } from '@/pages/TaskManagementPage';
import { ProjectOverviewPage } from '@/pages/ProjectOverviewPage';
import { FileDocumentsPage } from '@/pages/FileDocumentsPage';
import { ScheduleManagementPage } from '@/pages/ScheduleManagementPage';
import { TeamCollaborationPage } from '@/pages/TeamCollaborationPage';
import { AIAnalyticsPage } from '@/pages/AIAnalyticsPage';
import { KnowledgeBasePage } from '@/pages/KnowledgeBasePage';
import { SettingsCenterPage } from '@/pages/SettingsCenterPage';
import { ProductManagementPage } from '@/pages/ProductManagementPage';
import { TaskDetailPage } from '@/pages/TaskDetailPage';
import { NewTaskModal } from '@/components/modals/NewTaskModal';
import { EditTaskModal } from '@/components/modals/EditTaskModal';
import { NavTab } from '@/types';
import { getRoleConfig } from '@/lib/roleConfig';
import { AppProvider, useApp } from '@/context/AppContext';
import { RouteTransition } from '@/components/ui/PageTransition';
import { RequireAuth } from '@/components/RequireAuth';

// 路由路径 ↔ NavTab 映射
const TAB_ORDER: NavTab[] = [
  'product',
  'tasks',
  'overview',
  'files',
  'schedule',
  'collaboration',
  'analytics',
  'knowledge',
  'settings',
];

const PATH_TO_TAB: Record<string, NavTab> = {
  '/product': 'product',
  '/tasks': 'tasks',
  '/overview': 'overview',
  '/files': 'files',
  '/schedule': 'schedule',
  '/collaboration': 'collaboration',
  '/analytics': 'analytics',
  '/knowledge': 'knowledge',
  '/settings': 'settings',
};

function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isNewTaskOpen, setIsNewTaskOpen, currentRole } = useApp();
  const prevTabIndex = useRef(0);
  const [direction, setDirection] = useState(1);

  // P2-1：根据角色着陆页重定向（仅根路径 / 时触发）
  const roleCfg = getRoleConfig(currentRole);
  React.useEffect(() => {
    if (location.pathname === '/') {
      navigate(`/${roleCfg.landingPage}`, { replace: true });
    }
  }, [location.pathname, roleCfg.landingPage, navigate]);

  // 从 URL 推导当前 NavTab
  const activeTab = PATH_TO_TAB[location.pathname] ?? 'tasks';

  // 导航切换：保留原方向动画逻辑
  const handleTabChange = (tab: NavTab) => {
    const to = TAB_ORDER.indexOf(tab);
    setDirection(to >= prevTabIndex.current ? 1 : -1);
    prevTabIndex.current = to;
    navigate('/' + tab);
  };

  // routeKey 用当前 tab，驱动 RouteTransition 切换动画
  const routeKey = activeTab;

  const getPageTitle = (tab: NavTab) => {
    switch (tab) {
      case 'product':
        return { title: '产品管理', subtitle: '产品线聚合 · 跨项目需求与版本进度' };
      case 'tasks':
        return { title: '任务管理', subtitle: '高效规划 · 智能协同 · 结果驱动' };
      case 'overview':
        return { title: '项目总览', subtitle: '全景里程碑 · 研发健康度与进度跟进' };
      case 'files':
        return { title: '文件归档', subtitle: '归档沉淀 · 多维搜索与历史版本可溯' };
      case 'schedule':
        return { title: '日程管理', subtitle: '智能日历 · 会议排期与冲突预警' };
      case 'collaboration':
        return { title: '团队协作', subtitle: '实时矩阵 · 成员负载与任务指派' };
      case 'analytics':
        return { title: '智能分析', subtitle: 'AI 效能推演 · 链路瓶颈与风险评估' };
      case 'knowledge':
        return { title: '知识库', subtitle: '沉淀最佳实践 · 团队 SOP 规格标准' };
      case 'settings':
        return { title: '设置中心', subtitle: '自定义液态玻璃视觉与协同偏好' };
    }
  };

  const pageInfo = getPageTitle(activeTab);

  return (
    <div className="w-full h-screen liquid-shell text-white overflow-hidden font-sans">
      <div className="app-frame relative z-10">
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />

        <div className="main-stack min-h-0">
          <TopBar title={pageInfo.title} subtitle={pageInfo.subtitle} titleKey={activeTab} />

          <main className="flex-1 min-h-0 overflow-hidden relative">
            {/* 页面切换遮罩光效 */}
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
              <div className="absolute -top-20 left-1/3 w-72 h-72 bg-emerald-500/5 blur-[100px] rounded-full" />
            </div>

            <RouteTransition
              routeKey={routeKey}
              direction={direction}
              className="relative z-10 w-full h-full overflow-y-auto overflow-x-hidden"
            >
              <Routes location={location}>
                <Route path="/product" element={<ProductManagementPage />} />
                <Route path="/tasks" element={<TaskManagementPage />} />
                <Route path="/tasks/:id" element={<TaskDetailPage />} />
                <Route path="/overview" element={<ProjectOverviewPage />} />
                <Route path="/files" element={<FileDocumentsPage />} />
                <Route path="/schedule" element={<ScheduleManagementPage />} />
                <Route path="/collaboration" element={<TeamCollaborationPage />} />
                <Route path="/analytics" element={<AIAnalyticsPage />} />
                <Route path="/knowledge" element={<KnowledgeBasePage />} />
                <Route path="/settings" element={<SettingsCenterPage />} />
                <Route path="*" element={<Navigate to="/tasks" replace />} />
              </Routes>
            </RouteTransition>
          </main>
        </div>
      </div>

      <NewTaskModal isOpen={isNewTaskOpen} onClose={() => setIsNewTaskOpen(false)} />
      <EditTaskModal />
    </div>
  );
}

// 应用外壳：Provider 层 + 路由守卫
function AuthedApp() {
  return (
    <RequireAuth>
      <MainLayout />
    </RequireAuth>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AuthedApp />
    </AppProvider>
  );
}
