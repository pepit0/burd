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
  index: { label: "Feed", icon: Feather },
  journal: { label: "Journal", icon: BookOpen },
  "field-guide": { label: "Field Guide", icon: Search },
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
  if (!meta) {
    return null;
  }
  const Icon = meta.icon;
  return (
    <Pressable
      key={routeKey}
      onPress={onPress}
      className="relative flex-1 items-center justify-center gap-1 py-3"
    >
      <Icon size={18} color={focused ? ACTIVE : INACTIVE} strokeWidth={focused ? 2 : 1.5} />
      <Text
        className="font-mono text-[9px] uppercase tracking-widest"
        style={{ color: focused ? ACTIVE : INACTIVE }}
      >
        {meta.label}
      </Text>
      {focused && (
        <View className="absolute bottom-0 h-0.5 w-6 rounded-t-full bg-primary" />
      )}
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
      className="border-t border-border bg-card"
      style={{ paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-center">
        {left.map(renderTab)}

        <View className="px-2">
          <Pressable
            onPress={() => router.push("/camera")}
            className="-mt-8 h-[72px] w-[72px] items-center justify-center rounded-full border-[5px] border-background bg-primary active:opacity-90"
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
  );
}
