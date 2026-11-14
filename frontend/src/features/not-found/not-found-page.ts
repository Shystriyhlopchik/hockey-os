import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  standalone: true,
  imports: [RouterLink],
  template:
    '<main class="empty"><span class="eyebrow">404</span><h1>Страница вне игры</h1><p>Проверьте адрес или вернитесь к матчам лиги.</p><a class="btn primary" routerLink="/">На главную →</a></main>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {}
