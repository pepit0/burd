import { Image, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { profileCoverUri } from "@/lib/profileCover";

interface ProfileCoverBannerProps {
  coverUrl?: string | null;
}

export function ProfileCoverBanner({ coverUrl }: ProfileCoverBannerProps) {
  return (
    <View className="h-28 bg-muted">
      <Image
        source={{ uri: profileCoverUri(coverUrl) }}
        className="h-full w-full"
        resizeMode="cover"
      />
      <LinearGradient
        colors={["transparent", "rgba(24,30,22,0.8)"]}
        className="absolute inset-0"
      />
    </View>
  );
}
