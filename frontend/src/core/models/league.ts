export interface Team {
  id: number;
  name: string;
  abbreviation: string;
  color: string;
  city: string;
  description?: string;
}
export interface LeagueMatch {
  id: number;
  tournamentId: number;
  homeTeamId: number | null;
  awayTeamId: number | null;
  startsAt: string | null;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  round: number;
  stage: string;
  slotMinutes: number;
  gameNumber: number;
  protocolVersion: number;
  venue: string;
  resolution: string | null;
}
export interface Standing {
  teamId: number;
  position: number;
  name: string;
  abbreviation: string;
  color: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  difference: number;
  form: string[];
  tieNote: string;
}
export interface PlayerStat {
  playerId: number;
  teamId: number;
  tournamentId: number;
  name: string;
  position: string;
  games: number;
  goals: number;
  assists: number;
  points: number;
  penaltyMinutes: number;
}
export interface NewsItem {
  id: number;
  title: string;
  body: string;
  category: string;
  published: boolean;
  createdAt: string;
}
export interface Actor {
  id: number;
  username: string;
  displayName: string;
  role: 'superuser' | 'community_admin' | 'tournament_admin' | 'secretary';
}
export interface LeagueSnapshot {
  community: {
    name: string;
    shortName: string;
    city: string;
    email: string;
    description: string;
  };
  seasons: {
    id: number;
    name: string;
    startsOn: string;
    endsOn: string;
  }[];
  tournaments: {
    id: number;
    name: string;
    division: string;
    seasonId: number;
    status: string;
    teamIds: number[];
    rules: Record<string, any>;
    [key: string]: any;
  }[];
  teams: Team[];
  players: {
    id: number;
    name: string;
    firstName: string;
    lastName: string;
    middleName: string;
    position: string;
    birthYear?: string;
    [key: string]: any;
  }[];
  registrations: {
    id: number;
    playerId: number;
    tournamentId: number;
    teamId: number;
    number: number;
    captain: string;
    [key: string]: any;
  }[];
  matches: LeagueMatch[];
  standings: Record<number, Standing[]>;
  stats: PlayerStat[];
  news: NewsItem[];
  series: any[];
  placements: Record<
    number,
    {
      place: number;
      teamId: number;
    }[]
  >;
  ruleProfiles: Record<string, any>;
  demo: boolean;
  users: any[];
  assignments: any[];
}
