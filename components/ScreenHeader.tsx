import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronLeft, Feather } from "lucide-react-native";
import { HeaderActions } from "@/components/HeaderActions";
import { NotificationBell } from "@/components/NotificationBell";

interface ScreenHeaderProps {
  title: string;
  showLogo?: boolean;
  action?: ReactNode;
  onBack?: () => void;
}

export function ScreenHeader({
  title,
  showLogo = false,
  action,
  onBack,
}: ScreenHeaderProps) {
  return (
    <View className="flex-row items-center justify-between border-b border-border px-5 pb-3 pt-2">
      <View className="min-w-0 flex-1 flex-row items-center gap-1">
        {onBack ? (
          <Pressable
            onPress={onBack}
            className="-ml-1 rounded-full p-1 active:bg-card"
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={22} color="#8a9e82" />
          </Pressable>
        ) : null}
        {showLogo ? (
          <View className="flex-row items-center gap-2">
            <View className="h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Feather size={14} color="#f0ead6" />
            </View>
            <Text className="font-serif-semibold text-xl tracking-tight text-foreground">
              {title}
            </Text>
          </View>
        ) : (
          <Text className="font-serif-semibold text-lg text-foreground">{title}</Text>
        )}
      </View>

      {onBack ? (
        <View className="w-7" />
      ) : (
        <View className="flex-row items-center gap-1">
          {action}
          <HeaderActions />
          <NotificationBell />
        </View>
      )}
    </View>
  );
}
