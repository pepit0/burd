import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Calendar,
  Camera,
  Check,
  ChevronRight,
  Circle,
  Feather,
  MapPin,
  Mic,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react-native";
import {
  BADGE_FAMILY_LABELS,
  BADGE_FAMILY_ORDER,
  groupBadgesByFamily,
  type BadgeFamily,
  type ProfileBadge,
} from "@/lib/profileBadges";
import { resolveShowcaseBadges } from "@/lib/profileShowcaseBadges";

export interface FamilyStyle {
  icon: LucideIcon;
  earnedBg: string;
  earnedBorder: string;
  earnedIcon: string;
  earnedIconFill: string;
}

export const FAMILY_STYLES: Record<BadgeFamily, FamilyStyle> = {
  life_list: {
    icon: Feather,
    earnedBg: "rgba(95,148,112,0.2)",
    earnedBorder: "border-primary/35",
    earnedIcon: "#5f9470",
    earnedIconFill: "rgba(95,148,112,0.35)",
  },
  capture: {
    icon: Camera,
    earnedBg: "rgba(95,148,112,0.18)",
    earnedBorder: "border-primary/30",
    earnedIcon: "#6fa882",
    earnedIconFill: "transparent",
  },
  sound: {
    icon: Mic,
    earnedBg: "rgba(72,130,140,0.2)",
    earnedBorder: "border-teal-400/30",
    earnedIcon: "#6ba3ad",
    earnedIconFill: "transparent",
  },
  rarity: {
    icon: Sparkles,
    earnedBg: "rgba(200,137,58,0.2)",
    earnedBorder: "border-accent/35",
    earnedIcon: "#c8893a",
    earnedIconFill: "rgba(200,137,58,0.3)",
  },
  explorer: {
    icon: MapPin,
    earnedBg: "rgba(138,158,130,0.18)",
    earnedBorder: "border-muted-foreground/30",
    earnedIcon: "#a8b89e",
    earnedIconFill: "transparent",
  },
  community: {
    icon: Users,
    earnedBg: "rgba(240,234,214,0.12)",
    earnedBorder: "border-foreground/15",
    earnedIcon: "#eee8d4",
    earnedIconFill: "transparent",
  },
  dedication: {
    icon: Calendar,
    earnedBg: "rgba(58,78,53,0.35)",
    earnedBorder: "border-primary/25",
    earnedIcon: "#8a9e82",
    earnedIconFill: "transparent",
  },
};

export function BadgeRow({ badge }: { badge: ProfileBadge }) {
  const style = FAMILY_STYLES[badge.family];
  const Icon = style.icon;

  return (
    <View
      className={`flex-row items-center gap-3 rounded-xl border bg-card p-3 ${
        badge.earned ? style.earnedBorder : "border-border/30 opacity-50"
      }`}
    >
      <View
        className={`h-9 w-9 items-center justify-center rounded-full ${
          badge.earned ? "" : "bg-muted"
        }`}
        style={badge.earned ? { backgroundColor: style.earnedBg } : undefined}
      >
        <Icon
          size={15}
          color={badge.earned ? style.earnedIcon : "#8a9e82"}
          fill={badge.earned ? style.earnedIconFill : "transparent"}
        />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-serif text-sm text-foreground">{badge.label}</Text>
        <Text className="font-sans text-[11px] text-muted-foreground">{badge.desc}</Text>
      </View>
      {badge.earned ? <Check size={13} color={style.earnedIcon} /> : null}
    </View>
  );
}

