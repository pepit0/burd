import { View } from "react-native";
import { BadgeCheck, Check, FlaskConical } from "lucide-react-native";
import type { UserBadgeFlags } from "@/types";

const VERIFIED_GOLD = "#C8A03A";
const BETA_GREEN = "#A8D5A2";

interface UserStatusBadgesProps extends UserBadgeFlags {
  size?: "sm" | "md";
}

export function UserStatusBadges({
  isVerified = false,
  isBeta = false,
  size = "sm",
}: UserStatusBadgesProps) {
  if (!isVerified && !isBeta) return null;

  const badgeSize = size === "sm" ? 16 : 18;
  const betaBadgeSize = size === "sm" ? 14 : 16;
  const betaIconSize = size === "sm" ? 8 : 9;
  const verifiedCheckSize = size === "sm" ? 7 : 8;

  return (
    <View className="shrink-0 flex-row items-center gap-0.5">
      {isVerified ? (
        <View
          className="items-center justify-center"
          style={{ width: badgeSize, height: badgeSize }}
          accessibilityLabel="Verified account"
        >
          <BadgeCheck
            size={badgeSize}
            color={VERIFIED_GOLD}
            fill={VERIFIED_GOLD}
            strokeWidth={2}
            style={{ position: "absolute" }}
          />
          <Check size={verifiedCheckSize} color="#fff" strokeWidth={3} />
        </View>
      ) : null}
      {isBeta ? (
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: betaBadgeSize,
            height: betaBadgeSize,
            backgroundColor: BETA_GREEN,
          }}
          accessibilityLabel="Beta tester"
        >
          <FlaskConical size={betaIconSize} color="#fff" strokeWidth={2.5} />
        </View>
      ) : null}
    </View>
  );
}
