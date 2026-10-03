import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import {
  BookOpen,
  Camera,
  Feather,
  Search,
  User,
  type LucideIcon,
} from "lucide-react-native";
import { Avatar } from "@/components/Avatar";
import { useAppTourOptional } from "@/components/AppTourProvider";
import { TourSpotlight } from "@/components/TourSpotlight";
import { useAuth } from "@/hooks/useAuth";
import { triggerTabHaptic } from "@/lib/haptics";
import { getMyProfile } from "@/lib/sightings";
import { setGuideTabCenter } from "@/lib/tabBarTargets";
import type { AppTourSpotlight } from "@/lib/appTourSteps";

const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: "Home", icon: Feather },
  journal: { label: "Journal", icon: BookOpen },
  "field-guide": { label: "Guide", icon: Search },
  profile: { label: "Profile", icon: User },
};

const GREEN = "#5f9470";
const GOLD = "#c8893a";
const INACTIVE = "#8a9e82";
const ICON_BASE = 22;
const PROFILE_RING = 32;
const PROFILE_AVATAR = 26;
const PROFILE_BORDER = 1;
const TOUR_MAGNIFY = 2.1;
const TOUR_LIFT = 12;

const TAB_SPOTLIGHT: Record<string, AppTourSpotlight> = {
  index: "tab-home",
  journal: "tab-journal",
  "field-guide": "tab-guide",
  profile: "tab-profile",
};

type ProfileTabAvatar = {
  username: string;
  avatar_color: string;
  avatar_url: string | null;
};

