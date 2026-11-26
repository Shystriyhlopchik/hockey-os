import { computed, inject, DestroyRef, signal } from '@angular/core';
import type { Signal } from '@angular/core';

export type CardImageKind = 'player' | 'team';
export function buildImageBody(
  form: Record<string, any>,
  kind: CardImageKind,
  file: File | null,
  removed: boolean,
): Record<string, any> | FormData {
  if (!file && !removed) return form;
  const data = {
    ...form,
    imageAction: file ? 'replace' : 'remove',
    expectedImageUrl: form[kind === 'player' ? 'photoUrl' : 'logoUrl'] ?? null,
  };
  if (!file) return data;
  const body = new FormData();
  body.append('data', JSON.stringify(data));
  body.append('image', file);
  return body;
}
export function createImageDraft(context: {
  form: Signal<any>;
  modal: Signal<string>;
  error: { set(value: string): void };
}) {
  const file = signal<File | null>(null),
    removed = signal(false),
    preview = signal('');
  function reset() {
    if (preview()) URL.revokeObjectURL(preview());
    preview.set('');
    file.set(null);
    removed.set(false);
  }
  function choose(selected: File) {
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) ||
      selected.size > 5 * 1024 * 1024
    ) {
      context.error.set('Выберите JPEG, PNG или WebP размером до 5 МБ');
      return;
    }
    reset();
    file.set(selected);
    preview.set(URL.createObjectURL(selected));
    context.error.set('');
  }
  function remove() {
    reset();
    removed.set(true);
    context.error.set('');
  }
  const url = computed(() =>
    removed()
      ? null
      : preview() ||
        context.form()?.[context.modal() === 'player' ? 'photoUrl' : 'logoUrl'] ||
        null,
  );
  const changed = computed(() => !!file() || removed());
  inject(DestroyRef).onDestroy(reset);
  return {
    url,
    changed,
    choose,
    remove,
    reset,
    body: (form: any, kind: CardImageKind) => buildImageBody(form, kind, file(), removed()),
  };
}
