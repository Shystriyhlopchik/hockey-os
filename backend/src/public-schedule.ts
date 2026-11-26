import type { Match } from './entities';

// An approved fixture is public; its tentative appointment belongs only in the workspace.
export function publicSchedule(match: Match) {
  return match.status === 'completed' || match.scheduleConfirmed
    ? match
    : { ...match, startsAt: null, venue: '' };
}
