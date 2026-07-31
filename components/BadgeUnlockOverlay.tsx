import { FAMILY_STYLES } from "@/components/ProfileBadges";
import {
  CelebrationUnlockOverlay,
  CELEBRATION_INTRO_MS,
  nextCelebrationUnlockKey,
} from "@/components/CelebrationUnlockOverlay";
import type { ProfileBadge } from "@/lib/profileBadges";

export interface BadgeUnlockOverlayProps {
  unlockKey: number;
  badge: ProfileBadge | null;
  canDismiss: boolean;
  onIntroComplete: () => void;
  onDismiss: () => void;
}

export function BadgeUnlockOverlay({
  unlockKey,
  badge,
  canDismiss,
  onIntroComplete,
  onDismiss,
}: BadgeUnlockOverlayProps) {
  if (!badge) return null;

  const familyStyle = FAMILY_STYLES[badge.family];
  const Icon = familyStyle.icon;

  return (
    <CelebrationUnlockOverlay
      unlockKey={unlockKey}
      visible={Boolean(badge)}
      kicker="New badge"
      title={badge.label}
      description={badge.desc}
      icon={Icon}
      iconStyle={{
        backgroundColor: familyStyle.earnedBg,
        borderColor: familyStyle.earnedIcon,
        iconColor: familyStyle.earnedIcon,
        iconFill: familyStyle.earnedIconFill,
      }}
      canDismiss={canDismiss}
      onIntroComplete={onIntroComplete}
      onDismiss={onDismiss}
    />
  );
}

export const BADGE_UNLOCK_INTRO_MS = CELEBRATION_INTRO_MS;

export function nextBadgeUnlockKey(key: number): number {
  return nextCelebrationUnlockKey(key);
}
