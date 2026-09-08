import { Injectable, signal, computed, inject } from '@angular/core';
import { GithubService } from './github.service';
import { Collection } from '../models/collection.model';

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private github = inject(GithubService);

  private _collections = signal<Collection[]>([]);
  private _sha = signal<string>('');
  private _loading = signal(false);
  private _error = signal<string | null>(null);
  private _search = signal('');

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly search = this._search.asReadonly();
  readonly sha = this._sha.asReadonly();
  readonly all = this._collections.asReadonly();

  findById(id: string): Collection | undefined {
    return this._collections().find((c) => c.id === id);
  }

  readonly filtered = computed(() => {
    const q = this._search().toLowerCase().trim();
    return this._collections()
      .filter((c) => {
        return (
          !q ||
          c.name.toLowerCase().includes(q) ||
          (c.description ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  load() {
    this._loading.set(true);
    this._error.set(null);
    this.github.getCollections().subscribe({
      next: ({ collections, sha }) => {
        this._collections.set(collections);
        this._sha.set(sha);
        this._loading.set(false);
      },
      error: (err) => {
        this._error.set('Could not load folders. Check your network or repo config.');
        this._loading.set(false);
        console.error(err);
      },
    });
  }

  clearPat() { sessionStorage.removeItem('dl_github_pat'); }

  setSearch(q: string) { this._search.set(q); }

  addCollection(collection: Collection, pat: string) {
    const updated = [collection, ...this._collections()];
    return new Promise<void>((resolve, reject) => {
      this.github.saveCollections(updated, this._sha(), pat).subscribe({
        next: (res: any) => {
          this._collections.set(updated);
          if (res?.content?.sha) this._sha.set(res.content.sha);
          resolve();
        },
        error: reject,
      });
    });
  }

  updateCollection(updated: Collection, pat: string) {
    const list = this._collections().map((c) => (c.id === updated.id ? updated : c));
    return new Promise<void>((resolve, reject) => {
      this.github.saveCollections(list, this._sha(), pat).subscribe({
        next: (res: any) => {
          this._collections.set(list);
          if (res?.content?.sha) this._sha.set(res.content.sha);
          resolve();
        },
        error: reject,
      });
    });
  }

  deleteCollection(id: string, pat: string) {
    const list = this._collections().filter((c) => c.id !== id);
    return new Promise<void>((resolve, reject) => {
      this.github.saveCollections(list, this._sha(), pat).subscribe({
        next: (res: any) => {
          this._collections.set(list);
          if (res?.content?.sha) this._sha.set(res.content.sha);
          resolve();
        },
        error: reject,
      });
    });
  }
}
