import type {
  AviationOpportunity,
  AviationSearchInput,
  CandidateJudgment,
  InquiryReceipt,
  JudgmentInput,
  OpportunityInquiry,
  VenueCandidate,
  VenueSearchInput,
} from './types';

export interface VenueFactsProvider {
  readonly id: string;
  search(input: VenueSearchInput): Promise<VenueCandidate[]>;
}

export interface JudgmentProvider {
  readonly id: string;
  judge(input: JudgmentInput): Promise<CandidateJudgment[]>;
}

export interface AviationOpportunityProvider {
  readonly id: string;
  search(input: AviationSearchInput): Promise<AviationOpportunity[]>;
  inquire(
    opportunityId: string,
    inquiry: OpportunityInquiry,
  ): Promise<InquiryReceipt>;
}

export class OpportunityProviderRegistry<TProvider extends { readonly id: string }> {
  private readonly providers = new Map<string, TProvider>();

  register(provider: TProvider): this {
    if (this.providers.has(provider.id)) {
      throw new Error(`Provider already registered: ${provider.id}`);
    }
    this.providers.set(provider.id, provider);
    return this;
  }

  get(id: string): TProvider | undefined {
    return this.providers.get(id);
  }

  all(): TProvider[] {
    return [...this.providers.values()];
  }
}
