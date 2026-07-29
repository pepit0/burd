import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { SettingsToggleRow } from "@/components/settings/SettingsToggleRow";
import { useAccessibility } from "@/components/AccessibilityProvider";
import { useColorTheme } from "@/components/ColorThemeProvider";
import { paletteForMode } from "@/lib/colorTheme";

function PalettePreview({ mode }: { mode: "default" | "colorblind" }) {
  const palette = paletteForMode(mode);
  const swatches = [
    { color: palette.primary, label: "Primary" },
    { color: palette.accent, label: "Accent" },
    { color: palette.destructive, label: "Alert" },
    { color: palette.mutedForeground, label: "Muted" },
  ];

  return (
    <View className="flex-1 rounded-lg border border-border p-2">
      <Text className="mb-2 font-sans-medium text-[11px] text-foreground">
        {mode === "colorblind" ? "Colorblind" : "Default"}
      </Text>
      <View className="flex-row gap-1">
        {swatches.map((s) => (
          <View key={s.label} className="flex-1 items-center gap-1">
            <View className="h-6 w-full rounded" style={{ backgroundColor: s.color }} />
            <Text className="font-mono text-[8px] text-muted-foreground">{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function AccessibilityPreferencesScreen() {
  const router = useRouter();
  const { mode, setMode } = useColorTheme();
  const { hapticsEnabled, setHapticsEnabled, reduceMotion } = useAccessibility();
  const colorblindEnabled = mode === "colorblind";

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader title="Accessibility" onBack={() => router.back()} />
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10 pt-2">
        <SettingsGroup
          title="Colorblind mode"
          footer="Side-by-side preview before enabling. Replaces green-forward colors with a blue/orange accessible palette."
        >
          <View className="flex-row gap-2 p-3">
            <PalettePreview mode="default" />
            <PalettePreview mode="colorblind" />
          </View>
          <SettingsToggleRow
            label="Colorblind Mode"
            detail="Use the accessible palette app-wide"
            value={colorblindEnabled}
            onValueChange={(enabled) => void setMode(enabled ? "colorblind" : "default")}
            borderTop
          />
        </SettingsGroup>

        <SettingsGroup title="Motion & feedback">
          <SettingsToggleRow
            label="Haptic feedback"
            detail="Vibration on key actions like likes"
            value={hapticsEnabled}
            onValueChange={(next) => void setHapticsEnabled(next)}
          />
          <View className="border-t border-border px-4 py-3.5">
            <Text className="font-sans-medium text-sm text-foreground">Reduce motion</Text>
            <Text className="mt-0.5 font-sans text-xs text-muted-foreground">
              {reduceMotion
                ? "Following your device setting — animations are reduced"
                : "Controlled by iOS Settings → Accessibility → Motion"}
            </Text>
          </View>
          <View className="border-t border-border px-4 py-3.5">
            <Text className="font-sans-medium text-sm text-foreground">Dynamic Type</Text>
            <Text className="mt-0.5 font-sans text-xs text-muted-foreground">
              Burd respects your system text size in settings and profile screens.
            </Text>
          </View>
        </SettingsGroup>
      </ScrollView>
    </SafeAreaView>
  );
}
