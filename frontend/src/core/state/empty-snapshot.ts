import type { LeagueSnapshot } from '../models/league';

export function emptySnapshot(): LeagueSnapshot {
  return {
    community: {
      name: 'Чебоксарская хоккейная лига',
      shortName: 'ЧХЛ',
      city: 'Чебоксары',
      email: '',
      description: '',
    },
    seasons: [],
    tournaments: [],
    teams: [],
    players: [],
    registrations: [],
    matches: [],
    standings: {},
    stats: [],
    news: [],
    series: [],
    placements: {},
    ruleProfiles: {},
    demo: false,
    users: [],
    assignments: [],
  };
}
