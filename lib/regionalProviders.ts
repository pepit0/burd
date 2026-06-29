import {
  getRegionalContext,
  lookupSpeciesScore,
  type RegionalContext,
  type SpeciesRegionalScore,
} from "@/lib/regionalFrequency";
import { prefetchRegionalCommunity } from "@/lib/regionalCommunity";

export interface RegionalPriorProvider {
  id: string;
  lookup(
    ctx: RegionalContext,
    scientificName: string,
  ): Promise<SpeciesRegionalScore | null>;
}

/** Bundled GBIF-derived priors (always available offline). */
export const gbifBundleProvider: RegionalPriorProvider = {
  id: "gbif-bundle",
  async lookup(ctx, scientificName) {
    return lookupSpeciesScore(ctx, scientificName);
  },
};

/** Live Burd community aggregates from Supabase. */
export const communityProvider: RegionalPriorProvider = {
  id: "burd-community",
  async lookup(ctx, scientificName) {
    await prefetchRegionalCommunity(ctx);
    return lookupSpeciesScore(ctx, scientificName);
  },
};

/**
 * Placeholder for future commercially licensed sources (eBird, Map of Life, etc.).
 * Returns null — no network calls.
 */
export const externalLicensedProvider: RegionalPriorProvider = {
  id: "external-licensed",
  async lookup() {
    return null;
  },
};

const defaultProviders: RegionalPriorProvider[] = [
  communityProvider,
  gbifBundleProvider,
];

/** Resolve the best regional score from registered providers. */
export async function lookupWithProviders(
  lat: number,
  lng: number,
  scientificName: string,
  date: Date = new Date(),
  providers: RegionalPriorProvider[] = defaultProviders,
): Promise<SpeciesRegionalScore> {
  const ctx = getRegionalContext(lat, lng, date);

  for (const provider of providers) {
    const score = await provider.lookup(ctx, scientificName);
    if (score && score.expected) {
      return score;
    }
  }

  return lookupSpeciesScore(ctx, scientificName);
}

export function getRegisteredProviders(): RegionalPriorProvider[] {
  return [...defaultProviders, externalLicensedProvider];
}
