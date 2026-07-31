import { useCallback, useRef, useState, type RefObject } from "react";
import {
  Modal,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type View as RNView,
} from "react-native";
import { BadgeCheck, Check, FlaskConical } from "lucide-react-native";
import {
  USER_STATUS_BADGE_HINTS,
  type UserStatusBadgeKind,
} from "@/lib/userStatusBadgeHints";
import type { UserBadgeFlags } from "@/types";

const VERIFIED_GOLD = "#C8A03A";
const BETA_GREEN = "#A8D5A2";
const TOOLTIP_MAX_WIDTH = 240;
const SCREEN_EDGE = 12;

interface BadgeAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UserStatusBadgesProps extends UserBadgeFlags {
  size?: "sm" | "md";
  /** Profile pages — tap a badge to show what it means; tap elsewhere to dismiss. */
  interactive?: boolean;
}

export function UserStatusBadges({
  isVerified = false,
  isBeta = false,
  size = "sm",
  interactive = false,
}: UserStatusBadgesProps) {
  const { width: screenWidth } = useWindowDimensions();
  const [activeHint, setActiveHint] = useState<UserStatusBadgeKind | null>(null);
  const [anchor, setAnchor] = useState<BadgeAnchor | null>(null);
  const verifiedRef = useRef<RNView>(null);
  const betaRef = useRef<RNView>(null);

  const dismissHint = useCallback(() => {
    setActiveHint(null);
    setAnchor(null);
  }, []);

  const showHint = useCallback(
    (kind: UserStatusBadgeKind, ref: RefObject<RNView | null>) => {
      if (!interactive) return;

      if (activeHint === kind) {
        dismissHint();
        return;
      }

      ref.current?.measureInWindow((x, y, width, height) => {
        setAnchor({ x, y, width, height });
        setActiveHint(kind);
      });
    },
    [activeHint, dismissHint, interactive],
  );

  if (!isVerified && !isBeta) return null;

  const badgeSize = size === "sm" ? 16 : 18;
  const betaBadgeSize = size === "sm" ? 14 : 16;
  const betaIconSize = size === "sm" ? 8 : 9;
  const verifiedCheckSize = size === "sm" ? 7 : 8;

  const tooltipLeft =
    anchor == null
      ? SCREEN_EDGE
      : Math.min(
          Math.max(SCREEN_EDGE, anchor.x + anchor.width / 2 - TOOLTIP_MAX_WIDTH / 2),
          screenWidth - TOOLTIP_MAX_WIDTH - SCREEN_EDGE,
        );

  const tooltipTop = anchor == null ? 0 : anchor.y + anchor.height + 6;

  const BadgeShell = interactive ? Pressable : View;

  return (
    <>
      <View className="shrink-0 flex-row items-center gap-0.5">
        {isVerified ? (
          <BadgeShell
            ref={verifiedRef}
            onPress={
              interactive ? () => showHint("verified", verifiedRef) : undefined
            }
            hitSlop={interactive ? 6 : undefined}
            className="items-center justify-center active:opacity-80"
            style={{ width: badgeSize, height: badgeSize }}
            accessibilityLabel="Verified account"
            accessibilityRole={interactive ? "button" : undefined}
            accessibilityHint={
              interactive ? "Shows what the verified badge means" : undefined
            }
          >
            <BadgeCheck
              size={badgeSize}
              color={VERIFIED_GOLD}
              fill={VERIFIED_GOLD}
              strokeWidth={2}
              style={{ position: "absolute" }}
            />
            <Check size={verifiedCheckSize} color="#fff" strokeWidth={3} />
          </BadgeShell>
        ) : null}
        {isBeta ? (
          <BadgeShell
            ref={betaRef}
            onPress={interactive ? () => showHint("beta", betaRef) : undefined}
            hitSlop={interactive ? 6 : undefined}
            className="items-center justify-center rounded-full active:opacity-80"
            style={{
              width: betaBadgeSize,
              height: betaBadgeSize,
              backgroundColor: BETA_GREEN,
            }}
            accessibilityLabel="Beta tester"
            accessibilityRole={interactive ? "button" : undefined}
            accessibilityHint={
              interactive ? "Shows what the beta tester badge means" : undefined
            }
          >
            <FlaskConical size={betaIconSize} color="#fff" strokeWidth={2.5} />
          </BadgeShell>
        ) : null}
      </View>

      {interactive && activeHint && anchor ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={dismissHint}
        >
          <View className="flex-1">
            <Pressable
              className="absolute inset-0"
              onPress={dismissHint}
              accessible={false}
            />
            <View
              pointerEvents="box-none"
              style={{
                position: "absolute",
                top: tooltipTop,
                left: tooltipLeft,
                maxWidth: TOOLTIP_MAX_WIDTH,
              }}
            >
              <View className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-lg">
                <Text className="font-sans text-xs leading-relaxed text-foreground">
                  {USER_STATUS_BADGE_HINTS[activeHint]}
                </Text>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}
