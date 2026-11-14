import { afterNextRender, DestroyRef, Directive, ElementRef, inject, output } from '@angular/core';

@Directive({
  selector: '[appDialogFocus]',
  standalone: true,
  host: { tabindex: '-1', '(keydown)': 'handleKeydown($event)' },
})
export class DialogFocus {
  readonly dialogDismiss = output<void>();
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  constructor() {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    afterNextRender(() => {
      const target = this.element.nativeElement.querySelector<HTMLElement>(
        '[autofocus], input:not([disabled]), select:not([disabled]), button:not([disabled])',
      );
      (target || this.element.nativeElement).focus();
    });
    this.destroyRef.onDestroy(() => previous?.isConnected && previous.focus());
  }
  protected handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.dialogDismiss.emit();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = Array.from(
      this.element.nativeElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
      ),
    ).filter((item) => item.offsetParent !== null);
    const first = items[0],
      last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
}
