export function matchDate(
  value: string | null,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
) {
  return value
    ? new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        ...options,
      }).format(new Date(value))
    : 'Дата уточняется';
}
export function matchTime(value: string | null) {
  return value ? matchDate(value, { hour: '2-digit', minute: '2-digit' }) : '—';
}