const iconLayer = StyleSheet.create({
  stack: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  layer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  profileRing: {
    width: PROFILE_RING,
    height: PROFILE_RING,
    borderRadius: PROFILE_RING / 2,
    borderWidth: PROFILE_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  profileStack: {
    width: PROFILE_RING,
    height: PROFILE_RING,
    alignItems: "center",
    justifyContent: "center",
  },
});

function TabButton({
  routeKey,
  routeName,
  focused,
  onPress,
  profileAvatar,
}: {
  routeKey: string;
  routeName: string;
  focused: boolean;
  onPress: () => void;
  profileAvatar?: ProfileTabAvatar | null;
}) {
  const meta = TABS[routeName];
  const tour = useAppTourOptional();
  const tourHighlight =
    tour?.phase === "tour" && tour.spotlight === TAB_SPOTLIGHT[routeName];
  const tabRef = useRef<View>(null);
  const scale = useSharedValue(focused ? 1.14 : 1);
  const lift = useSharedValue(0);
  const goldMix = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    scale.value = withSpring(tourHighlight ? TOUR_MAGNIFY : focused ? 1.14 : 1, {
      damping: 13,
      stiffness: 180,
    });
    lift.value = withSpring(tourHighlight ? -TOUR_LIFT : 0, {
      damping: 13,
      stiffness: 180,
    });
    goldMix.value = withTiming(tourHighlight || focused ? 1 : 0, { duration: 240 });
  }, [focused, goldMix, lift, scale, tourHighlight]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { scale: scale.value }],
  }));
  const inactiveStyle = useAnimatedStyle(() => ({
    opacity: focused || tourHighlight ? 0 : 1,
  }));
  const greenStyle = useAnimatedStyle(() => ({
    opacity: tourHighlight ? 0 : focused ? 1 - goldMix.value : 0,
  }));
  const goldStyle = useAnimatedStyle(() => ({
    opacity: tourHighlight ? 1 : focused ? goldMix.value : 0,
  }));
  const profileRingStyle = useAnimatedStyle(() => ({
    opacity: focused || tourHighlight ? 1 : 0.72,
    borderColor:
      focused || tourHighlight
        ? interpolateColor(goldMix.value, [0, 1], [GREEN, GOLD])
        : INACTIVE,
  }));

  if (!meta) return null;

  const Icon = meta.icon;
  const showProfileAvatar = routeName === "profile" && profileAvatar;

  return (
    <Pressable
      ref={tabRef}
      key={routeKey}
      onPress={onPress}
      onLayout={() => {
        if (routeName !== "field-guide") return;
        tabRef.current?.measureInWindow((x, y, width, height) => {
          setGuideTabCenter({ x: x + width / 2, y: y + height / 2 });
        });
      }}
      accessibilityLabel={meta.label}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      className="flex-1 items-center justify-center py-3"
      style={{ zIndex: tourHighlight ? 8 : 0, overflow: "visible" }}
    >
      <TourSpotlight
        target={TAB_SPOTLIGHT[routeName] ?? "none"}
        magnify={TOUR_MAGNIFY}
        lift={TOUR_LIFT}
        style={{ borderRadius: 999, overflow: "visible" }}
      >
      {showProfileAvatar ? (
        <Animated.View style={[iconStyle, iconLayer.profileStack]}>
          <Animated.View style={[iconLayer.profileRing, profileRingStyle]}>
            <Avatar
              user={profileAvatar.username}
              color={profileAvatar.avatar_color}
              avatarUrl={profileAvatar.avatar_url}
              size={PROFILE_AVATAR}
            />
          </Animated.View>
        </Animated.View>
      ) : (
        <Animated.View style={[iconStyle, iconLayer.stack]}>
          <Animated.View pointerEvents="none" style={[iconLayer.layer, inactiveStyle]}>
            <Icon size={ICON_BASE} color={INACTIVE} strokeWidth={1.75} />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[iconLayer.layer, greenStyle]}>
            <Icon size={ICON_BASE} color={GREEN} strokeWidth={2.25} />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[iconLayer.layer, goldStyle]}>
            <Icon size={ICON_BASE} color={GOLD} strokeWidth={2.25} />
          </Animated.View>
        </Animated.View>
      )}
      </TourSpotlight>
    </Pressable>
  );
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const tour = useAppTourOptional();
  const tourLocksTabs = tour != null && tour.phase !== "idle";
  const [profileAvatar, setProfileAvatar] = useState<ProfileTabAvatar | null>(null);
  const routes = state.routes.filter((r) => TABS[r.name]);
  const left = routes.slice(0, 2);
  const right = routes.slice(2);

  const loadProfileAvatar = useCallback(async () => {
    if (!user?.id) {
      setProfileAvatar(null);
      return;
    }

    try {
      const profile = await getMyProfile(user.id);
      if (!profile) return;
      setProfileAvatar({
        username: profile.username,
        avatar_color: profile.avatar_color,
        avatar_url: profile.avatar_url,
      });
    } catch {
      // Keep the last known avatar if refresh fails.
    }
  }, [user?.id]);

  useEffect(() => {
    void loadProfileAvatar();
  }, [loadProfileAvatar, state.index]);

  const renderTab = (route: (typeof state.routes)[number]) => {
    const focused = state.routes[state.index].key === route.key;
    return (
      <TabButton
        key={route.key}
        routeKey={route.key}
        routeName={route.name}
        focused={focused}
        profileAvatar={route.name === "profile" ? profileAvatar : null}
        onPress={() => {
          if (tourLocksTabs) return;
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            triggerTabHaptic();
            navigation.navigate(route.name);
          }
        }}
      />
    );
  };

  return (
    <View
      pointerEvents="box-none"
      className="absolute bottom-0 left-0 right-0 px-4"
      style={{
        paddingBottom: Math.max(insets.bottom, 12),
        paddingTop: 28,
      }}
    >
      <View
        style={{
          overflow: "visible",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
          elevation: 12,
        }}
      >
        <View
          pointerEvents="none"
          className="absolute inset-0 rounded-[28px] border border-border/50 bg-card/95"
        />
        <View className="flex-row items-center" style={{ overflow: "visible" }}>
          {left.map(renderTab)}

          <View className="px-2">
            <TourSpotlight
              target="camera-fab"
              style={{ borderRadius: 999, marginTop: -32, overflow: "visible" }}
            >
            <Pressable
              onPress={() => {
                if (tourLocksTabs) return;
                triggerTabHaptic();
                router.push("/camera");
              }}
              accessibilityLabel="Camera"
              className="h-[72px] w-[72px] items-center justify-center rounded-full border-[5px] border-card bg-primary active:opacity-90"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 8,
                elevation: 10,
              }}
            >
              <Camera size={28} color="#f0ead6" strokeWidth={2.25} />
            </Pressable>
            </TourSpotlight>
          </View>

          {right.map(renderTab)}
        </View>
      </View>
    </View>
  );
}
