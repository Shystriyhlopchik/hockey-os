import test from 'node:test';
import assert from 'node:assert/strict';
import {goalContext, goalContextPatch, goalSituationLabel, penaltyTimingMode, penaltyStart, penaltyStartPatch, penaltyModePatch, officialCrew} from './protocol-details.js';
test('Legacy goal context retains known strength without inventing a strength for empty nets or penalty shots', () => {
  assert.deepEqual(goalContext({situation:'PP2'}),{strength:'PP2',goalType:'regular'});
  assert.deepEqual(goalContext({situation:'EN'}),{strength:null,goalType:'empty_net'});
  assert.equal(goalSituationLabel({situation:'EN'}),'Составы не указаны · В пустые ворота');
  assert.equal(goalSituationLabel({situation:'PS'}),'Штрафной бросок');
});
test('An empty-net goal keeps its power-play context and is still excluded from goalie goals against', () => {
  const goal = {situation:'PP',scorerId:7,goalieId:9};
  const next = {...goal,...goalContextPatch(goal,{goalType:'empty_net'})};
  assert.equal(next.strength,'PP');assert.equal(next.situation,'EN');assert.equal(next.goalieId,null);
  assert.equal(goalSituationLabel(next),'В большинстве · В пустые ворота');
  const restored = {...next,...goalContextPatch(next,{goalType:'regular'})};
  assert.equal(restored.situation,'PP');assert.equal(restored.goalieId,undefined);
  assert.equal(goal.situation,'PP');assert.equal(goal.goalieId,9);
});
test('Changing to a penalty shot clears assists; changing back does not invent unknown strength', () => {
  const next=goalContextPatch({situation:'SH'},{goalType:'penalty_shot'});
  assert.equal(next.strength,null);assert.equal(next.assist1Id,null);assert.equal(next.assist2Id,null);
  assert.equal(goalContextPatch(next,{goalType:'regular'}).strength,null);
});
test('Penalty start is suggested for legacy entries without mutating saved values', () => {
  const legacy={time:'21:00',start:'',end:''};assert.equal(penaltyStart(legacy),'21:00');
  assert.equal(legacy.start,'');assert.deepEqual(penaltyStartPatch(legacy,'22:00'),{start:'22:00',time:'22:00',timingMode:'start'});
});
test('Distinct assignment and service times survive editing and explicit merging is required to replace them', () => {
  const delayed={time:'14:30',start:'16:00',end:'18:00'};
  assert.equal(penaltyTimingMode(delayed),'separate');
  assert.deepEqual(penaltyStartPatch(delayed,'17:00'),{start:'17:00',timingMode:'separate'});
  assert.deepEqual(penaltyModePatch(delayed,false),{timingMode:'start',start:'16:00',time:'16:00'});
  assert.equal(delayed.time,'14:30');
});
test('The crew includes all filled roles once and hides empty roles in legacy protocols', () => {
  assert.deepEqual(officialCrew({referee:'Иванов',sheet:{officials:{referee2:'Петров',secretary:'Сидоров',announcer:'  '}}}).map(row=>[row.role,row.name]),[['Главный судья','Иванов'],['Второй главный судья','Петров'],['Секретарь','Сидоров']]);
  assert.deepEqual(officialCrew({}),[]);
});
