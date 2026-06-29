import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  type ViewProps,
} from "react-native";
import { hasKeyboardControllerNativeModule } from "@/lib/keyboardAvailable";

type KeyboardModalAvoidProps = ViewProps & {
  children: ReactNode;
};

function FallbackKeyboardModalAvoid({
  children,
  style,
  ...props
}: KeyboardModalAvoidProps) {
  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, style]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      {...props}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

let KeyboardModalAvoidImpl = FallbackKeyboardModalAvoid;

if (hasKeyboardControllerNativeModule) {
  const { KeyboardAvoidingView: ControllerKeyboardAvoidingView } =
    require("react-native-keyboard-controller") as typeof import("react-native-keyboard-controller");

  KeyboardModalAvoidImpl = function KeyboardModalAvoid({
    children,
    style,
    ...props
  }: KeyboardModalAvoidProps) {
    return (
      <ControllerKeyboardAvoidingView
        behavior="padding"
        style={[{ flex: 1 }, style]}
        {...props}
      >
        {children}
      </ControllerKeyboardAvoidingView>
    );
  };
}

/** Keeps bottom-sheet modal content above the keyboard. */
export const KeyboardModalAvoid = KeyboardModalAvoidImpl;
