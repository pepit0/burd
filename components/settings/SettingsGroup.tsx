import type { ReactNode } from "react";
import { Text, View } from "react-native";

interface SettingsGroupProps {
  title?: string;
  footer?: string;
  children: ReactNode;
}

export function SettingsGroup({ title, footer, children }: SettingsGroupProps) {
  return (
    <View className="mb-6">
      {title ? (
        <Text className="mb-2 px-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {title}
        </Text>
      ) : null}
      <View className="overflow-hidden rounded-xl border border-border bg-card">{children}</View>
      {footer ? (
        <Text className="mt-2 px-1 font-sans text-xs leading-relaxed text-muted-foreground">
          {footer}
        </Text>
      ) : null}
    </View>
  );
}
