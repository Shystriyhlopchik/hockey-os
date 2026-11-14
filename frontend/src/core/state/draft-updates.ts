export type DraftPath = readonly (string | number)[];
/** Structural sharing keeps computed signals and OnPush inputs consistent. */
export function updatePath<T>(source: T, path: DraftPath, value: unknown): T {
  if (!path.length) return value as T;
  const [key, ...tail] = path;
  const next: any = Array.isArray(source) ? [...source] : { ...source };
  next[key] = updatePath((source as any)?.[key], tail, value);
  return next;
}
export function replaceItem<T>(source: T, target: unknown, patch: Record<string, unknown>): T {
  if (source === target) return { ...source, ...patch };
  if (Array.isArray(source)) {
    const values = source.map((item) => replaceItem(item, target, patch));
    return (values.some((item, index) => item !== source[index]) ? values : source) as T;
  }
  if (source && typeof source === 'object') {
    const entries = Object.entries(source).map(
      ([key, value]) => [key, replaceItem(value, target, patch)] as const,
    );
    return entries.some(([key, value]) => value !== (source as any)[key])
      ? (Object.fromEntries(entries) as T)
      : source;
  }
  return source;
}
export function replaceList<T>(source: T, target: unknown[], replacement: unknown[]): T {
  if (source === target) return replacement as T;
  if (Array.isArray(source)) {
    const values = source.map((item) => replaceList(item, target, replacement));
    return (values.some((item, index) => item !== source[index]) ? values : source) as T;
  }
  if (source && typeof source === 'object') {
    const entries = Object.entries(source).map(
      ([key, value]) => [key, replaceList(value, target, replacement)] as const,
    );
    return entries.some(([key, value]) => value !== (source as any)[key])
      ? (Object.fromEntries(entries) as T)
      : source;
  }
  return source;
}
