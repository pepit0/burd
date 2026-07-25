import { type ReactNode, useEffect, useState } from "react";
import { Platform, useWindowDimensions, View } from "react-native";

/** Match typical phone width; desktop web gets a centered column. */
const DESKTOP_MIN_WIDTH = 768;
const APP_MAX_WIDTH = 430;

/**
 * On desktop browsers only, constrain the app to a centered phone-width column.
 * Mobile web (<768px) is unchanged.
 */
export function WebDesktopFrame({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDesktopWeb =
    Platform.OS === "web" && mounted && width >= DESKTOP_MIN_WIDTH;

  if (!isDesktopWeb) {
    return <>{children}</>;
  }

  return (
    <View className="min-h-full flex-1 flex-row justify-center bg-[#0f120e]">
      <View
        className="h-full min-h-full flex-1 border-x border-border/40 bg-background shadow-2xl"
        style={{ maxWidth: APP_MAX_WIDTH, width: "100%" }}
      >
        {children}
      </View>
    </View>
  );
}
