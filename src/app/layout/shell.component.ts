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
    { path: '/admissions', label: 'Admissions', icon: 'M3 21V8l9-5 9 5v13M9 21v-6h6v6M12 7v4M10 9h4' },
    { path: '/revenue', label: 'Revenue', icon: 'M2 6h20v14H2zM2 10h20M16 15h2' },
    { path: '/claims', label: 'Claims & denials', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5' },
    { path: '/ai-analytics', label: 'AI Analytics', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
    { path: '/history', label: 'Query history', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2' },
  ];
}
