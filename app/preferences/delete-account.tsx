import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Download, Trash2 } from "lucide-react-native";
import * as FileSystem from "expo-file-system/legacy";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { deleteAccount } from "@/lib/accountDeletion";
import { getUserFacingMessage } from "@/lib/errors";
import { exportUserData } from "@/lib/profilePreferences";

const DATA_LOST = [
  "Journal entries and private notes",
  "Published sightings and posts",
  "Photos and audio clips",
  "Badge progress and life list stats",
  "Friends, likes, comments, and activity",
  "Your profile and account settings",
];

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { profile } = useProfile(userId);
  const [confirmText, setConfirmText] = useState("");
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const username = profile?.username ?? "";
  const canDelete = confirmText.trim().toLowerCase() === username.toLowerCase() && username.length > 0;

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await exportUserData();
      const json = JSON.stringify(data, null, 2);
      const path = `${FileSystem.cacheDirectory}burd-export-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(path, json);
      await Share.share({
        title: "Burd data export",
        message: json.length < 8000 ? json : "Your Burd data export is attached.",
        url: path,
      });
    } catch (e) {
      Alert.alert("Export failed", getUserFacingMessage(e, "Please try again or contact support."));
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (!canDelete || deleting) return;
    Alert.alert(
      "Delete forever?",
      "This cannot be undone. All data listed below will be permanently removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete forever",
          style: "destructive",
          onPress: () => void performDelete(),
        },
      ],
    );
  }

  async function performDelete() {
    setDeleting(true);
    try {
      await deleteAccount();
      router.replace("/(auth)/login");
    } catch (e) {
      Alert.alert(
        "Could not delete account",
        getUserFacingMessage(e, "Please try again or contact support."),
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader title="Delete account" onBack={() => router.back()} />
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10 pt-2">
        <View className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <Text className="font-serif-semibold text-base text-destructive">Permanent deletion</Text>
          <Text className="mt-2 font-sans text-sm leading-relaxed text-muted-foreground">
            Deleting your account removes everything below. This is required for App Store compliance
            but cannot be reversed.
          </Text>
        </View>

        <Text className="mb-2 mt-6 font-sans-medium text-sm text-foreground">You will lose:</Text>
        <View className="rounded-xl border border-border bg-card px-4 py-3">
          {DATA_LOST.map((item, index) => (
            <Text
              key={item}
              className={`font-sans text-sm text-muted-foreground ${
                index > 0 ? "mt-2" : ""
              }`}
            >
              • {item}
            </Text>
          ))}
        </View>

        <Pressable
          onPress={() => void handleExport()}
          disabled={exporting}
          className="mt-6 flex-row items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3.5 active:opacity-85"
        >
          {exporting ? (
            <ActivityIndicator color="#5f9470" />
          ) : (
            <>
              <Download size={16} color="#5f9470" />
              <Text className="font-sans-medium text-sm text-primary">Export my data first</Text>
            </>
          )}
        </Pressable>

        <Text className="mb-2 mt-8 font-sans-medium text-sm text-foreground">
          Type your username to confirm
        </Text>
        <TextInput
          value={confirmText}
          onChangeText={setConfirmText}
          placeholder={username ? `@${username}` : "username"}
          placeholderTextColor="#8a9e82"
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded-xl border border-border bg-card px-4 py-3 font-sans text-sm text-foreground"
        />

        <Pressable
          onPress={() => void handleDelete()}
          disabled={!canDelete || deleting}
          className={`mt-6 flex-row items-center justify-center gap-2 rounded-xl border px-4 py-3.5 ${
            canDelete
              ? "border-destructive/40 bg-destructive/10 active:opacity-85"
              : "border-border bg-muted opacity-50"
          }`}
        >
          {deleting ? (
            <ActivityIndicator color="#c8693a" />
          ) : (
            <>
              <Trash2 size={16} color="#c8693a" />
              <Text className="font-sans-medium text-sm text-destructive">Delete account forever</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
