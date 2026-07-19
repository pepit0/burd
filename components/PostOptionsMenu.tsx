import { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Edit3, Flag, ShieldAlert, Trash2, UserX, X } from "lucide-react-native";
import { ModerationReasonModal } from "@/components/ModerationReasonModal";
import { getUserFacingMessage } from "@/lib/errors";
import { removePostAsAdmin, removePostAuthorAsAdmin } from "@/lib/moderation";
import { reportPost } from "@/lib/reports";
import { deleteMySighting } from "@/lib/sightings";

interface PostOptionsMenuProps {
  sightingId: string;
  userId: string | null;
  ownerUserId?: string | null;
  hasPhoto?: boolean;
  authorDisqualified?: boolean;
  isAdmin?: boolean;
  visible: boolean;
  onClose: () => void;
  onPostRemoved?: () => void;
  onAuthorRemoved?: () => void;
}

export function PostOptionsMenu({
  sightingId,
  userId,
  ownerUserId = null,
  hasPhoto = false,
  authorDisqualified = false,
  isAdmin = false,
  visible,
  onClose,
  onPostRemoved,
  onAuthorRemoved,
}: PostOptionsMenuProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeAuthorOpen, setRemoveAuthorOpen] = useState(false);

  const isOwner = Boolean(userId && ownerUserId && userId === ownerUserId);

  function handleDeletePress() {
    onClose();
    if (!userId || !isOwner) return;

    Alert.alert(
      "Delete this post?",
      "This removes the sighting from your journal and profile. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void confirmDelete();
          },
        },
      ],
    );
  }

  async function confirmDelete() {
    if (!userId || submitting) return;
    setSubmitting(true);
    try {
      await deleteMySighting(userId, sightingId);
      onPostRemoved?.();
      Alert.alert("Deleted", "Your post was removed.");
    } catch (e) {
      Alert.alert("Could not delete", getUserFacingMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

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
      Alert.alert("Could not report", getUserFacingMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  function handleEditPress() {
    onClose();
    router.push(`/admin/edit-post/${sightingId}` as never);
  }

  function handleRemovePress() {
    onClose();
    setRemoveOpen(true);
  }

  function handleRemoveAuthorPress() {
    onClose();
    setRemoveAuthorOpen(true);
  }

  async function handleRemoveAuthorConfirm(reason: string) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await removePostAuthorAsAdmin(sightingId, reason);
      setRemoveAuthorOpen(false);
      onAuthorRemoved?.();
      Alert.alert(
        "Author credit removed",
        "The field guide text stays published. Credit goes to the next eligible photo sighting, or is open for the next birder.",
      );
    } catch (e) {
      Alert.alert("Could not remove author credit", getUserFacingMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveConfirm(reason: string) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await removePostAsAdmin(sightingId, reason);
      setRemoveOpen(false);
      onPostRemoved?.();
      Alert.alert("Post removed", "The user will be notified with your reason.");
    } catch (e) {
      Alert.alert("Could not remove post", getUserFacingMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
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

            {isAdmin ? (
              <>
                <Pressable
                  onPress={handleEditPress}
                  className="mb-2 flex-row items-center gap-3 rounded-xl border border-border bg-background px-4 py-3.5 active:opacity-90"
                >
                  <Edit3 size={18} color="#5f9470" />
                  <Text className="font-sans-medium text-sm text-foreground">Edit post</Text>
                </Pressable>
                <Pressable
                  onPress={handleRemovePress}
                  className="mb-2 flex-row items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3.5 active:opacity-90"
                >
                  <Trash2 size={18} color="#f87171" />
                  <Text className="font-sans-medium text-sm text-foreground">Remove post</Text>
                </Pressable>
                {hasPhoto && !authorDisqualified ? (
                  <Pressable
                    onPress={handleRemoveAuthorPress}
                    className="mb-2 flex-row items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3.5 active:opacity-90"
                  >
                    <UserX size={18} color="#c8893a" />
                    <Text className="font-sans-medium text-sm text-foreground">
                      Remove author credit
                    </Text>
                  </Pressable>
                ) : null}
                <View className="mb-2 flex-row items-center gap-2 px-1">
                  <ShieldAlert size={14} color="#8a9e82" />
                  <Text className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    Admin actions
                  </Text>
                </View>
              </>
            ) : null}

            {isOwner ? (
              <Pressable
                onPress={handleDeletePress}
                disabled={submitting}
                className="mb-2 flex-row items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3.5 active:opacity-90"
              >
                <Trash2 size={18} color="#f87171" />
                <Text className="font-sans-medium text-sm text-foreground">Delete post</Text>
              </Pressable>
            ) : null}

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

      <ModerationReasonModal
        visible={removeOpen}
        title="Remove post"
        description="The post owner will see this reason."
        confirmLabel="Remove post"
        destructive
        submitting={submitting}
        onClose={() => setRemoveOpen(false)}
        onConfirm={handleRemoveConfirm}
      />
      <ModerationReasonModal
        visible={removeAuthorOpen}
        title="Remove author credit"
        description="The field guide stays live. This sighting will no longer count as the first capture. Credit passes to the next eligible photo sighting."
        confirmLabel="Remove author credit"
        destructive
        submitting={submitting}
        onClose={() => setRemoveAuthorOpen(false)}
        onConfirm={handleRemoveAuthorConfirm}
      />
    </>
  );
}
