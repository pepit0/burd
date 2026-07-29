import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/hooks/useAuth";
import { formatDiagnosticsString, getDeviceDiagnostics } from "@/lib/deviceInfo";
import { getUserFacingMessage } from "@/lib/errors";
import { submitBugReport } from "@/lib/profilePreferences";

export default function ReportBugScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const deviceInfo = formatDiagnosticsString(getDeviceDiagnostics(user?.id));

  function confirmSubmit() {
    const trimmed = description.trim();
    if (trimmed.length < 10) {
      Alert.alert("Add more detail", "Please describe the bug in at least a few words.");
      return;
    }

    Alert.alert(
      "Send bug report?",
      "This posts to the Feath Board team via Discord. No photos or journal data are included.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: () => void handleSubmit(trimmed),
        },
      ],
    );
  }

  async function handleSubmit(trimmedDescription: string) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await submitBugReport({
        description: trimmedDescription,
        steps: steps.trim() || undefined,
        deviceInfo,
      });
      Alert.alert("Report sent", "Thanks — the team will look into it.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Could not send", getUserFacingMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader title="Report a bug" onBack={() => router.back()} />
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10 pt-2">
        <Text className="mb-1 font-sans-medium text-sm text-foreground">What happened?</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the bug..."
          placeholderTextColor="#8a9e82"
          multiline
          textAlignVertical="top"
          className="min-h-[120px] rounded-xl border border-border bg-card px-4 py-3 font-sans text-sm text-foreground"
        />

        <Text className="mb-1 mt-4 font-sans-medium text-sm text-foreground">
          Steps to reproduce (optional)
        </Text>
        <TextInput
          value={steps}
          onChangeText={setSteps}
          placeholder="1. Open journal…"
          placeholderTextColor="#8a9e82"
          multiline
          textAlignVertical="top"
          className="min-h-[80px] rounded-xl border border-border bg-card px-4 py-3 font-sans text-sm text-foreground"
        />

        <View className="mt-4 rounded-xl border border-border bg-card px-4 py-3">
          <Text className="font-mono text-[10px] text-muted-foreground">{deviceInfo}</Text>
        </View>

        <Pressable
          onPress={confirmSubmit}
          disabled={submitting}
          className="mt-6 items-center rounded-xl bg-primary px-4 py-3.5 active:opacity-90"
        >
          {submitting ? (
            <ActivityIndicator color="#f0ead6" />
          ) : (
            <Text className="font-sans-medium text-sm text-primary-foreground">Review & send</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
