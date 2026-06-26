import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { Feather } from "lucide-react-native";
import { HeaderActions } from "@/components/HeaderActions";
import { NotificationBell } from "@/components/NotificationBell";

interface ScreenHeaderProps {
  title: string;
  showLogo?: boolean;
  action?: ReactNode;
}

export function ScreenHeader({ title, showLogo = false, action }: ScreenHeaderProps) {
  return (
    <View className="flex-row items-center justify-between border-b border-border px-5 pb-3 pt-2">
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

      <View className="flex-row items-center gap-1">
        {action}
        <HeaderActions />
        <NotificationBell />
      </View>
    </View>
  );
}
