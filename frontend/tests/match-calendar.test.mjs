import test from 'node:test';
import assert from 'node:assert/strict';
import {listPublicMatches,sortMatches,upcomingMatches,upcomingActiveMatches,recentTournamentResults} from '../src/match-calendar.ts';

const tournaments=[{id:1,seasonId:1,status:'active'},{id:2,seasonId:1,status:'active'},{id:3,seasonId:2,status:'active'}];
const game=(id,tournamentId,startsAt,status='scheduled')=>({id,tournamentId,startsAt,status});
const ids=matches=>matches.map(m=>m.id);

test('Matches from different tournaments interleave by start time rather than ID or league',()=>{
  const matches=[game(1,1,'2026-11-14T18:00:00+03:00'),game(65,2,'2026-11-14T13:00:00+03:00'),game(27,1,'2026-11-14T12:00:00+03:00'),game(66,2,'2026-11-14T16:00:00+03:00')];
  assert.deepEqual(ids(listPublicMatches(matches,tournaments)),[27,65,66,1]);
});

test('The selected season includes every visible tournament and excludes hidden or cancelled games',()=>{
  const matches=[game(1,1,'2026-11-14T12:00:00Z'),game(2,2,'2026-11-14T13:00:00Z'),game(3,3,'2027-11-14T12:00:00Z'),game(4,99,'2026-11-14T14:00:00Z'),game(5,2,'2026-11-14T15:00:00Z','cancelled')];
  assert.deepEqual(ids(listPublicMatches(matches,tournaments,1)),[1,2]);
  assert.deepEqual(ids(listPublicMatches(matches,tournaments,2)),[3]);
  assert.deepEqual(ids(listPublicMatches(matches,tournaments)),[1,2,3]);
});

test('Time zones and equal starts have a stable order; undated games stay last in both directions',()=>{
  const matches=[game(8,2,null),game(7,1,'2026-11-14T12:00:00+03:00'),game(2,2,'2026-11-14T09:00:00Z'),game(3,1,'2026-11-14T09:30:00Z'),game(9,1,'invalid')];
  assert.deepEqual(ids(sortMatches(matches)),[2,7,3,8,9]);
  assert.deepEqual(ids(sortMatches(matches,'desc')),[3,7,2,9,8]);
});

test('The nearest four games are chosen after merging and exclude past, completed and undated games',()=>{
  const now=Date.parse('2026-11-12T12:00:00Z');
  const matches=[game(1,1,'2026-11-11T12:00:00Z'),game(2,2,'2026-11-13T12:00:00Z','completed'),game(3,1,null),game(4,2,'2026-11-14T16:00:00Z'),game(5,1,'2026-11-14T12:00:00Z'),game(6,2,'2026-11-14T13:00:00Z'),game(7,1,'2026-11-14T14:00:00Z'),game(8,2,'2026-11-14T15:00:00Z')];
  assert.deepEqual(ids(upcomingMatches(listPublicMatches(matches,tournaments),now)),[5,6,7,8]);
});

test('Rescheduling changes chronological position without changing the snapshot order or match IDs',()=>{
  const matches=[game(27,1,'2026-11-14T12:00:00Z'),game(65,2,'2026-11-14T13:00:00Z')];
  matches[0].startsAt='2026-11-14T14:00:00Z';
  assert.deepEqual(ids(listPublicMatches(matches,tournaments)),[65,27]);
  assert.deepEqual(ids(matches),[27,65]);
  const published=matches.map(m=>({...m,status:'completed'}));
  assert.deepEqual(ids(sortMatches(published,'desc')),[27,65]);
  assert.deepEqual(ids(published),[27,65]);
});

test('Upcoming games include only active tournaments across seasons and fill the four slots after filtering',()=>{
  const now=Date.parse('2026-11-12T12:00:00Z');
  const events=[{id:1,seasonId:1,status:'active'},{id:2,seasonId:2,status:'active'},{id:3,seasonId:1,status:'draft'},{id:4,seasonId:2,status:'completed'}];
  const matches=[game(1,3,'2026-11-13T09:00:00Z'),game(2,4,'2026-11-13T10:00:00Z'),game(3,3,'2026-11-13T11:00:00Z'),game(4,4,'2026-11-13T12:00:00Z'),game(5,1,'2026-11-14T12:00:00Z'),game(6,2,'2026-11-14T13:00:00Z'),game(7,1,'2026-11-14T14:00:00Z'),game(8,2,'2026-11-14T15:00:00Z'),game(9,1,'2026-11-14T16:00:00Z')];
  assert.deepEqual(ids(upcomingActiveMatches(matches,events,now)),[5,6,7,8]);
});

test('Draft and finished tournaments never populate an empty upcoming block',()=>{
  const now=Date.parse('2026-11-12T12:00:00Z');
  const events=[{id:1,seasonId:1,status:'draft'},{id:2,seasonId:1,status:'completed'}];
  const matches=[game(1,1,'2026-11-14T12:00:00Z'),game(2,2,'2026-11-14T13:00:00Z')];
  assert.deepEqual(upcomingActiveMatches(matches,events,now),[]);
  assert.deepEqual(upcomingActiveMatches(matches,[],now),[]);
});

test('Home results belong only to the selected league even if another league finished more recently',()=>{
  const matches=[game(1,1,'2026-11-10T09:00:00Z','completed'),game(2,2,'2026-11-14T15:00:00Z','completed'),game(3,1,'2026-11-12T09:00:00Z','completed'),game(4,1,'2026-11-15T09:00:00Z'),game(5,2,'2026-11-14T12:00:00Z','completed'),game(6,1,'2026-11-16T09:00:00Z','cancelled')];
  const before=structuredClone(matches);
  assert.deepEqual(ids(recentTournamentResults(matches,1)),[3,1]);
  assert.deepEqual(ids(recentTournamentResults(matches,2)),[2,5]);
  assert.deepEqual(ids(recentTournamentResults(matches,undefined)),[]);
  assert.deepEqual(ids(recentTournamentResults(matches,99)),[]);
  assert.deepEqual(matches,before);
});

test('Home results show the latest four published matches after filtering by league',()=>{
  const matches=[game(60,2,'2026-11-20T09:00:00Z','completed'),...Array.from({length:6},(_,index)=>game(index+1,1,`2026-11-${String(index+10).padStart(2,'0')}T09:00:00Z`,'completed'))];
  assert.deepEqual(ids(recentTournamentResults(matches,1)),[6,5,4,3]);
  assert.deepEqual(ids(recentTournamentResults(matches,1,2)),[6,5]);
});
