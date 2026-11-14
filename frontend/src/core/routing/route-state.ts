export function parseRoute(url: string) {
  const segments = url.split('?')[0].split('/').filter(Boolean);
  const route = segments[0] || 'home';
  return {
    route,
    section: route === 'office' ? segments[1] || 'overview' : '',
    entityId: Number(segments[route === 'office' ? 2 : 1] || 0),
  };
}
