import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Calendar,
  Camera,
  Check,
  ChevronRight,
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
  getRecentEarnedBadges,
  groupBadgesByFamily,
  type BadgeFamily,
  type ProfileBadge,
} from "@/lib/profileBadges";

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
}

export function ProfileBadgesPreview({
  badges,
  earnedCount,
  userId,
  username,
}: ProfileBadgesPreviewProps) {
  const router = useRouter();
  const recent = getRecentEarnedBadges(badges, 5);

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

      {recent.length === 0 ? (
        <Pressable onPress={openAllBadges} className="px-4 py-5 active:opacity-90">
          <Text className="font-sans text-sm text-muted-foreground">
            No badges earned yet. Log a sighting to unlock your first one.
          </Text>
        </Pressable>
      ) : (
        <View className="gap-2 p-3">
          {recent.map((badge) => (
            <BadgeRow key={badge.id} badge={badge} />
          ))}
        </View>
      )}
    </View>
  );
}
