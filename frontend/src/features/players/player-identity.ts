import type { DestroyRef, Signal, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { identityChecks, type IdentityInput, type IdentityResult } from './identity-checks';
import type { createLeagueApi } from '../../core/api/league-api';
interface IdentityContext {
  destroyRef: DestroyRef;
  api: ReturnType<typeof createLeagueApi>;
  request: ReturnType<typeof createLeagueApi>['request'];
  form: Signal<any>;
  modal: Signal<string>;
  playerIdentityKey: Signal<string>;
  playerIdentityBlocked: Signal<boolean>;
  playerIdentityMatches: WritableSignal<any[]>;
  playerIdentityPending: WritableSignal<boolean>;
  playerIdentityError: WritableSignal<string>;
  playerIdentityUnchanged: WritableSignal<boolean>;
}
export function createPlayerIdentity(context: IdentityContext) {
  const {
    destroyRef,
    api,
    request,
    form,
    modal,
    playerIdentityKey,
    playerIdentityBlocked,
    playerIdentityMatches,
    playerIdentityPending,
    playerIdentityError,
    playerIdentityUnchanged,
  } = context;
  const identityChanges = new Subject<IdentityInput | null>();
  let identityRevision = 0;
  function clearPlayerIdentity() {
    identityChanges.next(null);
    identityRevision++;
    playerIdentityMatches.set([]);
    playerIdentityPending.set(false);
    playerIdentityError.set('');
    playerIdentityUnchanged.set(false);
  }

  function identityQuery() {
    const value = form();
    return {
      lastName: value.lastName,
      firstName: value.firstName,
      middleName: value.middleName || '',
      tournamentId: value.tournamentId,
      id: value.id,
    };
  }

  function schedulePlayerIdentity() {
    clearPlayerIdentity();
    if (modal() !== 'player' || !form().lastName?.trim() || !form().firstName?.trim()) return;
    playerIdentityPending.set(true);
    identityChanges.next({
      key: playerIdentityKey(),
      revision: identityRevision,
      query: identityQuery(),
    });
  }

  async function checkPlayerIdentity() {
    identityChanges.next(null);
    const key = playerIdentityKey(),
      revision = ++identityRevision;
    playerIdentityPending.set(true);
    playerIdentityError.set('');
    try {
      const result = await request<{
        matches: any[];
        unchanged: boolean;
      }>('workspace/players/check-name', 'POST', identityQuery());
      if (modal() !== 'player' || key !== playerIdentityKey() || revision !== identityRevision)
        return false;
      playerIdentityMatches.set(result.matches);
      playerIdentityUnchanged.set(result.unchanged);
      return !playerIdentityBlocked();
    } catch (failure) {
      if (modal() === 'player' && key === playerIdentityKey() && revision === identityRevision)
        playerIdentityError.set(failure instanceof Error ? failure.message : 'Ошибка проверки ФИО');
      return false;
    } finally {
      if (revision === identityRevision) playerIdentityPending.set(false);
    }
  }
  identityChecks(identityChanges, (query) =>
    api.request$<IdentityResult>('workspace/players/check-name', 'POST', query),
  )
    .pipe(takeUntilDestroyed(destroyRef))
    .subscribe((value) => {
      if (
        value.revision !== identityRevision ||
        modal() !== 'player' ||
        value.key !== playerIdentityKey()
      )
        return;
      playerIdentityPending.set(false);
      playerIdentityError.set(value.failure);
      if (value.result) {
        playerIdentityMatches.set(value.result.matches);
        playerIdentityUnchanged.set(value.result.unchanged);
      }
    });
  return { clearPlayerIdentity, schedulePlayerIdentity, checkPlayerIdentity };
}
