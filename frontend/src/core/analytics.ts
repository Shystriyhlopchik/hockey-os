const COUNTER_ID = 114207477;
type MetrikaWindow = Window & {
  ym?: (counterId: number, method: string, ...args: unknown[]) => void;
};
let previousUrl: string | undefined;
export function trackPageView(path: string): void {
  if (typeof window === 'undefined') return;
  const url = new URL(path, window.location.origin).href;
  if (url === previousUrl) return;
  const referer = previousUrl ?? document.referrer;
  previousUrl = url;
  const ym = (window as MetrikaWindow).ym;
  if (typeof ym === 'function') ym(COUNTER_ID, 'hit', url, { title: document.title, referer });
}
