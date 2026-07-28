import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import {
  BookOpen,
  Camera,
  Feather,
  Search,
  User,
  type LucideIcon,
} from "lucide-react-native";

const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: "Home", icon: Feather },
  journal: { label: "Journal", icon: BookOpen },
  "field-guide": { label: "Guide", icon: Search },
  profile: { label: "Profile", icon: User },
};

const ACTIVE = "#5f9470";
const INACTIVE = "#8a9e82";

function TabButton({
  routeKey,
  routeName,
  focused,
  onPress,
}: {
  routeKey: string;
  routeName: string;
  focused: boolean;
  onPress: () => void;
}) {
  const meta = TABS[routeName];
  if (!meta) return null;

  const Icon = meta.icon;
  return (
    <Pressable
      key={routeKey}
      onPress={onPress}
      className="flex-1 items-center justify-center gap-1 py-3"
    >
      <Icon size={18} color={focused ? ACTIVE : INACTIVE} strokeWidth={focused ? 2 : 1.5} />
      <View className="items-center gap-1">
        <Text
          className="font-mono text-[9px] uppercase tracking-widest"
          style={{ color: focused ? ACTIVE : INACTIVE }}
        >
          {meta.label}
        </Text>
        <View className="h-0.5 w-6">
          {focused ? (
            <View className="h-0.5 w-6 rounded-full bg-primary" />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const routes = state.routes.filter((r) => TABS[r.name]);
  const left = routes.slice(0, 2);
  const right = routes.slice(2);

  const renderTab = (route: (typeof state.routes)[number]) => {
    const focused = state.routes[state.index].key === route.key;
    return (
      <TabButton
        key={route.key}
        routeKey={route.key}
        routeName={route.name}
        focused={focused}
        onPress={() => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
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
        className="rounded-[28px] border border-border/50 bg-card/95"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
          elevation: 12,
        }}
      >
        <View className="flex-row items-center">
          {left.map(renderTab)}

          <View className="px-2">
            <Pressable
              onPress={() => router.push("/camera")}
              className="-mt-8 h-[72px] w-[72px] items-center justify-center rounded-full border-[5px] border-card bg-primary active:opacity-90"
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
          </View>

          {right.map(renderTab)}
        </View>
      </View>
    </View>
  );
}
