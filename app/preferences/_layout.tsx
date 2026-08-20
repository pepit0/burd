import { Stack } from "expo-router";
import { BURD_PRO_ENABLED } from "@/lib/burdProEnabled";

export default function PreferencesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#1a2318" } }}>
      <Stack.Screen name="index" dangerouslySingular />
      <Stack.Screen name="account" dangerouslySingular />
      <Stack.Screen name="privacy" dangerouslySingular />
      <Stack.Screen name="blocked-users" dangerouslySingular />
      <Stack.Screen name="notifications" dangerouslySingular />
      <Stack.Screen name="appearance" dangerouslySingular />
      <Stack.Screen name="accessibility" dangerouslySingular />
      <Stack.Screen name="about" dangerouslySingular />
      {BURD_PRO_ENABLED ? (
        <Stack.Screen name="subscription" dangerouslySingular />
      ) : null}
      <Stack.Screen name="delete-account" dangerouslySingular />
      <Stack.Screen name="report-bug" dangerouslySingular />
    </Stack>
  );
}
