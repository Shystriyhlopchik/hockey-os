import { Routes } from '@angular/router';
import { confirmUnsavedChanges } from './core/routing/unsaved-changes';
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home-page').then((module) => module.HomePage),
  },
  {
    path: 'tournaments',
    loadComponent: () =>
      import('./features/tournaments/tournaments-page').then((module) => module.TournamentsPage),
  },
  {
    path: 'tournaments/:id',
    loadComponent: () =>
      import('./features/tournaments/tournaments-page').then((module) => module.TournamentsPage),
  },
  {
    path: 'calendar',
    loadComponent: () =>
      import('./features/calendar/calendar-page').then((module) => module.CalendarPage),
  },
  {
    path: 'matches/:id',
    loadComponent: () => import('./features/matches/match-page').then((module) => module.MatchPage),
  },
  {
    path: 'teams',
    loadComponent: () => import('./features/teams/teams-page').then((module) => module.TeamsPage),
  },
  {
    path: 'teams/:id',
    loadComponent: () => import('./features/teams/teams-page').then((module) => module.TeamsPage),
  },
  {
    path: 'players',
    loadComponent: () =>
      import('./features/players/players-page').then((module) => module.PlayersPage),
  },
  {
    path: 'players/:id',
    loadComponent: () =>
      import('./features/players/players-page').then((module) => module.PlayersPage),
  },
  {
    path: 'news',
    loadComponent: () => import('./features/news/news-page').then((module) => module.NewsPage),
  },
  {
    path: 'news/:id',
    loadComponent: () => import('./features/news/news-page').then((module) => module.NewsPage),
  },
  {
    path: 'regulations',
    loadComponent: () =>
      import('./features/regulations/regulations-page').then((module) => module.RegulationsPage),
  },
  {
    path: 'office',
    loadComponent: () =>
      import('./features/office/office-shell').then((module) => module.OfficeShell),
    canDeactivate: [confirmUnsavedChanges],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/office/office-overview').then((module) => module.OfficeOverview),
      },
      {
        path: 'matches',
        loadComponent: () =>
          import('./features/office/office-matches').then((module) => module.OfficeMatches),
      },
      {
        path: 'players',
        loadComponent: () =>
          import('./features/office/office-players').then((module) => module.OfficePlayers),
      },
      {
        path: 'teams',
        loadComponent: () =>
          import('./features/office/office-teams').then((module) => module.OfficeTeams),
      },
      {
        path: 'tournaments',
        loadComponent: () =>
          import('./features/office/office-tournaments').then((module) => module.OfficeTournaments),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/office/office-users').then((module) => module.OfficeUsers),
      },
      {
        path: 'news',
        loadComponent: () =>
          import('./features/office/office-news').then((module) => module.OfficeNews),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/office/office-settings').then((module) => module.OfficeSettings),
      },
      {
        path: 'audit',
        loadComponent: () =>
          import('./features/office/office-audit').then((module) => module.OfficeAudit),
      },
      {
        path: 'protocol/:id',
        canDeactivate: [confirmUnsavedChanges],
        loadComponent: () =>
          import('./features/protocol/office-protocol').then((module) => module.OfficeProtocol),
      },
    ].map((route) => ({ ...route, canDeactivate: [confirmUnsavedChanges] })),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found-page').then((module) => module.NotFoundPage),
  },
];
