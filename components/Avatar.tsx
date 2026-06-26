import { Text, View } from "react-native";

interface AvatarProps {
  user: string;
  color: string;
  size?: number;
}

export function Avatar({ user, color, size = 36 }: AvatarProps) {
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: color }}
    >
      <Text
        className="font-sans-bold text-white"
        style={{ fontSize: size * 0.4 }}
      >
        {user.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}
