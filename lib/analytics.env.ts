export function getPostHogConfig(): {
  apiKey: string | null;
  host: string;
} {
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? null;
  const host =
    process.env.EXPO_PUBLIC_POSTHOG_HOST?.replace(/\/$/, "") ??
    "https://us.i.posthog.com";
  return { apiKey, host };
}

export function isAnalyticsEnabled(): boolean {
  const { apiKey } = getPostHogConfig();
  return Boolean(apiKey && apiKey.length > 0);
}
