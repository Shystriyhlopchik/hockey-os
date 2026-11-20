import { createLeagueApi } from '../../core/api/league-api';
import type { NewsItem, NewsSummary, NewsPageResult } from '../../core/models/league';

export function createNewsApi() {
  const api = createLeagueApi();
  return {
    list: (page = 1, limit = 12, admin = false, status = 'all', search = '') =>
      api.request$<NewsPageResult>(
        `${admin ? 'workspace/' : ''}news?` +
          new URLSearchParams({ page: String(page), limit: String(limit), status, q: search }),
      ),
    article: (key: string, admin = false) =>
      api.request$<NewsItem>(`${admin ? 'workspace/' : ''}news/${encodeURIComponent(key)}`),
    save: (id: number | null, input: Record<string, unknown>) =>
      api.request$<NewsItem>('workspace/news' + (id ? `/${id}` : ''), id ? 'PATCH' : 'POST', input),
    publication: (item: NewsSummary, publish: boolean) =>
      api.request$<NewsItem>(
        `workspace/news/${item.id}/${publish ? 'publish' : 'unpublish'}`,
        'POST',
        { expectedUpdatedAt: item.updatedAt },
      ),
    remove: (item: NewsSummary) =>
      api.request$(`workspace/news/${item.id}`, 'DELETE', { expectedUpdatedAt: item.updatedAt }),
    cover: (file: File) => {
      const form = new FormData();
      form.append('cover', file);
      return api.request$<{ url: string }>('workspace/news/cover', 'POST', form);
    },
  };
}
