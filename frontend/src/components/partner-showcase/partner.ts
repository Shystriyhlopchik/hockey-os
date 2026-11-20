export interface Partner {
  readonly id: string;
  readonly name: string;
  readonly headline: string;
  readonly description: string;
  readonly highlight: string;
  readonly highlightLabel: string;
  readonly logo: string;
  readonly logoWidth: number;
  readonly logoHeight: number;
  readonly link?: {
    readonly href: string;
    readonly label: string;
  };
}
