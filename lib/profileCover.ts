export const DEFAULT_PROFILE_COVER =
  "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&h=200&fit=crop&auto=format";

export function profileCoverUri(coverUrl?: string | null): string {
  return coverUrl?.trim() || DEFAULT_PROFILE_COVER;
}
