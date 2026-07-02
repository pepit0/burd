import { View } from "react-native";
import { Mic } from "lucide-react-native";

interface AudioPostThumbProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const ICON_SIZE = { sm: 16, md: 22, lg: 32 } as const;

export function AudioPostThumb({ size = "md", className = "" }: AudioPostThumbProps) {
  return (
    <View className={`items-center justify-center bg-primary/10 ${className}`}>
      <Mic size={ICON_SIZE[size]} color="#5f9470" />
    </View>
  );
}
