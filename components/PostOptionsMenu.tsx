import { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Flag, X } from "lucide-react-native";
import { getErrorMessage } from "@/lib/errors";
import { reportPost } from "@/lib/reports";

interface PostOptionsMenuProps {
  sightingId: string;
  userId: string | null;
  visible: boolean;
  onClose: () => void;
}

export function PostOptionsMenu({
  sightingId,
  userId,
  visible,
  onClose,
}: PostOptionsMenuProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  function handleReportPress() {
    onClose();

    if (!userId) {
      Alert.alert("Sign in required", "Sign in to report posts.", [
        { text: "Not now", style: "cancel" },
        { text: "Sign in", onPress: () => router.push("/(auth)/login") },
      ]);
      return;
    }

    Alert.alert(
      "Report this post?",
      "We'll review this sighting for policy violations.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report",
          style: "destructive",
          onPress: () => {
            void submitReport();
          },
        },
      ],
    );
  }

  async function submitReport() {
    if (!userId || submitting) return;
    setSubmitting(true);
    try {
      await reportPost(userId, sightingId);
      Alert.alert("Report submitted", "Thanks — we'll take a look.");
    } catch (e) {
      Alert.alert("Could not report", getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
        <Pressable
          className="rounded-t-2xl border-t border-border bg-card px-4 pb-8 pt-3"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="font-serif-semibold text-base text-foreground">Post options</Text>
            <Pressable onPress={onClose} className="rounded-full p-1.5 active:bg-muted">
              <X size={18} color="#8a9e82" />
            </Pressable>
          </View>

          <Pressable
            onPress={handleReportPress}
            disabled={submitting}
            className="flex-row items-center gap-3 rounded-xl border border-border bg-background px-4 py-3.5 active:opacity-90"
          >
            <Flag size={18} color="#f87171" />
            <Text className="font-sans-medium text-sm text-foreground">Report this post</Text>
          </Pressable>

          <Pressable
            onPress={onClose}
            className="mt-3 items-center rounded-xl py-3 active:opacity-80"
          >
            <Text className="font-sans text-sm text-muted-foreground">Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
