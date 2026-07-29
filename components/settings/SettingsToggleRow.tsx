import { Switch, Text, View } from "react-native";
import { useColorTheme } from "@/components/ColorThemeProvider";

interface SettingsToggleRowProps {
  label: string;
  detail?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  borderTop?: boolean;
  disabled?: boolean;
}

export function SettingsToggleRow({
  label,
  detail,
  value,
  onValueChange,
  borderTop = false,
  disabled = false,
}: SettingsToggleRowProps) {
  const { palette } = useColorTheme();

  return (
    <View
      className={`flex-row items-center px-4 py-3.5 ${
        borderTop ? "border-t border-border" : ""
      }`}
    >
      <View className="min-w-0 flex-1 pr-3">
        <Text className="font-sans-medium text-sm text-foreground">{label}</Text>
        {detail ? (
          <Text className="mt-0.5 font-sans text-xs leading-relaxed text-muted-foreground">
            {detail}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: palette.muted, true: palette.primary }}
        thumbColor={palette.primaryForeground}
        ios_backgroundColor={palette.muted}
        style={{ flexShrink: 0 }}
      />
    </View>
  );
}
