import { NativeModules } from "react-native";

/** True when the native keyboard-controller module is linked (dev build), not plain Expo Go. */
export const hasKeyboardControllerNativeModule = Boolean(
  NativeModules.KeyboardController || NativeModules.KeyboardControllerView,
);
