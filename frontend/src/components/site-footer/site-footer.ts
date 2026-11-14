import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-site-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteFooter {
  readonly community = input.required<{
    city: string;
    email: string;
    name: string;
  }>();
  protected readonly year = new Date().getFullYear();
}
