import { Image, Text, View } from "react-native";

interface AvatarProps {
  user: string;
  color: string;
  avatarUrl?: string | null;
  size?: number;
}

export function Avatar({ user, color, avatarUrl, size = 36 }: AvatarProps) {
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: color }}
    >
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          className="h-full w-full rounded-full"
          resizeMode="cover"
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
