import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  protected readonly mock = environment.useMockApi;
  protected readonly nav = [
    { path: '/dashboard', label: 'Dashboard', icon: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z' },
    { path: '/ai-analytics', label: 'AI Analytics', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
    { path: '/admissions', label: 'Admissions', icon: 'M3 21V8l9-5 9 5v13M9 21v-6h6v6M12 7v4M10 9h4' },
    { path: '/revenue', label: 'Revenue', icon: 'M2 6h20v14H2zM2 10h20M16 15h2' },
    { path: '/claims', label: 'Claims and Denial', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5' },
    // AI Insights is hidden from the menu; the /insights route still works.
    // { path: '/insights', label: 'AI Insights', icon: 'M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3zM18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z' },
    { path: '/reports', label: 'Reports and Export', icon: 'M12 3v12M7 10l5 5 5-5M4 17v3h16v-3' },
    // Agent Monitor is hidden from the menu; the /agents route still works.
    // { path: '/agents', label: 'Agent Monitor', icon: 'M9 3h6v4H9zM4 11h16v10H4zM9 15h.01M15 15h.01M12 7v4' },
    { path: '/history', label: 'Query History', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2' },
  ];
}
