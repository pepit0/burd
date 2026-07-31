export type UserStatusBadgeKind = "verified" | "beta";

export const USER_STATUS_BADGE_HINTS: Record<UserStatusBadgeKind, string> = {
  verified: "Verified account — confirmed as a real person or organization by Burd.",
  beta: "Beta tester — helping try new features before everyone else.",
};
