import { replaceList } from '../../core/state/draft-updates';
import type { Signal, WritableSignal } from '@angular/core';
interface ProtocolActionContext {
  protocol: WritableSignal<any>;
  detail: Signal<any>;
  dirty: WritableSignal<boolean>;
  protocolTeams: Signal<any[]>;
  roster: (teamId: number) => any[];
  opponentTeam: (teamId: number) => number;
  patchProtocol: (path: readonly (string | number)[], value: unknown) => void;
  patchProtocolItem: (item: unknown, patch: Record<string, unknown>) => void;
}
export function createProtocolActions(context: ProtocolActionContext) {
  const {
    protocol,
    detail,
    dirty,
    protocolTeams,
    roster,
    opponentTeam,
    patchProtocol,
    patchProtocolItem,
  } = context;
  function toggleRoster(teamId: number, candidate: any, checked: boolean) {
    const key = teamId === detail()?.match.homeTeamId ? 'homeRoster' : 'awayRoster';
    protocol.update((current) => {
      const list = current[key];
      const next = checked
        ? list.some((item: any) => item.playerId === candidate.playerId)
          ? list
          : [
              ...list,
              {
                playerId: candidate.playerId,
                number: candidate.number,
                position: candidate.player.position,
                captain: candidate.captain,
                played:
                  candidate.player.position !== 'G' ||
                  !list.some((item: any) => item.position === 'G' && item.played),
              },
            ]
        : list.filter((item: any) => item.playerId !== candidate.playerId);
      return { ...current, [key]: next };
    });
    dirty.set(true);
  }

  function appendProtocolItem(key: string, item: unknown) {
    protocol.update((current) => ({
      ...current,
      [key]: [...current[key], item],
    }));
    dirty.set(true);
  }

  function addGoal() {
    const teamId = detail().match.homeTeamId;
    appendProtocolItem('goals', {
      id: crypto.randomUUID(),
      teamId,
      period: 1,
      time: '00:00',
      scorerId: roster(teamId).find((item) => item.position !== 'G')?.playerId || null,
      assist1Id: null,
      assist2Id: null,
      situation: 'EV',
    });
  }

  function addPenalty() {
    appendProtocolItem('penalties', {
      id: crypto.randomUUID(),
      teamId: detail().match.homeTeamId,
      playerId: null,
      servedById: null,
      period: 1,
      time: '00:00',
      minutes: 2,
      code: 'Подножка',
      start: '',
      end: '',
    });
  }

  function addGoalie() {
    const teamId = detail().match.homeTeamId;
    appendProtocolItem('goalieShifts', {
      teamId,
      playerId: roster(teamId).find((item) => item.position === 'G')?.playerId || null,
      from: '00:00',
      to:
        String(detail().tournament.rules.periods * detail().tournament.rules.periodMinutes) + ':00',
    });
  }

  function addShootout() {
    const teamId =
      protocol().shootout.length % 2 ? detail().match.awayTeamId : detail().match.homeTeamId;
    const other = opponentTeam(teamId);
    appendProtocolItem('shootout', {
      teamId,
      playerId: roster(teamId).find((item) => item.position !== 'G')?.playerId || null,
      goalieId: roster(other).find((item) => item.position === 'G')?.playerId || null,
      scored: false,
    });
  }

  function removeEvent(list: any[], index: number) {
    protocol.update((current) =>
      replaceList(
        current,
        list,
        list.filter((_, itemIndex) => itemIndex !== index),
      ),
    );
    dirty.set(true);
  }

  function addTimeout() {
    const teamId = protocolTeams().find(
      (id) => !protocol().sheet.timeouts.some((item: any) => item.teamId === id),
    );
    if (teamId)
      patchProtocol(
        ['sheet', 'timeouts'],
        [...protocol().sheet.timeouts, { teamId, period: 1, time: '00:00' }],
      );
  }

  function addMissedShot() {
    patchProtocol(
      ['sheet', 'missedShots'],
      [
        ...protocol().sheet.missedShots,
        {
          id: crypto.randomUUID(),
          teamId: detail().match.homeTeamId,
          period: 1,
          time: '00:00',
          playerId: null,
          goalieId: null,
        },
      ],
    );
  }

  function toggleOnIce(goal: any, teamId: number, id: number, checked: boolean) {
    const key = teamId === detail().match.homeTeamId ? 'homeOnIce' : 'awayOnIce';
    const ids: number[] = goal[key] || [];
    patchProtocolItem(goal, {
      [key]: checked
        ? ids.length < 6
          ? [...new Set([...ids, id])]
          : ids
        : ids.filter((value) => value !== id),
    });
  }
  return {
    toggleRoster,
    appendProtocolItem,
    addGoal,
    addPenalty,
    addGoalie,
    addShootout,
    removeEvent,
    addTimeout,
    addMissedShot,
    toggleOnIce,
  };
}
