import { Text, View } from "react-native";
import { Image } from "expo-image";

interface AvatarProps {
  user: string;
  color: string;
  avatarUrl?: string | null;
  size?: number;
}

export function Avatar({ user, color, avatarUrl, size = 36 }: AvatarProps) {
  return (
    <View
      className="items-center justify-center overflow-hidden rounded-full"
      style={{ width: size, height: size, backgroundColor: color }}
    >
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: size, height: size }}
          contentFit="cover"
          recyclingKey={avatarUrl}
        />
      ) : (
        <Text
          className="font-sans-bold text-white"
          style={{ fontSize: size * 0.4 }}
        >
          {user.charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}
