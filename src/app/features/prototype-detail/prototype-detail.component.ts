import { Component, OnInit, inject, signal, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PrototypeService } from '../../core/services/prototype.service';
import { Prototype } from '../../core/models/prototype.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'dl-prototype-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="detail-page">
      <a class="back-link" routerLink="/">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        All prototypes
      </a>

      <div *ngIf="svc.loading()" class="state-msg">
        <span class="spinner"></span> Loading…
      </div>

      <div *ngIf="svc.error() && !svc.loading()" class="state-msg error">
        {{ svc.error() }}
      </div>

      <div *ngIf="!svc.loading() && !svc.error() && !proto()" class="state-msg">
        Prototype not found.
        <a routerLink="/" class="link">Back to dashboard</a>
      </div>

      <ng-container *ngIf="!svc.loading() && proto() as p">
        <div class="layout">
          <div class="preview-pane">
            <div class="preview-header">
              <span class="preview-label">Preview</span>
              <div class="preview-actions">
                <a *ngIf="!iframeError" class="gh-link" [href]="prototypeUrl(p)" target="_blank" rel="noopener">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  Open in new tab
                </a>
                <a class="gh-link" [href]="githubFolderUrl(p)" target="_blank" rel="noopener">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/>
                  </svg>
                  GitHub
                </a>
              </div>
            </div>
            <div class="iframe-wrap">
              <iframe
                *ngIf="!iframeError"
                #previewFrame
                [src]="iframeUrl(p)"
                sandbox="allow-scripts allow-same-origin"
                title="Prototype preview"
                (load)="onIframeLoad(previewFrame)"
                (error)="onIframeError()"
              ></iframe>
              <div *ngIf="iframeError" class="no-preview">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M12 8v4M12 16h.01"/>
                </svg>
                <p>No explorations added yet</p>
                <p class="no-preview-hint">Add an <code>index.html</code> to <code>{{ p.folder }}</code> and push to GitHub.</p>
              </div>
            </div>
          </div>

          <aside class="meta-pane">
            <div>
              <h1 class="title">{{ p.title }}</h1>
              <p *ngIf="p.description" class="description">{{ p.description }}</p>
            </div>
            <dl class="meta-list">
              <div class="meta-row">
                <dt>Creator</dt><dd>{{ p.creator }}</dd>
              </div>
              <div class="meta-row">
                <dt>Date</dt><dd>{{ p.date | date:'MMM d, y' }}</dd>
              </div>
              <div class="meta-row" *ngIf="p.tags.length">
                <dt>Tags</dt>
                <dd><span class="tags"><span *ngFor="let t of p.tags" class="tag">{{ t }}</span></span></dd>
              </div>
            </dl>
            <button class="btn-primary" (click)="copyShareLink()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
              </svg>
              {{ copied ? 'Link copied!' : 'Copy shareable link' }}
            </button>
            <button class="btn-secondary" *ngIf="!iframeError" (click)="download(p)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Download files
            </button>
          </aside>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .detail-page { max-width: 1280px; margin: 0 auto; padding: var(--space-8) var(--space-6); }
    .back-link {
      display: inline-flex; align-items: center; gap: var(--space-2);
      font-size: var(--text-sm); font-weight: var(--weight-medium);
      color: var(--color-text-secondary); text-decoration: none;
      margin-bottom: var(--space-6);
      transition: color var(--transition-fast);
    }
    .back-link:hover { color: var(--color-text-primary); }
    .layout { display: grid; grid-template-columns: 1fr 300px; gap: var(--space-8); align-items: start; }
    .preview-pane { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); overflow: hidden; }
    .preview-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border);
      background: var(--color-surface-subtle);
    }
    .preview-label { font-size: var(--text-xs); font-weight: var(--weight-medium); color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: .06em; }
    .preview-actions { display: flex; align-items: center; gap: var(--space-4); }
    .gh-link { display: flex; align-items: center; gap: var(--space-1); font-size: var(--text-xs); color: var(--color-text-secondary); text-decoration: none; transition: color var(--transition-fast); }
    .gh-link:hover { color: var(--color-accent); }
    .iframe-wrap { aspect-ratio: 16/10; background: var(--color-surface-subtle); }
    iframe { width: 100%; height: 100%; border: none; display: block; }
    .no-preview { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-3); height: 100%; color: var(--color-text-tertiary); padding: var(--space-12); }
    .no-preview p { font-size: var(--text-sm); margin: 0; }
    .no-preview-hint { font-size: var(--text-xs) !important; color: var(--color-text-tertiary) !important; margin-top: var(--space-1) !important; text-align: center; }
    .no-preview-hint code { font-family: var(--font-mono); background: var(--color-surface-hover); border-radius: 3px; padding: 1px 4px; }
    .meta-pane { display: flex; flex-direction: column; gap: var(--space-5); position: sticky; top: calc(56px + var(--space-6)); }
    .title { font-size: var(--text-2xl); font-weight: var(--weight-semibold); color: var(--color-text-primary); line-height: 1.25; }
    .description { font-size: var(--text-base); color: var(--color-text-secondary); line-height: 1.6; margin: var(--space-2) 0 0; }
    .meta-list { display: flex; flex-direction: column; gap: var(--space-3); margin: 0; padding: 0; }
    .meta-row { display: flex; flex-direction: column; gap: 2px; }
    dt { font-size: var(--text-xs); font-weight: var(--weight-medium); color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: .06em; }
    dd { font-size: var(--text-sm); color: var(--color-text-primary); margin: 0; }
    .tags { display: flex; flex-wrap: wrap; gap: var(--space-1); }
    .tag { font-size: var(--text-xs); font-weight: var(--weight-medium); color: var(--color-tag-text); background: var(--color-tag-bg); border-radius: var(--radius-full); padding: 2px 8px; }
    .btn-primary {
      display: flex; align-items: center; justify-content: center; gap: var(--space-2);
      font-size: var(--text-sm); font-weight: var(--weight-medium); font-family: var(--font-sans);
      color: #fff; background: var(--color-accent); border: none; border-radius: var(--radius-sm);
      padding: 10px 20px; cursor: pointer; width: 100%;
      transition: background var(--transition-fast);
    }
    .btn-primary:hover { background: var(--color-accent-hover); }
    .state-msg { display: flex; align-items: center; gap: var(--space-3); font-size: var(--text-sm); color: var(--color-text-secondary); padding: var(--space-10) 0; }
    .state-msg.error { color: var(--color-danger); }
    .link { color: var(--color-accent); margin-left: var(--space-2); }
    .spinner { width: 16px; height: 16px; border: 2px solid var(--color-border); border-top-color: var(--color-accent); border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 768px) { .layout { grid-template-columns: 1fr; } .meta-pane { position: static; } }
  `]
})
export class PrototypeDetailComponent implements OnInit {
  svc = inject(PrototypeService);
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);

  proto = signal<Prototype | null>(null);
  copied = false;
  iframeError = false;
  private _urlCache = new Map<string, SafeResourceUrl>();

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;

    const tryFind = () => {
      const found = this.svc.findById(id);
      if (found) { this.proto.set(found); return true; }
      return false;
    };

    if (!tryFind()) {
      this.svc.load();
      const interval = setInterval(() => {
        if (!this.svc.loading()) {
          clearInterval(interval);
          tryFind();
        }
      }, 100);
    }
  }

  prototypeUrl(p: Prototype): string {
    return `${window.location.origin}/${p.folder}/index.html`;
  }

  githubFolderUrl(p: Prototype): string {
    return `https://github.com/${environment.githubOwner}/${environment.githubRepo}/tree/${environment.githubBranch}/${p.folder}`;
  }

  iframeUrl(p: Prototype): SafeResourceUrl {
    if (!this._urlCache.has(p.folder)) {
      const url = `${window.location.origin}/${p.folder}/index.html`;
      this._urlCache.set(p.folder, this.sanitizer.bypassSecurityTrustResourceUrl(url));
    }
    return this._urlCache.get(p.folder)!;
  }

  onIframeError() {
    this.iframeError = true;
    this.cdr.markForCheck();
  }

  onIframeLoad(iframe: HTMLIFrameElement) {
    try {
      const isShell = !!iframe.contentDocument?.querySelector('meta[name="dl-shell"]');
      if (isShell) {
        this.iframeError = true;
        this.cdr.markForCheck();
      }
    } catch {
      // cross-origin guard — shouldn't happen for same-origin but safe to swallow
    }
  }

  download(p: Prototype) { this.svc.downloadAsZip(p); }

  copyShareLink() {
    const id = this.route.snapshot.paramMap.get('id');
    navigator.clipboard.writeText(`${window.location.origin}/prototype/${id}`).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    });
  }
}
