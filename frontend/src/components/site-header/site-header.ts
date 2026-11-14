import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Actor } from '../../core/models/league';
@Component({
  selector: 'app-site-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './site-header.html',
  styleUrl: './site-header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteHeader {
  readonly actor = input<Actor | null>(null);
  readonly season = input('2026 / 2027');
  readonly login = output<void>();
  protected readonly menuOpen = signal(false);
  protected readonly links = [
    { path: '/', label: 'Главная' },
    { path: '/calendar', label: 'Матчи' },
    { path: '/tournaments', label: 'Турниры' },
    { path: '/teams', label: 'Команды' },
    { path: '/players', label: 'Статистика' },
    { path: '/news', label: 'Новости' },
  ];
}
