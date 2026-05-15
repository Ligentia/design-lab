import { Component, inject } from '@angular/core';
import { RouterModule, RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { UiStateService } from './core/services/ui-state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterModule, CommonModule],
  template: `
    <header class="header">
      <div class="header-inner">
        <a class="brand" routerLink="/">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="3" y="3" width="7" height="7" rx="1.5"/>
            <rect x="14" y="3" width="7" height="7" rx="1.5"/>
            <rect x="3" y="14" width="7" height="7" rx="1.5"/>
            <rect x="14" y="14" width="7" height="7" rx="1.5"/>
          </svg>
          <span class="brand-name">Design Lab</span>
        </a>

        <nav class="tabs">
          <a class="tab" routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
            Prototypes
          </a>
          <a class="tab" routerLink="/assets" routerLinkActive="active">
            Assets
          </a>
          <a class="tab" routerLink="/archived" routerLinkActive="active">
            Archived
          </a>
        </nav>

        <button class="add-btn" *ngIf="!isArchivedRoute()" (click)="ui.triggerAdd()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          {{ isAssetsRoute() ? 'Add asset' : 'Add prototype' }}
        </button>
      </div>
    </header>

    <main class="main">
      <router-outlet />
    </main>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; min-height: 100vh; }
    .header { border-bottom: 1px solid var(--color-border); background: var(--color-surface); position: sticky; top: 0; z-index: 10; }
    .header-inner { max-width: 1280px; margin: 0 auto; padding: 0 var(--space-6); height: 56px; display: flex; align-items: center; gap: var(--space-6); }
    .brand { display: flex; align-items: center; gap: var(--space-3); color: var(--color-text-primary); text-decoration: none; flex-shrink: 0; }
    .brand-name { font-size: var(--text-base); font-weight: var(--weight-semibold); letter-spacing: -0.01em; }
    .tabs { display: flex; gap: 2px; flex: 1; }
    .tab { font-size: var(--text-sm); font-weight: var(--weight-medium); color: var(--color-text-secondary); text-decoration: none; padding: 6px 12px; border-radius: var(--radius-sm); transition: color var(--transition-fast), background var(--transition-fast); }
    .tab:hover { color: var(--color-text-primary); background: var(--color-surface-hover); }
    .tab.active { color: var(--color-text-primary); background: var(--color-surface-hover); }
    .add-btn { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); font-weight: var(--weight-medium); font-family: var(--font-sans); color: #fff; background: var(--color-accent); border: none; border-radius: var(--radius-sm); padding: 7px 14px; cursor: pointer; transition: background var(--transition-fast); white-space: nowrap; margin-left: auto; }
    .add-btn:hover { background: var(--color-accent-hover); }
    .main { flex: 1; max-width: 1280px; margin: 0 auto; width: 100%; padding: var(--space-8) var(--space-6); box-sizing: border-box; }
    @media (max-width: 640px) { .header-inner { padding: 0 var(--space-4); } .main { padding: var(--space-6) var(--space-4); } .brand-name { display: none; } }
  `]
})
export class AppComponent {
  ui = inject(UiStateService);
  private router = inject(Router);

  isAssetsRoute(): boolean {
    return this.router.url.startsWith('/assets');
  }

  isArchivedRoute(): boolean {
    return this.router.url.startsWith('/archived');
  }
}
