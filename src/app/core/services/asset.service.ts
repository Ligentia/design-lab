import { Injectable, signal, computed, inject } from '@angular/core';
import { GithubService } from './github.service';
import { Asset } from '../models/asset.model';

@Injectable({ providedIn: 'root' })
export class AssetService {
  private github = inject(GithubService);

  private _assets = signal<Asset[]>([]);
  private _sha = signal<string>('');
  private _loading = signal(false);
  private _error = signal<string | null>(null);
  private _search = signal('');
  private _activeTypes = signal<Set<string>>(new Set());

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly search = this._search.asReadonly();
  readonly activeTypes = this._activeTypes.asReadonly();
  readonly sha = this._sha.asReadonly();

  readonly allTypes = computed(() => {
    const types = new Set<string>();
    this._assets().forEach((a) => types.add(a.type));
    return Array.from(types).sort();
  });

  readonly filtered = computed(() => {
    const q = this._search().toLowerCase().trim();
    const active = this._activeTypes();
    return this._assets()
      .filter((a) => {
        const matchesSearch =
          !q || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q);
        const matchesType = active.size === 0 || active.has(a.type);
        return matchesSearch && matchesType;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  load() {
    this._loading.set(true);
    this._error.set(null);
    this.github.getAssets().subscribe({
      next: ({ assets, sha }) => {
        this._assets.set(assets);
        this._sha.set(sha);
        this._loading.set(false);
      },
      error: (err) => {
        this._error.set('Could not load assets. Check your network or repo config.');
        this._loading.set(false);
        console.error(err);
      },
    });
  }

  clearPat() { sessionStorage.removeItem('dl_github_pat'); }

  setSearch(q: string) { this._search.set(q); }

  toggleType(type: string) {
    const current = new Set(this._activeTypes());
    current.has(type) ? current.delete(type) : current.add(type);
    this._activeTypes.set(current);
  }

  clearFilters() {
    this._search.set('');
    this._activeTypes.set(new Set());
  }

  addAsset(asset: Asset, pat: string) {
    const updated = [asset, ...this._assets()];
    return new Promise<void>((resolve, reject) => {
      this.github.saveAssets(updated, this._sha(), pat).subscribe({
        next: () => { this._assets.set(updated); resolve(); },
        error: reject,
      });
    });
  }

  updateAsset(updated: Asset, pat: string) {
    const list = this._assets().map((a) => (a.id === updated.id ? updated : a));
    return new Promise<void>((resolve, reject) => {
      this.github.saveAssets(list, this._sha(), pat).subscribe({
        next: () => { this._assets.set(list); resolve(); },
        error: reject,
      });
    });
  }
}
