import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map, switchMap, forkJoin, of, catchError } from 'rxjs';
import { Prototype } from '../models/prototype.model';
import { Asset } from '../models/asset.model';
import { Collection } from '../models/collection.model';
import { environment } from '../../../environments/environment';

interface GitHubFileResponse {
  content: string;
  sha: string;
  encoding: string;
}

@Injectable({ providedIn: 'root' })
export class GithubService {
  private http = inject(HttpClient);
  private base = `https://api.github.com/repos/${environment.githubOwner}/${environment.githubRepo}/contents`;

  getPrototypes(): Observable<{ prototypes: Prototype[]; sha: string }> {
    return this.http
      .get<GitHubFileResponse>(`${this.base}/prototypes.json`)
      .pipe(
        map((res) => ({
          prototypes: JSON.parse(atob(res.content.replace(/\n/g, ''))) as Prototype[],
          sha: res.sha,
        }))
      );
  }

  savePrototypes(prototypes: Prototype[], sha: string, pat: string): Observable<unknown> {
    const headers = new HttpHeaders({ Authorization: `token ${pat}` });
    const content = btoa(JSON.stringify(prototypes, null, 2));
    return this.http.put(
      `${this.base}/prototypes.json`,
      { message: 'Update prototypes.json via Design Lab', content, sha, branch: environment.githubBranch },
      { headers }
    );
  }

  getAssets(): Observable<{ assets: Asset[]; sha: string }> {
    return this.http
      .get<GitHubFileResponse>(`${this.base}/assets.json`)
      .pipe(
        map((res) => ({
          assets: JSON.parse(atob(res.content.replace(/\n/g, ''))) as Asset[],
          sha: res.sha,
        }))
      );
  }

  saveAssets(assets: Asset[], sha: string, pat: string): Observable<unknown> {
    const headers = new HttpHeaders({ Authorization: `token ${pat}` });
    const content = btoa(JSON.stringify(assets, null, 2));
    return this.http.put(
      `${this.base}/assets.json`,
      { message: 'Update assets.json via Design Lab', content, sha, branch: environment.githubBranch },
      { headers }
    );
  }

  getCollections(): Observable<{ collections: Collection[]; sha: string }> {
    return this.http
      .get<GitHubFileResponse>(`${this.base}/collections.json`)
      .pipe(
        map((res) => ({
          collections: JSON.parse(atob(res.content.replace(/\n/g, ''))) as Collection[],
          sha: res.sha,
        })),
        // collections.json won't exist until the first folder is created — treat
        // a 404 (or any read failure) as an empty, unsaved list rather than an error.
        catchError(() => of({ collections: [] as Collection[], sha: '' }))
      );
  }

  saveCollections(collections: Collection[], sha: string, pat: string): Observable<unknown> {
    const headers = new HttpHeaders({ Authorization: `token ${pat}` });
    const content = btoa(JSON.stringify(collections, null, 2));
    const body: Record<string, unknown> = {
      message: 'Update collections.json via Design Lab',
      content,
      branch: environment.githubBranch,
    };
    // No SHA on first save (file doesn't exist yet); include it for updates.
    if (sha) body['sha'] = sha;
    return this.http.put(`${this.base}/collections.json`, body, { headers });
  }

  uploadFile(path: string, base64Content: string, pat: string): Observable<unknown> {
    const headers = new HttpHeaders({ Authorization: `token ${pat}` });
    return this.http.get<{ sha: string }>(`${this.base}/${path}`, { headers }).pipe(
      map(res => res.sha),
      catchError(() => of(undefined)),
      switchMap(sha => {
        const body: Record<string, unknown> = {
          message: `Upload ${path} via Design Lab`,
          content: base64Content,
          branch: environment.githubBranch,
        };
        if (sha) body['sha'] = sha;
        return this.http.put(`${this.base}/${path}`, body, { headers });
      })
    );
  }

  getFolderFiles(folder: string): Observable<{ name: string; content: string }[]> {
    return this.http
      .get<{ name: string; type: string; content?: string; download_url: string }[]>(
        `${this.base}/${folder}`
      )
      .pipe(
        switchMap(items => {
          const files = items.filter(i => i.type === 'file');
          return forkJoin(
            files.map(f =>
              f.content
                ? of({ name: f.name, content: atob(f.content.replace(/\n/g, '')) })
                : this.http.get(f.download_url, { responseType: 'text' }).pipe(
                    map(text => ({ name: f.name, content: text }))
                  )
            )
          );
        })
      );
  }
}
