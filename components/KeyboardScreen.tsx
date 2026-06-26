import { forwardRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
} from "react-native";
import { hasKeyboardControllerNativeModule } from "@/lib/keyboardAvailable";

type KeyboardScreenProps = ScrollViewProps & {
  bottomOffset?: number;
};

const FallbackKeyboardScreen = forwardRef<ScrollView, KeyboardScreenProps>(
  function FallbackKeyboardScreen(
    { children, contentContainerStyle, ...props },
    ref,
  ) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
        <ScrollView
          ref={ref}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
          {...props}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  },
);

let KeyboardScreenImpl = FallbackKeyboardScreen;

if (hasKeyboardControllerNativeModule) {
  const { KeyboardAwareScrollView } =
    require("react-native-keyboard-controller") as typeof import("react-native-keyboard-controller");

  KeyboardScreenImpl = forwardRef<
    React.ElementRef<typeof KeyboardAwareScrollView>,
    KeyboardScreenProps
  >(function KeyboardScreen(
    { bottomOffset = 20, keyboardShouldPersistTaps = "handled", ...props },
    ref,
  ) {
    return (
      <KeyboardAwareScrollView
        ref={ref}
        bottomOffset={bottomOffset}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        {...props}
      />
    );
  });
}

/** Scroll view that keeps focused text inputs visible above the keyboard. */
export const KeyboardScreen = KeyboardScreenImpl;
