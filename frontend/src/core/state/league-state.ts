import { emptySnapshot } from './empty-snapshot';
import { createProtocolActions } from '../../features/protocol/protocol-actions';
import { createPlayerIdentity } from '../../features/players/player-identity';
import { computed, DestroyRef, inject, InjectionToken, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  EMPTY,
  filter,
  finalize,
  firstValueFrom,
  forkJoin,
  map,
  of,
  startWith,
  Subject,
  switchMap,
  throwError,
  timer,
} from 'rxjs';
import { createLeagueApi } from '../api/league-api';
import { Actor, LeagueSnapshot, LeagueMatch } from '../models/league';
import { parseRoute } from '../routing/route-state';
import { DraftPath, replaceItem, replaceList, updatePath } from './draft-updates';
import {
  prepareSheet,
  periodSummary,
  protocolWarnings,
  OFFICIAL_FIELDS,
  STAFF_FIELDS,
  SITUATIONS,
  PENALTY_CODES,
} from '../../features/protocol/protocol-sheet';
import { trackPageView } from '../analytics';
import {
  createScheduleRows,
  scheduleGroups,
  nearestScheduleGroup,
  scheduleRowsInGroup,
  changedScheduleRows,
  scheduleChanges,
  applyScheduleBulk,
} from '../../features/calendar/schedule-editor';
import {
  listPublicMatches,
  sortMatches,
  upcomingActiveMatches,
  recentTournamentResults,
} from '../../features/calendar/match-calendar';
function createLeagueState() {
  const router = inject(Router);
  const destroyRef = inject(DestroyRef);
  const api = createLeagueApi();
  const location = toSignal(
    router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(router.url),
      distinctUntilChanged(),
    ),
    { requireSync: true },
  );
  const parsedRoute = computed(() => parseRoute(location()));
  const route = computed(() => parsedRoute().route);
  const section = computed(() => parsedRoute().section);
  const entityId = computed(() => parsedRoute().entityId);
  const detailPending = signal(false);
  const data = signal<LeagueSnapshot>(emptySnapshot());
  const hasData = signal(false);
  const work = signal<LeagueSnapshot>(emptySnapshot());
  const actor = signal<Actor | null>(null);
  const loading = signal(true);
  const busy = signal(false);
  const error = signal('');
  const notice = signal('');
  const tournamentId = signal(Number(localStorage.getItem('hockey_tournament') || 1));
  const search = signal('');
  const statusFilter = signal('all');
  const positionFilter = signal('all');
  const teamFilter = signal(0);
  const seasonId = signal(0);
  const playerListScope = signal('tournament');
  const modal = signal('');
  const form = signal<any>({});
  const audit = signal<any[]>([]);
  const detail = signal<any>(null);
  const protocol = signal<any>(null);
  const draftVersion = signal(0);
  const protocolVersion = signal(0);
  const dirty = signal(false);
  const revisionReason = signal('');
  const protocolTab = signal('general');
  const officialFields = OFFICIAL_FIELDS;
  const staffFields = STAFF_FIELDS;
  const goalSituations = SITUATIONS;
  const penaltyCodes = PENALTY_CODES;
  const playerIdentityMatches = signal<any[]>([]);
  const playerIdentityPending = signal(false);
  const playerIdentityError = signal('');
  const playerIdentityUnchanged = signal(false);
  const roles: Record<string, string> = {
    superuser: 'Суперпользователь',
    community_admin: 'Администратор сообщества',
    tournament_admin: 'Администратор турнира',
    secretary: 'Секретарь',
  };
  const positions: Record<string, string> = {
    G: 'Вратарь',
    D: 'Защитник',
    F: 'Нападающий',
  };
  const qualifications: Record<string, string> = {
    novice: 'Новичок',
    amateur: 'Любитель',
    school: 'Спортшкольник',
    former_master: 'Бывший мастер',
  };
  const outcomes: Record<string, string> = {
    regulation: 'Основное время',
    draw: 'Ничья',
    overtime: 'Овертайм',
    shootout: 'Буллиты',
    technical: 'Технический результат',
  };
  const actions: Record<string, string> = {
    publish_protocol: 'Опубликован протокол',
    correct_protocol: 'Исправлен протокол',
    save_draft: 'Сохранён черновик',
    register: 'Игрок заявлен',
    transfer: 'Переход игрока',
    generate_schedule: 'Создан календарь',
    launch: 'Турнир запущен',
    start_playoff: 'Запущен плей-офф',
    reschedule: 'Перенос матча',
    create: 'Создана запись',
    update: 'Изменена запись',
    remove: 'Удалён из заявки',
    delete_player: 'Игрок удалён из системы',
    login: 'Вход в кабинет',
    demo_seed: 'Демонстрационное наполнение',
  };
  const ruleFields = [
    ['periods', 'Периодов'],
    ['periodMinutes', 'Минут в периоде'],
    ['pointsWin', 'Очков за победу'],
    ['pointsDraw', 'Очков за ничью'],
    ['pointsLoss', 'За поражение'],
    ['pointsOvertimeLoss', 'За поражение в ОТ/БП'],
    ['rounds', 'Кругов регулярки'],
    ['overtimeMinutes', 'Минут в овертайме'],
    ['shootoutAttempts', 'Бросков в серии'],
    ['quarterWins', 'Побед в ¼ финала'],
    ['semiWins', 'Побед в ½ финала'],
    ['finalWins', 'Побед в финале'],
    ['minAge', 'Минимальный возраст'],
    ['maxRoster', 'Игроков в сезонной заявке'],
    ['minSkaters', 'Минимум полевых на матч'],
    ['maxSkaters', 'Максимум полевых'],
    ['minGoalies', 'Минимум вратарей'],
    ['maxGoalies', 'Максимум вратарей'],
    ['schoolLimit', 'Квота спортшкольников'],
    ['formerMasterLimit', 'Квота бывших мастеров'],
    ['playoffSkaterGames', 'Игр для допуска полевого в ПО'],
    ['playoffGoalieGames', 'Игр для допуска вратаря в ПО'],
    ['transferLimit', 'Переходов за сезон'],
  ];
  const protocolSummary = computed(() => {
    return periodSummary(protocol(), detail().match, detail().tournament.rules);
  });
  const protocolChecks = computed(() => {
    return protocolWarnings(protocol(), detail().match, detail().tournament.rules);
  });
  const isOffice = computed(() => {
    return route() === 'office';
  });
  const current = computed(() => {
    return isOffice() ? work() : data();
  });
  const tournaments = computed(() => {
    return (current()?.tournaments || []).filter(
      (t: any) => isOffice() || !seasonId() || t.seasonId === seasonId(),
    );
  });
  const seasonName = computed(() => {
    return data()?.seasons.find((s: any) => s.id === tournament()?.seasonId)?.name || '2026 / 2027';
  });
  const winners = computed(() => {
    return current().placements[tournament()?.id ?? 0] || [];
  });
  const tournament = computed<LeagueSnapshot['tournaments'][number] | undefined>(() => {
    return tournaments().find((x: any) => x.id === tournamentId()) || tournaments()[0];
  });
  const canAdmin = computed(() => {
    const role = actor()?.role;
    return !!role && role !== 'secretary';
  });
  const canDeletePlayers = computed(() => {
    return actor()?.role === 'superuser';
  });
  const canGlobal = computed(() => {
    return ['superuser', 'community_admin'].includes(actor()?.role || '');
  });
  const standings = computed(() => {
    return current().standings[tournament()?.id ?? 0] || [];
  });
  const matches = computed<LeagueMatch[]>(() => {
    return (current()?.matches || []).filter((m: any) => m.tournamentId === tournament()?.id);
  });
  const publicMatches = computed<LeagueMatch[]>(() => {
    return listPublicMatches(data()?.matches || [], data()?.tournaments || [], seasonId());
  });
  const matchFeed = computed<LeagueMatch[]>(() => {
    return !isOffice() && ['home', 'calendar'].includes(route()) ? publicMatches() : matches();
  });
  const filteredMatches = computed<LeagueMatch[]>(() => {
    return sortMatches(
      matchFeed().filter(
        (m) =>
          (statusFilter() === 'all' || m.status === statusFilter()) &&
          (!teamFilter() || [m.homeTeamId, m.awayTeamId].includes(teamFilter())) &&
          `${teamName(m.homeTeamId)} ${teamName(m.awayTeamId)} ${m.venue} ${tournamentName(m.tournamentId)}`
            .toLowerCase()
            .includes(search().toLowerCase()),
      ),
    );
  });
  const upcoming = computed<LeagueMatch[]>(() => {
    return isOffice()
      ? sortMatches(matches().filter((m) => m.status === 'scheduled' && m.startsAt)).slice(0, 4)
      : upcomingActiveMatches(data()?.matches || [], data()?.tournaments || []);
  });
  const results = computed<LeagueMatch[]>(() => {
    return recentTournamentResults(current()?.matches || [], tournament()?.id);
  });
  const calendarTeams = computed(() => {
    const ids = new Set(publicMatches().flatMap((m) => [m.homeTeamId, m.awayTeamId]));
    return (data()?.teams || []).filter((t: any) => ids.has(t.id));
  });
  const tournamentTeams = computed(() => {
    return (current()?.teams || []).filter((t: any) => tournament()?.teamIds.includes(t.id));
  });
  const filteredTeams = computed(() => {
    return (isOffice() && canGlobal() ? work()?.teams || [] : tournamentTeams()).filter((t: any) =>
      t.name.toLowerCase().includes(search().toLowerCase()),
    );
  });
  const team = computed(() => {
    return (current()?.teams || []).find((t: any) => t.id === entityId());
  });
  const player = computed(() => {
    return (current()?.players || []).find((p: any) => p.id === entityId());
  });
  const tournamentStats = computed(() => {
    return (current()?.stats || []).filter((s: any) => s.tournamentId === tournament()?.id);
  });
  const leaders = computed(() => {
    return tournamentStats().slice(0, 4);
  });
  const stats = computed(() => {
    return tournamentStats().filter(
      (s: any) =>
        (!teamFilter() || s.teamId === teamFilter()) &&
        (positionFilter() === 'all' || s.position === positionFilter()) &&
        s.name.toLowerCase().includes(search().toLowerCase()),
    );
  });
  const players = computed(() => {
    const regs = current()?.registrations || [],
      scope = canDeletePlayers() ? playerListScope() : 'tournament';
    return (current()?.players || []).filter(
      (p: any) =>
        (scope === 'all' ||
          (scope === 'unregistered'
            ? !regs.some((r: any) => r.playerId === p.id)
            : regs.some(
                (r: any) =>
                  r.playerId === p.id &&
                  r.tournamentId === tournament()?.id &&
                  (!teamFilter() || r.teamId === teamFilter()),
              ))) &&
        p.name.toLowerCase().includes(search().toLowerCase()) &&
        (positionFilter() === 'all' || p.position === positionFilter()),
    );
  });
  const totalGoals = computed(() => {
    return matches()
      .filter((m) => m.status === 'completed')
      .reduce((s, m) => s + (m.homeScore || 0) + (m.awayScore || 0), 0);
  });
  const completed = computed(() => {
    return matches().filter((m) => m.status === 'completed').length;
  });
  const series = computed(() => {
    return (current()?.series || []).filter((s: any) => s.tournamentId === tournament()?.id);
  });
  const title = computed(() => {
    return (
      (
        {
          overview: 'Обзор турнира',
          matches: 'Матчи и протоколы',
          teams: 'Команды и составы',
          players: 'Хоккеисты',
          tournaments: 'Управление турнирами',
          users: 'Пользователи и доступ',
          audit: 'Журнал изменений',
          settings: 'Настройки сообщества',
          news: 'Новости',
          protocol: 'Протокол матча',
        } as any
      )[section()] || 'Кабинет'
    );
  });
  const playerIdentityKey = computed(() => {
    return JSON.stringify([
      form().id || 0,
      form().tournamentId || 0,
      form().lastName || '',
      form().firstName || '',
      form().middleName || '',
    ]);
  });
  const playerIdentityBlocked = computed(() => {
    return playerIdentityMatches().length > 0 && !playerIdentityUnchanged();
  });
  const registrationPlayers = computed(() => {
    const players = work()?.players || [],
      existing = form().existingPlayer;
    return existing && !players.some((p: any) => p.id === existing.id)
      ? [existing, ...players]
      : players;
  });
  const registrationOtherLeagues = computed(() => {
    return (work()?.registrations || []).filter(
      (r: any) => r.playerId === form().playerId && r.tournamentId !== form().tournamentId,
    );
  });
  const calendarGroups = computed(() => {
    return scheduleGroups(form().rows || []);
  });
  const calendarRows = computed(() => {
    return scheduleRowsInGroup(form().rows || [], form().groupKey);
  });
  const calendarChangeCount = computed(() => {
    return changedScheduleRows(form().rows || []).length;
  });
  const hasUnsavedChanges = computed(() => {
    return dirty() || (modal() === 'calendar' && calendarChangeCount() > 0);
  });
  const protocolTeams = computed(() => {
    return detail() ? [detail().match.homeTeamId, detail().match.awayTeamId] : [];
  });
  const protocolTimeHint = computed(() => {
    const rules = detail()?.tournament.rules;
    return (
      'Время от начала матча, ММ:СС. ' +
      (rules
        ? Array.from(
            { length: rules.periods },
            (_, index) => `${index + 1}-й период: ${matchTimeRange(index + 1)}`,
          ).join('; ') + '. '
        : '') +
      'В овертайме общий отсчёт продолжается.'
    );
  });
  function selectSeason(id: number) {
    seasonId.set(Number(id));
    const first = tournaments()[0];
    if (first) selectTournament(first.id);
  }
  function nextNumber(teamId: number) {
    const used = new Set(
      (work()?.registrations || [])
        .filter((r: any) => r.teamId === teamId && r.tournamentId === tournament()?.id)
        .map((r: any) => r.number),
    );
    for (let i = 1; i <= 99; i++) if (!used.has(i)) return i;
    return 99;
  }
  function playerAffiliation(id: number) {
    const regs = (current()?.registrations || []).filter((r: any) => r.playerId === id);
    if (canDeletePlayers() && playerListScope() !== 'tournament')
      return regs.length
        ? regs
            .map(
              (r: any) => registrationTournamentName(r.tournamentId) + ' · ' + teamName(r.teamId),
            )
            .join('; ')
        : 'Без действующей заявки';
    const registration = regs.find((r: any) => r.tournamentId === tournament()?.id);
    return registration
      ? teamName(registration.teamId) + ' · №' + registration.number
      : 'Без заявки в выбранном турнире';
  }
  async function openPlayerDeletion(player: any) {
    if (!canDeletePlayers()) return;
    await run(async () => {
      const info = await request('workspace/players/' + player.id + '/deletion');
      clearPlayerIdentity();
      form.set({ ...info, confirmed: false });
      modal.set('delete-player');
    }, '');
  }
  function selectTournament(id: number) {
    playerListScope.set('tournament');
    tournamentId.set(Number(id));
    localStorage.setItem('hockey_tournament', String(id));
    teamFilter.set(0);
  }
  function teamById(id: number | null) {
    return (
      (data()?.teams || []).find((t: any) => t.id === id) || {
        name: 'Участник не определён',
        abbreviation: '—',
        color: '#657d84',
      }
    );
  }
  function tournamentName(id: number) {
    return data()?.tournaments?.find((t: any) => t.id === id)?.name || 'Турнир';
  }
  function teamName(id: number | null) {
    return teamById(id).name;
  }
  function playerName(id: number) {
    return (
      detail()?.identities?.[id]?.name ||
      (current()?.players || []).find((p: any) => p.id === id)?.name ||
      '—'
    );
  }
  function useExistingPlayer(player: any) {
    const previousForm = form();
    if (previousForm.id) return;
    if (previousForm.registerAfter) {
      const existing = work().players.find((p: any) => p.id === player.id) || player;
      const registration = existingPlayerRegistration(player.id);
      clearPlayerIdentity();
      modal.set('registration');
      error.set('');
      form.set({
        tournamentId: previousForm.tournamentId,
        teamId: registration?.teamId ?? previousForm.teamId,
        playerId: player.id,
        number: registration?.number ?? previousForm.number,
        captain: registration?.captain || '',
        existingPlayer: existing,
      });
    } else {
      const existing = work().players.find((p: any) => p.id === player.id);
      if (existing) open('player', existing);
    }
  }
  function existingPlayerRegistration(id: number) {
    return (work()?.registrations || []).find(
      (r: any) => r.playerId === id && r.tournamentId === form().tournamentId,
    );
  }
  function canUseExistingPlayer(id: number) {
    return (work()?.players || []).some((p: any) => p.id === id);
  }
  function registrationTournamentName(id: number) {
    return (work()?.tournaments || []).find((t: any) => t.id === id)?.name || tournamentName(id);
  }
  function playerRegistration(id: number) {
    return (current()?.registrations || []).find(
      (r: any) => r.playerId === id && r.tournamentId === tournament()?.id,
    );
  }
  function teamRoster(id: number) {
    return (current()?.registrations || [])
      .filter((r: any) => r.teamId === id && r.tournamentId === tournament()?.id)
      .map((r: any) => ({
        ...r,
        player: (current()?.players || []).find((p: any) => p.id === r.playerId),
      }));
  }
  function teamStats(id: number) {
    return standings().find((r: any) => r.teamId === id);
  }
  function date(v: any, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }) {
    return v
      ? new Intl.DateTimeFormat('ru-RU', {
          timeZone: 'Europe/Moscow',
          ...options,
        }).format(new Date(v))
      : 'Дата уточняется';
  }
  function time(v: any) {
    return v ? date(v, { hour: '2-digit', minute: '2-digit' }) : '—';
  }
  function dateTimeInput(v: any) {
    if (!v) return '';
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .format(new Date(v))
      .replace(' ', 'T');
  }
  function score(m: any) {
    return m.status === 'completed' ? `${m.homeScore} : ${m.awayScore}` : time(m.startsAt);
  }
  function outcome(m: any) {
    return m.resolution === 'overtime'
      ? 'ОТ'
      : m.resolution === 'shootout'
        ? 'БП'
        : m.resolution === 'technical'
          ? 'ТП'
          : '';
  }
  async function logout() {
    await run(async () => {
      await request('auth/logout', 'POST', {});
      actor.set(null);
      work.set(emptySnapshot());
      router.navigateByUrl('/');
    }, 'Вы вышли из кабинета');
  }
  function login() {
    modal.set('login');
    form.set({ username: '', password: '' });
    error.set('');
  }
  function hasTournamentMatches(id: number) {
    return (work()?.matches || []).some((match: any) => match.tournamentId === id);
  }
  function hasEditableSchedule(id = tournament()?.id) {
    const tournamentRecord = work()?.tournaments.find((t: any) => t.id === id);
    return (
      !!tournamentRecord &&
      ['draft', 'active'].includes(tournamentRecord.status) &&
      (work()?.matches || []).some(
        (match: any) => match.tournamentId === id && match.status === 'scheduled',
      )
    );
  }
  async function editCalendar(item?: any) {
    await run(async () => {
      const id = item?.id || tournament()?.id;
      if (!id) throw new Error('Выберите турнир');
      work.set(await request('workspace'));
      const tournamentRecord = work().tournaments.find((t: any) => t.id === id);
      if (!tournamentRecord || !hasEditableSchedule(id))
        throw new Error('В турнире нет матчей, доступных для изменения расписания');
      const rows = createScheduleRows(
        sortMatches(work().matches.filter((match: any) => match.tournamentId === id)),
      );
      form.set({
        tournamentId: id,
        tournamentName: tournamentRecord.name,
        rows,
        groupKey: nearestScheduleGroup(rows),
        bulkDate: '',
        bulkVenue: '',
      });
      modal.set('calendar');
    }, '');
  }
  function closeModal() {
    if (busy()) return;
    if (
      modal() === 'calendar' &&
      calendarChangeCount() &&
      !confirm('Есть несохранённые изменения календаря. Закрыть без сохранения?')
    )
      return;
    clearPlayerIdentity();
    modal.set('');
    error.set('');
  }
  function open(kind: string, item?: any) {
    if (kind === 'calendar') {
      void editCalendar(item);
      return;
    }
    const t = tournament();
    if (['registration', 'schedule', 'playoff'].includes(kind) && !t) {
      error.set('Сначала создайте или выберите турнир.');
      return;
    }
    clearPlayerIdentity();
    error.set('');
    modal.set(kind);
    if (kind === 'team')
      form.set(
        item
          ? { ...item, tournamentId: t?.id }
          : {
              name: '',
              city: 'Чебоксары',
              abbreviation: '',
              color: '#1f5970',
              description: '',
              tournamentId: t?.status === 'draft' ? t.id : null,
            },
      );
    else if (kind === 'player')
      form.set(
        item
          ? { ...item, tournamentId: t?.id }
          : {
              firstName: '',
              lastName: '',
              middleName: '',
              birthDate: '',
              position: 'F',
              qualification: 'amateur',
              insured: false,
              medicallyCleared: false,
              tournamentId: t?.id,
              teamId: teamFilter() || tournamentTeams()[0]?.id,
              number: 1,
              registerAfter: true,
            },
      );
    else if (kind === 'registration' && t)
      form.set({
        tournamentId: t.id,
        teamId: teamFilter() || tournamentTeams()[0]?.id,
        playerId: item?.id || work().players[0]?.id,
        number: 1,
        captain: '',
      });
    else if (kind === 'tournament') {
      const rules = item?.rules || data().ruleProfiles?.festival || data().tournaments[0]?.rules;
      form.set(
        item
          ? structuredClone(item)
          : {
              name: 'Новый турнир',
              slug: 'tournament-' + Date.now(),
              division: '18+',
              seasonId: data().seasons[0]?.id,
              description: '',
              teamIds: [],
              rules: structuredClone(rules),
            },
      );
    } else if (kind === 'user')
      form.set(
        item
          ? {
              ...item,
              password: '',
              tournamentIds: work()
                .assignments.filter((a: any) => a.userId === item.id)
                .map((a: any) => a.tournamentId),
            }
          : {
              username: '',
              displayName: '',
              password: '',
              role: 'secretary',
              active: true,
              tournamentIds: [],
            },
      );
    else if (kind === 'schedule' && t)
      form.set({
        id: item?.id || t.id,
        startsAt: item?.tournamentId
          ? dateTimeInput(item.startsAt)
          : dateTimeInput(new Date().toISOString()),
        venue: item?.venue || 'Новое Поколение',
        slotMinutes: item?.slotMinutes || 90,
        isMatch: !!item?.tournamentId,
        expected: item?.tournamentId
          ? {
              round: item.round,
              startsAt: item.startsAt,
              venue: item.venue,
              slotMinutes: item.slotMinutes,
            }
          : undefined,
      });
    else if (kind === 'playoff' && t) form.set({ id: t.id, size: Math.min(8, t.teamIds.length) });
    else if (kind === 'settings') form.set({ ...work().community });
    else if (kind === 'news')
      form.set(
        item ? { ...item } : { title: '', body: '', category: 'Сообщество', published: true },
      );
    else if (kind === 'season')
      form.set({
        name: '2027 / 2028',
        startsOn: '2027-09-01',
        endsOn: '2028-05-31',
      });
    else if (kind === 'staff') {
      form.set({ id: item.id, secretaries: [], secretaryIds: [] });
      void run(async () => {
        const result = await request(`workspace/tournaments/${item.id}/staff`);
        form.update((current) => ({ ...current, ...result }));
      }, '');
    }
    if ((kind === 'player' && !item) || kind === 'registration')
      patchForm(['number'], nextNumber(form().teamId));
    if (kind === 'player') schedulePlayerIdentity();
  }
  async function saveForm() {
    await run(
      async () => {
        const f = form(),
          k = modal();
        if (k === 'delete-player') {
          if (!canDeletePlayers() || !f.canDelete || !f.confirmed)
            throw new Error('Подтвердите удаление игрока');
          await request('workspace/players/' + f.player.id, 'DELETE', {
            expectedVersion: f.version,
          });
          modal.set('');
          await refresh();
          return;
        }
        if (k === 'player' && !(await checkPlayerIdentity()))
          throw new Error(
            playerIdentityError() ||
              (playerIdentityBlocked()
                ? 'Игрок с таким ФИО уже существует. Выберите существующую карточку.'
                : 'Данные формы изменились. Повторите проверку ФИО.'),
          );
        if (k === 'login') {
          actor.set(await request('auth/login', 'POST', f));
          await refresh();
          modal.set('');
          await router.navigateByUrl('/office');
          return;
        }
        if (k === 'schedule') {
          const startsAt = f.startsAt ? f.startsAt + ':00+03:00' : null;
          await request(
            f.isMatch ? `workspace/matches/${f.id}` : `workspace/tournaments/${f.id}/schedule`,
            f.isMatch ? 'PATCH' : 'POST',
            { ...f, startsAt },
          );
        } else if (k === 'calendar') {
          const changes = scheduleChanges(f.rows);
          if (!changes.length) throw new Error('Расписание не изменено');
          await request(`workspace/tournaments/${f.tournamentId}/schedule`, 'PATCH', {
            matches: changes,
          });
        } else if (k === 'playoff')
          await request(`workspace/tournaments/${f.id}/playoff`, 'POST', {
            size: f.size,
          });
        else if (k === 'registration') await request('workspace/registrations', 'POST', f);
        else if (k === 'settings') await request('workspace/community', 'PATCH', f);
        else if (k === 'season') await request('workspace/seasons', 'POST', f);
        else if (k === 'staff')
          await request(`workspace/tournaments/${f.id}/staff`, 'PATCH', {
            secretaryIds: f.secretaryIds,
          });
        else {
          const plural: any = {
            team: 'teams',
            player: 'players',
            tournament: 'tournaments',
            user: 'users',
            news: 'news',
          };
          try {
            await request(
              `workspace/${plural[k]}${f.id ? '/' + f.id : ''}`,
              f.id ? 'PATCH' : 'POST',
              f,
            );
          } catch (error) {
            if (k === 'player') await checkPlayerIdentity();
            throw error;
          }
        }
        modal.set('');
        await refresh();
      },
      modal() === 'login'
        ? 'Вы вошли в кабинет'
        : modal() === 'delete-player'
          ? 'Игрок удалён из системы'
          : 'Изменения сохранены',
    );
  }
  async function launchTournament(t: any) {
    await run(async () => {
      await request(`workspace/tournaments/${t.id}/launch`, 'POST', {});
      await refresh();
    }, 'Турнир запущен');
  }
  async function removeRegistration(r: any) {
    if (!confirm('Исключить игрока из сезонной заявки? Старые протоколы сохранятся.')) return;
    await run(async () => {
      await request(`workspace/registrations/${r.id}`, 'DELETE');
      await refresh();
    });
  }
  function candidates(teamId: number) {
    const candidates = (detail()?.candidates || []).filter((c: any) => c.teamId === teamId);
    const ids = new Set(candidates.map((c: any) => c.playerId));
    return [
      ...candidates,
      ...roster(teamId)
        .filter((r) => !ids.has(r.playerId))
        .map((r) => ({
          id: 'history-' + r.playerId,
          teamId,
          ...r,
          player: {
            ...detail().identities[r.playerId],
            name: playerName(r.playerId),
            position: r.position,
          },
        })),
    ];
  }
  function roster(teamId: number): any[] {
    return teamId === detail()?.match.homeTeamId
      ? protocol()?.homeRoster || []
      : protocol()?.awayRoster || [];
  }
  function rosterContains(teamId: number, id: number) {
    return roster(teamId).some((x) => x.playerId === id);
  }
  function rosterEntry(teamId: number, id: number) {
    return roster(teamId).find((x) => x.playerId === id);
  }
  function rosterOptions(teamId: number) {
    return roster(teamId).map((x) => ({ ...x, name: playerName(x.playerId) }));
  }
  function matchTimeRange(period: number) {
    const rules = detail()?.tournament.rules;
    if (!rules || !Number.isInteger(period) || period < 1 || period > rules.periods + 20)
      return 'Выберите период';
    const duration = period <= rules.periods ? rules.periodMinutes : rules.overtimeMinutes;
    const start =
      period <= rules.periods
        ? (period - 1) * duration
        : rules.periods * rules.periodMinutes + (period - rules.periods - 1) * duration;
    return `${String(start).padStart(2, '0')}:00–${String(start + duration).padStart(2, '0')}:00`;
  }
  function opponentTeam(teamId: number) {
    return teamId === detail().match.homeTeamId
      ? detail().match.awayTeamId
      : detail().match.homeTeamId;
  }
  function isOnIce(goal: any, teamId: number, id: number) {
    return (goal[teamId === detail().match.homeTeamId ? 'homeOnIce' : 'awayOnIce'] || []).includes(
      id,
    );
  }
  function onIceCount(goal: any, teamId: number) {
    return (goal[teamId === detail().match.homeTeamId ? 'homeOnIce' : 'awayOnIce'] || []).length;
  }
  function protocolScore(teamId: number) {
    if (
      (protocol()?.detailLevel === 'score_only' || protocol()?.resolution === 'technical') &&
      (protocol().manualHomeScore === null || protocol().manualAwayScore === null)
    )
      return '—';
    const score = protocolSummary().total;
    return teamId === detail().match.homeTeamId ? score.home : score.away;
  }
  async function saveProtocol(publish = false) {
    await run(
      async () => {
        const result = await request(
          `workspace/matches/${entityId()}/${publish ? 'publish' : 'draft'}`,
          'POST',
          {
            protocol: protocol(),
            expectedDraftVersion: draftVersion(),
            expectedProtocolVersion: protocolVersion(),
            reason: revisionReason(),
          },
        );
        draftVersion.set(result.draftVersion);
        protocolVersion.set(result.protocolVersion);
        dirty.set(false);
        await refresh();
        if (publish) {
          detail.set(await request(`workspace/matches/${entityId()}`));
          revisionReason.set('');
        }
      },
      publish ? 'Протокол опубликован. Таблица и статистика обновлены' : 'Черновик сохранён',
    );
  }
  function print() {
    window.print();
  }
  const patchForm = (path: DraftPath, value: unknown) =>
    form.update((current) => updatePath(current, path, value));
  const patchProtocol = (path: DraftPath, value: unknown) => {
    protocol.update((current) => updatePath(current, path, value));
    dirty.set(true);
  };
  const patchFormItem = (item: unknown, patch: Record<string, unknown>) =>
    form.update((current) => replaceItem(current, item, patch));
  const patchProtocolItem = (item: unknown, patch: Record<string, unknown>) => {
    protocol.update((current) => replaceItem(current, item, patch));
    dirty.set(true);
  };
  const {
    toggleRoster,
    appendProtocolItem,
    addGoal,
    addPenalty,
    addGoalie,
    addShootout,
    removeEvent,
    addTimeout,
    addMissedShot,
    toggleOnIce,
  } = createProtocolActions({
    protocol,
    detail,
    dirty,
    protocolTeams,
    roster,
    opponentTeam,
    patchProtocol,
    patchProtocolItem,
  });
  const { clearPlayerIdentity, schedulePlayerIdentity, checkPlayerIdentity } = createPlayerIdentity(
    {
      destroyRef,
      api,
      request: api.request,
      form,
      modal,
      playerIdentityKey,
      playerIdentityBlocked,
      playerIdentityMatches,
      playerIdentityPending,
      playerIdentityError,
      playerIdentityUnchanged,
    },
  );
  const request = api.request;
  const noticeChanges = new Subject<void>();
  let refreshRevision = 0;
  async function refresh() {
    const revision = ++refreshRevision;
    try {
      const result = await firstValueFrom(
        forkJoin({
          data: api.request$<LeagueSnapshot>('public'),
          session: api.request$<Actor>('auth/me').pipe(
            switchMap((actor) =>
              api.request$<LeagueSnapshot>('workspace').pipe(map((work) => ({ actor, work }))),
            ),
            catchError(
              (
                failure: Error & {
                  status?: number;
                },
              ) =>
                failure.status === 401
                  ? of({ actor: null, work: null })
                  : throwError(() => failure),
            ),
          ),
        }),
      );
      if (revision !== refreshRevision) return;
      data.set(result.data);
      hasData.set(true);
      actor.set(result.session.actor);
      work.set(result.session.work || emptySnapshot());
      if (tournaments().length && !tournaments().some((item: any) => item.id === tournamentId()))
        tournamentId.set(tournaments()[0].id);
    } catch (failure) {
      error.set(failure instanceof Error ? failure.message : 'Не удалось загрузить приложение');
    } finally {
      if (revision === refreshRevision) loading.set(false);
    }
  }
  async function run(task: () => Promise<unknown>, message = 'Изменения сохранены') {
    if (busy()) return;
    busy.set(true);
    error.set('');
    try {
      await task();
      notice.set(message);
      noticeChanges.next();
    } catch (failure) {
      error.set(failure instanceof Error ? failure.message : 'Не удалось выполнить действие');
    } finally {
      busy.set(false);
    }
  }
  function applyCalendarBulk() {
    try {
      const next = structuredClone(form());
      applyScheduleBulk(next.rows, next.groupKey, next.bulkDate, next.bulkVenue);
      form.set(next);
      error.set('');
    } catch (failure) {
      error.set(failure instanceof Error ? failure.message : 'Проверьте расписание');
    }
  }
  function toggleList(list: number[], id: number, checked: boolean) {
    const next = checked ? [...new Set([...list, id])] : list.filter((value) => value !== id);
    form.update((current) => replaceList(current, list, next));
  }
  function profileChanged(profile: string) {
    form.update((current) => ({
      ...current,
      rules: data()?.ruleProfiles?.[profile]
        ? structuredClone(data().ruleProfiles[profile])
        : { ...current.rules, profile: 'custom' },
    }));
  }
  function applyProtocolDetail(value: any) {
    detail.set(value);
    selectTournament(value.tournament.id);
    draftVersion.set(value.draftVersion);
    protocolVersion.set(value.match.protocolVersion);
    protocol.set(
      structuredClone(
        value.draft ||
          value.protocol || {
            timeBasis: 'match',
            detailLevel: 'full',
            homeRoster: [],
            awayRoster: [],
            goals: [],
            penalties: [],
            goalieShifts: [],
            shootout: [],
            resolution: 'regulation',
            manualHomeScore: null,
            manualAwayScore: null,
            technicalReason: '',
            notes: '',
            referee: '',
            spectators: null,
          },
      ),
    );
    if (!value.draft && !value.protocol)
      for (const candidate of value.candidates) toggleRoster(candidate.teamId, candidate, true);
    protocol.set(prepareSheet(protocol(), value.match, data().community.city));
    dirty.set(false);
    revisionReason.set('');
    protocolTab.set('general');
  }
  noticeChanges
    .pipe(
      switchMap(() => timer(4500)),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe(() => notice.set(''));
  router.events
    .pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe((event) => {
      trackPageView(event.urlAfterRedirects);
      search.set('');
      statusFilter.set('all');
      teamFilter.set(0);
      error.set('');
      if (route() === 'tournaments' && entityId()) selectTournament(entityId());
    });
  combineLatest([toObservable(location), toObservable(actor), toObservable(hasData)])
    .pipe(
      map(([url, session, snapshot]) => {
        const parsed = parseRoute(url);
        if (!snapshot) return '';
        if (parsed.section === 'protocol' && session) return 'workspace/matches/' + parsed.entityId;
        if (parsed.route === 'matches' && parsed.entityId) return 'matches/' + parsed.entityId;
        if (parsed.section === 'audit' && session) return 'workspace/audit';
        return '';
      }),
      distinctUntilChanged(),
      switchMap((path) => {
        detail.set(null);
        if (!path) return EMPTY;
        detailPending.set(true);
        return api.request$(path).pipe(
          map((value) => ({ path, value })),
          catchError((failure) => {
            error.set(failure.message);
            return EMPTY;
          }),
          finalize(() => detailPending.set(false)),
        );
      }),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe(({ path, value }) => {
      if (path === 'workspace/audit') audit.set(value);
      else if (path.startsWith('workspace/')) applyProtocolDetail(value);
      else detail.set(value);
    });
  void refresh();
  return {
    hasData,
    data,
    work,
    actor,
    loading,
    busy,
    error,
    notice,
    route,
    section,
    entityId,
    tournamentId,
    search,
    statusFilter,
    positionFilter,
    teamFilter,
    seasonId,
    playerListScope,
    modal,
    form,
    audit,
    detail,
    protocol,
    draftVersion,
    protocolVersion,
    dirty,
    revisionReason,
    protocolTab,
    officialFields,
    staffFields,
    goalSituations,
    penaltyCodes,
    playerIdentityMatches,
    playerIdentityPending,
    playerIdentityError,
    playerIdentityUnchanged,
    roles,
    positions,
    qualifications,
    outcomes,
    actions,
    ruleFields,
    protocolSummary,
    protocolChecks,
    isOffice,
    current,
    tournaments,
    seasonName,
    winners,
    tournament,
    canAdmin,
    canDeletePlayers,
    canGlobal,
    standings,
    matches,
    publicMatches,
    matchFeed,
    filteredMatches,
    upcoming,
    results,
    calendarTeams,
    tournamentTeams,
    filteredTeams,
    team,
    player,
    tournamentStats,
    leaders,
    stats,
    players,
    totalGoals,
    completed,
    series,
    title,
    playerIdentityKey,
    playerIdentityBlocked,
    registrationPlayers,
    registrationOtherLeagues,
    calendarGroups,
    calendarRows,
    calendarChangeCount,
    hasUnsavedChanges,
    protocolTeams,
    protocolTimeHint,
    selectSeason,
    profileChanged,
    nextNumber,
    playerAffiliation,
    openPlayerDeletion,
    request,
    refresh,
    selectTournament,
    teamById,
    tournamentName,
    teamName,
    playerName,
    clearPlayerIdentity,
    schedulePlayerIdentity,
    checkPlayerIdentity,
    useExistingPlayer,
    existingPlayerRegistration,
    canUseExistingPlayer,
    registrationTournamentName,
    playerRegistration,
    teamRoster,
    teamStats,
    date,
    time,
    dateTimeInput,
    score,
    outcome,
    run,
    logout,
    login,
    hasTournamentMatches,
    hasEditableSchedule,
    editCalendar,
    applyCalendarBulk,
    closeModal,
    open,
    toggleList,
    saveForm,
    launchTournament,
    removeRegistration,
    candidates,
    roster,
    rosterContains,
    rosterEntry,
    toggleRoster,
    rosterOptions,
    matchTimeRange,
    addGoal,
    addPenalty,
    addGoalie,
    addShootout,
    removeEvent,
    opponentTeam,
    addTimeout,
    addMissedShot,
    toggleOnIce,
    isOnIce,
    onIceCount,
    protocolScore,
    saveProtocol,
    print,
    router,
    detailPending,
    patchForm,
    patchProtocol,
    patchFormItem,
    patchProtocolItem,
  };
}
export type LeagueState = ReturnType<typeof createLeagueState>;
export const LEAGUE_STATE = new InjectionToken<LeagueState>('LeagueState', {
  providedIn: 'root',
  factory: createLeagueState,
});
