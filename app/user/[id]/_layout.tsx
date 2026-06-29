import { Stack } from "expo-router";

export default function UserProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#181e16" },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="journal" />
    </Stack>
  );
}
