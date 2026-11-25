import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map, switchMap, forkJoin, of, catchError, firstValueFrom } from 'rxjs';
import { Prototype } from '../models/prototype.model';
import { Asset } from '../models/asset.model';
import { Collection } from '../models/collection.model';
import { environment } from '../../../environments/environment';

interface GitHubFileResponse {
  content: string;
  sha: string;
  encoding: string;
}

/** prototypes.json as stored in the repo, base64 for the GitHub APIs. */
export function encodePrototypes(prototypes: Prototype[]): string {
  return btoa(JSON.stringify(prototypes, null, 2));
}

/** A file to write in a commit. `content` is base64, like the Contents API. */
export interface CommitFile {
  path: string;
  content: string;
}

/** Thrown when a file changed on GitHub since it was loaded, so saving would overwrite someone. */
export class GithubConflictError extends Error {
  readonly status = 409;
}

// Parallel blob uploads. Enough to be quick, few enough to stay clear of
// GitHub's secondary rate limit on content creation.
const BLOB_CONCURRENCY = 4;
const REF_RETRIES = 3;

@Injectable({ providedIn: 'root' })
export class GithubService {
  private http = inject(HttpClient);
  private repo = `https://api.github.com/repos/${environment.githubOwner}/${environment.githubRepo}`;
  private base = `${this.repo}/contents`;

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
    const content = encodePrototypes(prototypes);
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

  /**
   * Writes every file as ONE commit on the branch, via the Git Data API.
   *
   * Why not the Contents API: it makes a commit per file, and every commit to
   * main is a Vercel deployment. A 90-file ZIP upload tripped Vercel's daily
   * deployment limit and left the live site half-updated. Blobs don't create
   * commits, so only the final ref update deploys.
   *
   * `expect` guards a file against lost updates, like the Contents API's `sha`:
   * if that path's blob on the branch isn't `sha`, nothing is written and a
   * GithubConflictError is thrown. If the branch moves between building the
   * commit and updating the ref, the commit is rebuilt on the new head (the
   * blobs are reused) and the guard is checked again.
   *
   * Returns each path's blob SHA, which equals the Contents API `sha`.
   */
  async commitFiles(
    files: CommitFile[],
    message: string,
    pat: string,
    opts: {
      expect?: { path: string; sha: string };
      onProgress?: (done: number, total: number) => void;
    } = {}
  ): Promise<Map<string, string>> {
    const headers = new HttpHeaders({ Authorization: `token ${pat}` });
    const branch = environment.githubBranch;

    const blobs = new Map<string, string>();
    let done = 0;
    const queue = [...files];
    const worker = async () => {
      for (let f = queue.shift(); f; f = queue.shift()) {
        const res = await firstValueFrom(
          this.http.post<{ sha: string }>(
            `${this.repo}/git/blobs`,
            { content: f.content, encoding: 'base64' },
            { headers }
          )
        );
        blobs.set(f.path, res.sha);
        opts.onProgress?.(++done, files.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(BLOB_CONCURRENCY, files.length) }, worker));

    for (let attempt = 1; ; attempt++) {
      const ref = await firstValueFrom(
        this.http.get<{ object: { sha: string } }>(`${this.repo}/git/ref/heads/${branch}`, { headers })
      );
      const head = ref.object.sha;

      if (opts.expect) {
        const current = await firstValueFrom(
          this.http
            .get<{ sha: string }>(`${this.base}/${opts.expect.path}?ref=${head}`, { headers })
            .pipe(
              map((r) => r.sha),
              catchError(() => of(''))
            )
        );
        if (current !== opts.expect.sha) {
          throw new GithubConflictError(
            `${opts.expect.path} changed on GitHub since this page loaded. Reload and try again — nothing was saved.`
          );
        }
      }

      const headCommit = await firstValueFrom(
        this.http.get<{ tree: { sha: string } }>(`${this.repo}/git/commits/${head}`, { headers })
      );
      const tree = await firstValueFrom(
        this.http.post<{ sha: string }>(
          `${this.repo}/git/trees`,
          {
            base_tree: headCommit.tree.sha,
            tree: files.map((f) => ({ path: f.path, mode: '100644', type: 'blob', sha: blobs.get(f.path) })),
          },
          { headers }
        )
      );
      const commit = await firstValueFrom(
        this.http.post<{ sha: string }>(
          `${this.repo}/git/commits`,
          { message, tree: tree.sha, parents: [head] },
          { headers }
        )
      );

      try {
        await firstValueFrom(
          this.http.patch(`${this.repo}/git/refs/heads/${branch}`, { sha: commit.sha }, { headers })
        );
        return blobs;
      } catch (err: any) {
        // 422 = not a fast-forward: someone else committed meanwhile. Rebuild on their head.
        if (err?.status !== 422 || attempt >= REF_RETRIES) throw err;
      }
    }
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
