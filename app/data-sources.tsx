import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  getDataAttribution,
  getManifestVersion,
} from "@/lib/regionalFrequency";

export default function DataSourcesScreen() {
  const router = useRouter();
  const attribution = getDataAttribution();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScreenHeader title="Data sources" onBack={() => router.back()} />
      <ScrollView className="flex-1 px-4 pb-8" contentContainerClassName="gap-4">
        <Text className="font-sans text-sm leading-relaxed text-muted-foreground">
          Burd uses commercially licensed and open data to improve species
          identification and regional rarity. Occurrence frequencies are
          aggregated to grid cells — raw third-party coordinates are not
          redistributed in the app.
        </Text>

        <View className="rounded-xl border border-border bg-card p-4">
          <Text className="font-sans-medium text-sm text-foreground">
            Bundle version
          </Text>
          <Text className="mt-1 font-mono text-xs text-muted-foreground">
            {getManifestVersion()}
          </Text>
        </View>

        <View className="rounded-xl border border-border bg-card p-4">
          <Text className="mb-2 font-sans-medium text-sm text-foreground">
            Attribution
          </Text>
          {attribution.map((line) => (
            <Text
              key={line}
              className="mb-2 font-sans text-sm leading-relaxed text-muted-foreground"
            >
              {line}
            </Text>
          ))}
          <Text className="font-sans text-sm leading-relaxed text-muted-foreground">
            Community sighting aggregates are derived from Burd user logs
            (grid-cell counts only).
          </Text>
        </View>

        <View className="rounded-xl border border-border bg-card p-4">
          <Text className="font-sans-medium text-sm text-foreground">
            Licenses used
          </Text>
          <Text className="mt-2 font-sans text-sm leading-relaxed text-muted-foreground">
            GBIF occurrence records: Creative Commons CC0 1.0 and CC BY 4.0
            only. Records under CC BY-NC are excluded from commercial builds.
          </Text>
          <Text className="mt-2 font-sans text-sm leading-relaxed text-muted-foreground">
            ML models: Google Perch (Apache-2.0), birder vision weights per
            project configuration.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
