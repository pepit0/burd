import type { ReactNode } from "react";
import { View } from "react-native";
import { hasKeyboardControllerNativeModule } from "@/lib/keyboardAvailable";

export function SafeKeyboardProvider({ children }: { children: ReactNode }) {
  if (!hasKeyboardControllerNativeModule) {
    return <View style={{ flex: 1 }}>{children}</View>;
  }

  const { KeyboardProvider } =
    require("react-native-keyboard-controller") as typeof import("react-native-keyboard-controller");

  return <KeyboardProvider>{children}</KeyboardProvider>;
}
