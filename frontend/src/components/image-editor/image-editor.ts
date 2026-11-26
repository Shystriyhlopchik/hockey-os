import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
@Component({
  selector: 'app-image-editor',
  standalone: true,
  templateUrl: './image-editor.html',
  styleUrl: './image-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageEditor {
  readonly imageUrl = input<string | null>(null);
  readonly kind = input<'player' | 'team'>('player');
  readonly disabled = input(false);
  readonly fileSelected = output<File>();
  readonly removed = output<void>();
  protected choose(event: Event): void {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    if (file) this.fileSelected.emit(file);
    input.value = '';
  }
}
