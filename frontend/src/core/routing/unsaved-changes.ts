import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { LEAGUE_STATE } from '../state/league-state';
export const confirmUnsavedChanges: CanDeactivateFn<unknown> = () => {
  const state = inject(LEAGUE_STATE);
  if (!state.hasUnsavedChanges()) return true;
  if (!window.confirm('Есть несохранённые изменения. Покинуть страницу?')) return false;
  state.dirty.set(false);
  state.modal.set('');
  return true;
};
