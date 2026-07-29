import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

interface SettingsRowProps {
  label: string;
  value?: string;
  detail?: string;
  onPress?: () => void;
  borderTop?: boolean;
  destructive?: boolean;
  right?: ReactNode;
  showChevron?: boolean;
}

export function SettingsRow({
  label,
  value,
  detail,
  onPress,
  borderTop = false,
  destructive = false,
  right,
  showChevron = true,
}: SettingsRowProps) {
  const content = (
    <>
      <View className="min-w-0 flex-1 pr-3">
        <Text
          className={`font-sans-medium text-sm ${
            destructive ? "text-destructive" : "text-foreground"
          }`}
        >
          {label}
        </Text>
        {detail ? (
          <Text className="mt-0.5 font-sans text-xs leading-relaxed text-muted-foreground">
            {detail}
          </Text>
        ) : null}
      </View>
      {right ?? (
        <View className="flex-row items-center gap-1">
          {value ? (
            <Text className="font-sans text-sm text-muted-foreground">{value}</Text>
          ) : null}
          {showChevron && onPress ? <ChevronRight size={16} color="#8a9e82" /> : null}
        </View>
      )}
    </>
  );

  if (!onPress) {
    return (
      <View
        className={`flex-row items-center px-4 py-3.5 ${
          borderTop ? "border-t border-border" : ""
        }`}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center px-4 py-3.5 active:bg-card/80 ${
        borderTop ? "border-t border-border" : ""
      }`}
    >
      {content}
    </Pressable>
  );
}
