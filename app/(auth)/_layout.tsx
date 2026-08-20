import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      initialRouteName="login"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#181e16" },
      }}
    >
      <Stack.Screen name="login" dangerouslySingular />
      <Stack.Screen name="register" dangerouslySingular />
      <Stack.Screen name="choose-username" dangerouslySingular />
      <Stack.Screen name="age-assurance" dangerouslySingular />
    </Stack>
  );
}
