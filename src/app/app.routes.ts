import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'assets',
    loadComponent: () =>
      import('./features/assets/assets.component').then((m) => m.AssetsComponent),
  },
  {
    path: 'archived',
    loadComponent: () =>
      import('./features/archived/archived.component').then((m) => m.ArchivedComponent),
  },
  {
    path: 'prototype/:id',
    loadComponent: () =>
      import('./features/prototype-detail/prototype-detail.component').then(
        (m) => m.PrototypeDetailComponent
      ),
  },
  { path: '**', redirectTo: '' },
];
