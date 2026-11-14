import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEAGUE_STATE } from '../../core/state/league-state';
import { LeagueMatch, NewsItem, PlayerStat } from '../../core/models/league';
import { MatchCard } from '../../components/match-card/match-card';
import { SectionHeading } from '../../components/section-heading/section-heading';
import { StandingsTable } from '../../components/standings-table/standings-table';
import { LeaderBoard } from '../../components/leader-board/leader-board';
import { homeSummary } from './home-summary';
@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [RouterLink, MatchCard, SectionHeading, StandingsTable, LeaderBoard],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  protected readonly vm = inject(LEAGUE_STATE);
  protected readonly news = computed<NewsItem[]>(() => this.vm.data()?.news || []);
  protected readonly summary = computed(() =>
    homeSummary(this.vm.matches(), this.vm.tournamentStats(), this.vm.tournamentTeams().length),
  );
  protected readonly venues = computed(
    () =>
      [...new Set((this.vm.data()?.matches || []).map((match: LeagueMatch) => match.venue))].filter(
        Boolean,
      ) as string[],
  );
}
