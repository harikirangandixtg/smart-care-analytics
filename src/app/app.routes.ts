import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      { path: 'overview', title: 'Overview · Smart Care Analytics', loadComponent: () => import('./dashboard/overview.page').then(m => m.OverviewPage) },
      { path: 'ask', title: 'Ask analytics · Smart Care Analytics', loadComponent: () => import('./analytics-chat/ask.page').then(m => m.AskPage) },
      { path: 'claims', title: 'Claims & payers · Smart Care Analytics', loadComponent: () => import('./claims/claims.page').then(m => m.ClaimsPage) },
      { path: 'history', title: 'Query history · Smart Care Analytics', loadComponent: () => import('./history/history.page').then(m => m.HistoryPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
