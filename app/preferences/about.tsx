import { Alert, Linking, Pressable, ScrollView, Share, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { useAuth } from "@/hooks/useAuth";
import { formatDiagnosticsString, getDeviceDiagnostics } from "@/lib/deviceInfo";
import {
  PRIVACY_POLICY_URL,
  SUPPORT_MAILTO,
  TERMS_OF_SERVICE_URL,
} from "@/lib/legalUrls";

export default function AboutPreferencesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const diagnostics = getDeviceDiagnostics(user?.id);
  const diagnosticsString = formatDiagnosticsString(diagnostics);

  async function shareDiagnostics() {
    try {
      await Share.share({ message: diagnosticsString });
    } catch {
      Alert.alert("Could not share diagnostics");
    }
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader title="About" onBack={() => router.back()} />
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10 pt-2">
        <SettingsGroup title="Support">
          <SettingsRow
            label="Report a bug"
            detail="Send to the team via Feath Board"
            onPress={() => router.push("/preferences/report-bug")}
          />
          <SettingsRow
            label="Contact support"
            detail="info@feath.xyz"
            onPress={() => Linking.openURL(SUPPORT_MAILTO)}
            borderTop
          />
        </SettingsGroup>

        <SettingsGroup title="Legal">
          <SettingsRow
            label="Terms of Service"
            onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}
          />
          <SettingsRow
            label="Privacy Policy"
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
            borderTop
          />
          <SettingsRow
            label="Data sources"
            onPress={() => router.push("/data-sources" as never)}
            borderTop
          />
        </SettingsGroup>

        <Pressable
          onPress={() => void shareDiagnostics()}
          className="mt-4 items-center rounded-xl border border-border bg-card px-4 py-4 active:opacity-90"
        >
          <Text className="font-mono text-[11px] text-muted-foreground">{diagnosticsString}</Text>
          <Text className="mt-2 font-sans text-xs text-primary">Tap to copy / share</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
