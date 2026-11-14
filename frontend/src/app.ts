import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LEAGUE_STATE } from './core/state/league-state';
import { SiteHeader } from './components/site-header/site-header';
import { SiteFooter } from './components/site-footer/site-footer';
import { DialogOutlet } from './features/dialogs/dialog-outlet';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SiteHeader, SiteFooter, DialogOutlet],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class App {
  protected readonly vm = inject(LEAGUE_STATE);
  protected onBeforeUnload(event: BeforeUnloadEvent) {
    if (this.vm.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
