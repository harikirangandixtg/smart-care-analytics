import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell.component';

/** Routes follow the frontend spec (§2). Old paths redirect so existing links keep working. */
export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', title: 'Dashboard · Smart Care Analytics', loadComponent: () => import('./features/dashboard/dashboard.page').then(m => m.DashboardPage) },
      { path: 'admissions', title: 'Admissions · Smart Care Analytics', loadComponent: () => import('./features/admissions/admissions.page').then(m => m.AdmissionsPage) },
      { path: 'revenue', title: 'Revenue · Smart Care Analytics', loadComponent: () => import('./features/revenue/revenue.page').then(m => m.RevenuePage) },
      { path: 'claims', title: 'Claims & denials · Smart Care Analytics', loadComponent: () => import('./features/claims/claims.page').then(m => m.ClaimsPage) },
      { path: 'ai-analytics', title: 'AI Analytics · Smart Care Analytics', loadComponent: () => import('./features/ai-analytics/ai-analytics.page').then(m => m.AiAnalyticsPage) },
      { path: 'history', title: 'Query history · Smart Care Analytics', loadComponent: () => import('./features/history/history.page').then(m => m.HistoryPage) },
      { path: 'insights', title: 'AI Insights · Smart Care Analytics', loadComponent: () => import('./features/insights/insights.page').then(m => m.InsightsPage) },
      { path: 'reports', title: 'Reports & export · Smart Care Analytics', loadComponent: () => import('./features/reports/reports.page').then(m => m.ReportsPage) },
      { path: 'agents', title: 'Agent monitor · Smart Care Analytics', loadComponent: () => import('./features/agents/agents.page').then(m => m.AgentsPage) },
      { path: 'overview', redirectTo: 'dashboard' },
      { path: 'ask', redirectTo: 'ai-analytics' },
    ],
  },
  { path: '**', redirectTo: '' },
];
