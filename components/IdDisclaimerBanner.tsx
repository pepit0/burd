import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Info, X } from "lucide-react-native";
import { TERMS_OF_SERVICE_URL } from "@/lib/legalUrls";

interface IdDisclaimerBannerProps {
  variant?: "light" | "dark";
  className?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

interface IdDisclaimerInfoButtonProps {
  active?: boolean;
  onPress: () => void;
  variant?: "light" | "dark";
  className?: string;
}

const darkStyles = StyleSheet.create({
  panel: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  copy: {
    color: "#eee8d4",
    fontSize: 11,
    lineHeight: 16,
  },
  copyWrap: {
    flex: 1,
  },
  link: {
    color: "#f0ead6",
    textDecorationLine: "underline",
  },
});

export function IdDisclaimerInfoButton({
  active = false,
  onPress,
  variant = "light",
  className = "",
}: IdDisclaimerInfoButtonProps) {
  const isDark = variant === "dark";

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="Bird ID accuracy information"
      accessibilityHint="Shows disclaimer about identification accuracy"
      accessibilityState={{ expanded: active }}
      className={`h-11 w-11 items-center justify-center rounded-full ${
        active
          ? isDark
            ? "bg-accent"
            : "border border-primary bg-card"
          : isDark
            ? "bg-background/60"
            : "border border-border/60 bg-card/80"
      } ${className}`}
    >
      <Info size={18} color={active ? "#181e16" : isDark ? "#eee8d4" : "#8a9e82"} />
    </Pressable>
  );
}

export function IdDisclaimerBanner({
  variant = "light",
  className = "",
  dismissible = false,
  onDismiss,
}: IdDisclaimerBannerProps) {
  const isDark = variant === "dark";

  if (isDark) {
    return (
      <View style={darkStyles.panel} className={className}>
        <View style={darkStyles.row}>
          <View style={darkStyles.copyWrap}>
            <Text style={darkStyles.copy}>
              IDs are best-effort for recreational birding, not authoritative.{" "}
              <Text
                onPress={() => void Linking.openURL(TERMS_OF_SERVICE_URL)}
                style={darkStyles.link}
              >
                Terms
              </Text>
            </Text>
          </View>
          {dismissible ? (
            <Pressable
              onPress={onDismiss}
              hitSlop={8}
              accessibilityLabel="Dismiss ID disclaimer"
              className="p-0.5"
            >
              <X size={14} color="#eee8d4" />
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View
      className={`rounded-xl border border-border/60 bg-card/80 px-3 py-2 ${className}`}
    >
      <View className="flex-row items-start gap-2">
        <View className="min-w-0 flex-1">
          <Text className="font-sans text-[11px] leading-relaxed text-muted-foreground">
            IDs are best-effort for recreational birding, not authoritative.{" "}
            <Text
              onPress={() => void Linking.openURL(TERMS_OF_SERVICE_URL)}
              className="text-foreground/80 underline"
            >
              Terms
            </Text>
          </Text>
        </View>
        {dismissible ? (
          <Pressable
            onPress={onDismiss}
            hitSlop={8}
            accessibilityLabel="Dismiss ID disclaimer"
            className="p-0.5"
          >
            <X size={14} color="#8a9e82" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
