import { Linking, Text, View } from "react-native";
import { TERMS_OF_SERVICE_URL } from "@/lib/legalUrls";

interface IdDisclaimerBannerProps {
  variant?: "light" | "dark";
  className?: string;
}

export function IdDisclaimerBanner({
  variant = "light",
  className = "",
}: IdDisclaimerBannerProps) {
  const isDark = variant === "dark";

  return (
    <View
      className={`rounded-xl px-3 py-2 ${
        isDark ? "bg-black/55" : "border border-border/60 bg-card/80"
      } ${className}`}
    >
      <Text
        className={`font-sans text-[11px] leading-relaxed ${
          isDark ? "text-white/75" : "text-muted-foreground"
        }`}
      >
        IDs are best-effort for recreational birding, not authoritative.{" "}
        <Text
          onPress={() => void Linking.openURL(TERMS_OF_SERVICE_URL)}
          className={`underline ${isDark ? "text-white/90" : "text-foreground/80"}`}
        >
          Terms
        </Text>
      </Text>
    </View>
  );
}
