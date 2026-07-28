import type { ReactNode } from "react";
import {
  Keyboard,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type DismissKeyboardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Wrap a screen so taps on non-interactive areas dismiss the keyboard. */
export function DismissKeyboard({ children, style }: DismissKeyboardProps) {
  return (
    <Pressable
      style={[{ flex: 1 }, style]}
      onPress={Keyboard.dismiss}
      accessible={false}
    >
      {children}
    </Pressable>
  );
}

type DismissKeyboardAreaProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Place inside scroll views so empty-space taps dismiss the keyboard while
 * nested buttons and inputs still receive the first tap.
 */
export function DismissKeyboardArea({ children, style }: DismissKeyboardAreaProps) {
  return (
    <Pressable
      style={[{ flexGrow: 1 }, style]}
      onPress={Keyboard.dismiss}
      accessible={false}
    >
      {children}
    </Pressable>
  );
}

export const keyboardAwareScrollProps = {
  keyboardShouldPersistTaps: "handled" as const,
  keyboardDismissMode: "on-drag" as const,
};

export function dismissKeyboardOnScrollDrag() {
  Keyboard.dismiss();
}