export function BadgeShowcaseSlot({
  badge,
  compact = false,
}: {
  badge: ProfileBadge | null;
  compact?: boolean;
}) {
  const iconSize = compact ? 18 : 22;
  const circleSize = compact ? "h-12 w-12" : "h-14 w-14";

  if (!badge) {
    return (
      <View className={`items-center ${compact ? "gap-1" : "gap-2"}`}>
        <View
          className={`${circleSize} items-center justify-center rounded-full border border-dashed border-border/70 bg-muted/20`}
        >
          <Circle size={iconSize} color="#8a9e82" strokeWidth={1.5} />
        </View>
        {!compact ? (
          <Text className="text-center font-sans text-[10px] text-muted-foreground">Empty</Text>
        ) : null}
      </View>
    );
  }

  const style = FAMILY_STYLES[badge.family];
  const Icon = style.icon;

  return (
    <View className={`items-center ${compact ? "gap-1" : "gap-2"}`}>
      <View
        className={`${circleSize} items-center justify-center rounded-full border ${style.earnedBorder}`}
        style={{ backgroundColor: style.earnedBg }}
      >
        <Icon
          size={iconSize}
          color={style.earnedIcon}
          fill={style.earnedIconFill}
        />
      </View>
      <Text
        className={`text-center font-serif text-foreground ${
          compact ? "text-[10px] leading-3" : "text-xs leading-4"
        }`}
        numberOfLines={2}
      >
        {badge.label}
      </Text>
    </View>
  );
}

interface ProfileBadgesProps {
  badges: ProfileBadge[];
  earnedCount?: number;
}

export function ProfileBadges({ badges, earnedCount }: ProfileBadgesProps) {
  const grouped = groupBadgesByFamily(badges);
  const totalEarned = earnedCount ?? badges.filter((badge) => badge.earned).length;

  return (
    <View className="gap-5">
      <Text className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {totalEarned} of {badges.length} earned
      </Text>

      {BADGE_FAMILY_ORDER.map((family) => {
        const familyBadges = grouped[family];
        if (familyBadges.length === 0) return null;

        const familyEarned = familyBadges.filter((badge) => badge.earned).length;

        return (
          <View key={family}>
            <View className="mb-2 flex-row items-center justify-between px-0.5">
              <Text className="font-sans-medium text-xs text-foreground/80">
                {BADGE_FAMILY_LABELS[family]}
              </Text>
              <Text className="font-mono text-[10px] text-muted-foreground">
                {familyEarned}/{familyBadges.length}
              </Text>
            </View>
            <View className="gap-2">
              {familyBadges.map((badge) => (
                <BadgeRow key={badge.id} badge={badge} />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

interface ProfileBadgesPreviewProps {
  badges: ProfileBadge[];
  earnedCount: number;
  userId: string;
  username?: string;
  showcaseBadgeIds?: string[] | null;
  isSelf?: boolean;
  onEditShowcase?: () => void;
}

export function ProfileBadgesPreview({
  badges,
  earnedCount,
  userId,
  username,
  showcaseBadgeIds,
  isSelf = false,
  onEditShowcase,
}: ProfileBadgesPreviewProps) {
  const router = useRouter();
  const showcaseSlots = resolveShowcaseBadges(badges, showcaseBadgeIds);

  function openAllBadges() {
    router.push({
      pathname: "/badges",
      params: { userId, username: username ?? "" },
    });
  }

  return (
    <View className="overflow-hidden rounded-xl border border-border bg-card">
      <Pressable
        onPress={openAllBadges}
        className="flex-row items-center justify-between border-b border-border px-4 py-3 active:opacity-90"
      >
        <View>
          <Text className="font-serif-semibold text-base text-foreground">Badges</Text>
          <Text className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            {earnedCount} of {badges.length} earned
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Text className="font-sans-medium text-xs text-primary">View all</Text>
          <ChevronRight size={16} color="#5f9470" />
        </View>
      </Pressable>

      <Pressable
        onPress={isSelf ? onEditShowcase : openAllBadges}
        disabled={isSelf && !onEditShowcase}
        className="px-4 py-4 active:opacity-90"
      >
        <View className="flex-row gap-3">
          {showcaseSlots.map((badge, index) => (
            <View key={index} className="min-w-0 flex-1 items-center">
              <BadgeShowcaseSlot badge={badge} />
            </View>
          ))}
        </View>
        {isSelf ? (
          <Text className="mt-3 text-center font-sans text-[11px] text-muted-foreground">
            Tap to choose which badges to display
          </Text>
        ) : earnedCount === 0 ? (
          <Text className="mt-3 text-center font-sans text-[11px] text-muted-foreground">
            No badges earned yet
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}
