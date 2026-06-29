import { Text, View } from "react-native";
import { Check, Star } from "lucide-react-native";
import type { ProfileBadge } from "@/lib/profileBadges";

interface ProfileBadgesProps {
  badges: ProfileBadge[];
}

export function ProfileBadges({ badges }: ProfileBadgesProps) {
  return (
    <View className="gap-2">
      {badges.map((badge) => (
        <View
          key={badge.label}
          className={`flex-row items-center gap-3 rounded-xl border bg-card p-3 ${
            badge.earned ? "border-accent/30" : "border-border/30 opacity-50"
          }`}
        >
          <View
            className={`h-9 w-9 items-center justify-center rounded-full ${
              badge.earned ? "bg-accent/20" : "bg-muted"
            }`}
          >
            <Star
              size={15}
              color={badge.earned ? "#c8893a" : "#8a9e82"}
              fill={badge.earned ? "rgba(200,137,58,0.3)" : "transparent"}
            />
          </View>
          <View className="flex-1">
            <Text className="font-serif text-sm text-foreground">{badge.label}</Text>
            <Text className="font-sans text-[11px] text-muted-foreground">{badge.desc}</Text>
          </View>
          {badge.earned ? <Check size={13} color="#c8893a" /> : null}
        </View>
      ))}
    </View>
  );
}
