import { Stack } from "expo-router";

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#181e16" },
      }}
    >
      <Stack.Screen name="index" dangerouslySingular />
      <Stack.Screen name="user-support" dangerouslySingular />
      <Stack.Screen name="edit-post/[id]" dangerouslySingular />
    </Stack>
  );
}
