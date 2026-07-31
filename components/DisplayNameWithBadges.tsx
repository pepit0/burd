import { View, type TextProps, type ViewProps } from "react-native";
import { DisplayNameText } from "@/components/DisplayNameText";
import { UserStatusBadges } from "@/components/UserStatusBadges";
import type { UserBadgeFlags } from "@/types";

interface DisplayNameWithBadgesProps extends TextProps, UserBadgeFlags {
  text: string;
  containerClassName?: string;
  containerStyle?: ViewProps["style"];
  badgeSize?: "sm" | "md";
  /** Profile pages — tap status badges for a short description. */
  interactiveBadges?: boolean;
}

export function DisplayNameWithBadges({
  text,
  isVerified,
  isBeta,
  containerClassName = "",
  containerStyle,
  badgeSize = "sm",
  interactiveBadges = false,
  ...textProps
}: DisplayNameWithBadgesProps) {
  return (
    <View
      className={`max-w-full flex-row items-center gap-1 ${containerClassName}`}
      style={containerStyle}
    >
      <View className="min-w-0 shrink">
        <DisplayNameText text={text} {...textProps} />
      </View>
      <UserStatusBadges
        isVerified={isVerified}
        isBeta={isBeta}
        size={badgeSize}
        interactive={interactiveBadges}
      />
    </View>
  );
}
