import { Pressable, Text, View } from "react-native";
import { MapPin } from "lucide-react-native";
import type { LocationPermissionState } from "@/lib/locationPermission";

interface LocationAccuracyBannerProps {
  permission: LocationPermissionState;
  onEnablePress: () => void;
}

export function LocationAccuracyBanner({
  permission,
  onEnablePress,
}: LocationAccuracyBannerProps) {
  if (permission === "loading" || permission === "granted") {
    return null;
  }

  const denied = permission === "denied";

  return (
    <View className="rounded-xl border border-accent/50 bg-accent/10 px-3 py-2.5">
      <View className="flex-row items-start gap-2">
        <MapPin size={16} color="#c8893a" style={{ marginTop: 2 }} />
        <View className="flex-1 gap-2">
          <Text className="font-sans-medium text-xs text-foreground">
            {denied
              ? "Location is off — results may be inaccurate"
              : "Turn on location for accurate results"}
          </Text>
          <Text className="font-sans text-xs leading-relaxed text-muted-foreground">
            Burd uses GPS to rank birds found near you. Without it, similar
            species from other regions can appear.
          </Text>
          <Pressable
            onPress={onEnablePress}
            className="self-start rounded-lg bg-primary px-3 py-1.5 active:opacity-90"
          >
            <Text className="font-sans-medium text-xs text-primary-foreground">
              {denied ? "Open Settings" : "Enable location"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
