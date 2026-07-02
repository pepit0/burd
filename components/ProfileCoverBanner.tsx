import { Image, Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ImageIcon } from "lucide-react-native";
import { profileCoverUri } from "@/lib/profileCover";

interface ProfileCoverBannerProps {
  coverUrl?: string | null;
  editable?: boolean;
  onPress?: () => void;
}

export function ProfileCoverBanner({
  coverUrl,
  editable = false,
  onPress,
}: ProfileCoverBannerProps) {
  const content = (
    <>
      <Image
        source={{ uri: profileCoverUri(coverUrl) }}
        className="h-full w-full"
        resizeMode="cover"
      />
      <LinearGradient
        colors={["transparent", "rgba(24,30,22,0.8)"]}
        className="absolute inset-0"
      />
      {editable ? (
        <View
          className="absolute bottom-2 right-2 h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-card shadow-sm"
          style={{ elevation: 4 }}
        >
          <ImageIcon size={13} color="#8a9e82" />
        </View>
      ) : null}
    </>
  );

  if (editable && onPress) {
    return (
      <Pressable onPress={onPress} className="h-28 bg-muted active:opacity-95">
        {content}
      </Pressable>
    );
  }

  return <View className="h-28 bg-muted">{content}</View>;
}
