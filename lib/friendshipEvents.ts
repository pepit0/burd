import type { FriendshipStatus } from "@/lib/social";

export interface FriendshipChangeEvent {
  targetUserId: string;
  status: FriendshipStatus;
}

type FriendshipChangeListener = (event: FriendshipChangeEvent) => void;

const listeners = new Set<FriendshipChangeListener>();

export function subscribeFriendshipChanges(
  listener: FriendshipChangeListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitFriendshipChange(event: FriendshipChangeEvent): void {
  for (const listener of listeners) {
    listener(event);
  }
}

export function isFriendRequestActivity(detail: string | null | undefined): boolean {
  return typeof detail === "string" && detail.includes("sent you a friend request");
}
