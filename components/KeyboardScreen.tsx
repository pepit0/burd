import { forwardRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
} from "react-native";
import {
  DismissKeyboardArea,
  keyboardAwareScrollProps,
} from "@/components/DismissKeyboard";
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
          {...keyboardAwareScrollProps}
          contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
          {...props}
        >
          <DismissKeyboardArea>{children}</DismissKeyboardArea>
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
    { bottomOffset = 20, keyboardShouldPersistTaps = "handled", children, ...props },
    ref,
  ) {
    return (
      <KeyboardAwareScrollView
        ref={ref}
        bottomOffset={bottomOffset}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode="on-drag"
        {...props}
      >
        <DismissKeyboardArea>{children}</DismissKeyboardArea>
      </KeyboardAwareScrollView>
    );
  });
}

/** Scroll view that keeps focused text inputs visible above the keyboard. */
export const KeyboardScreen = KeyboardScreenImpl;
