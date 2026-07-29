import { Stack } from "expo-router";

export default function PreferencesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#1a2318" } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="account" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="appearance" />
      <Stack.Screen name="accessibility" />
      <Stack.Screen name="about" />
      <Stack.Screen name="delete-account" />
      <Stack.Screen name="report-bug" />
    </Stack>
  );
}
