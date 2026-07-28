import { Tabs } from "expo-router";
import { TabBar } from "@/components/TabBar";

export default function TabLayout() {
  return (
    <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: "#181e16" },
          tabBarStyle: {
            position: "absolute",
            backgroundColor: "transparent",
            borderTopWidth: 0,
            elevation: 0,
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="journal" />
        <Tabs.Screen name="field-guide" />
        <Tabs.Screen name="profile" />
      </Tabs>
  );
}
