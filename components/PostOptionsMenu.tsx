import { useState, type ReactNode } from "react";
import {
  Alert,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Edit3, EyeOff, Flag, ShieldAlert, Trash2, UserX, X } from "lucide-react-native";
import { ModerationReasonModal } from "@/components/ModerationReasonModal";
import { getUserFacingMessage } from "@/lib/errors";
import { removePostAsAdmin, removePostAuthorAsAdmin } from "@/lib/moderation";
import { reportPost } from "@/lib/reports";
import { unpublishSighting } from "@/lib/sightings";

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

type OptionVariant = "default" | "destructive" | "accent";

function OptionSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="mb-4">
      <View className="mb-2 flex-row items-center gap-2 px-1">
        {icon}
        <Text className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {title}
        </Text>
      </View>
      <View className="gap-2">{children}</View>
    </View>
  );
}

function OptionRow({
  onPress,
  disabled,
  icon,
  label,
  variant = "default",
}: {
  onPress: () => void;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  variant?: OptionVariant;
}) {
  const containerClass =
    variant === "destructive"
      ? "border-destructive/30 bg-destructive/10"
      : variant === "accent"
        ? "border-accent/30 bg-accent/10"
        : "border-border bg-background";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center gap-3 rounded-xl border px-4 py-3.5 active:opacity-90 ${containerClass}`}
    >
      {icon}
      <Text className="font-sans-medium text-sm text-foreground">{label}</Text>
    </Pressable>
  );
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

  function handleRemoveFromProfilePress() {
    onClose();
    if (!userId || !isOwner) return;

    Alert.alert(
      "Remove from profile?",
      "This takes the post off your profile and the public feed. It stays in your journal so you can post it again later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void confirmRemoveFromProfile();
          },
        },
      ],
    );
  }

  async function confirmRemoveFromProfile() {
    if (!userId || submitting) return;
    setSubmitting(true);
    try {
      await unpublishSighting(userId, sightingId);
      onPostRemoved?.();
      Alert.alert(
        "Removed from profile",
        "Your sighting is still in your journal.",
      );
    } catch (e) {
      Alert.alert("Could not remove post", getUserFacingMessage(e));
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

  function handleOwnerEditPress() {
    onClose();
    router.push(`/edit-journal-sighting/${sightingId}` as never);
  }

  function handleAdminEditPress() {
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

            <OptionSection title="Options">
              {isOwner ? (
                <>
                  <OptionRow
                    onPress={handleOwnerEditPress}
                    disabled={submitting}
                    icon={<Edit3 size={18} color="#5f9470" />}
                    label="Edit entry"
                  />
                  <OptionRow
                    onPress={handleRemoveFromProfilePress}
                    disabled={submitting}
                    icon={<EyeOff size={18} color="#8a9e82" />}
                    label="Remove from profile"
                  />
                </>
              ) : null}
              <OptionRow
                onPress={handleReportPress}
                disabled={submitting}
                icon={<Flag size={18} color="#f87171" />}
                label="Report this post"
              />
            </OptionSection>

            {isAdmin ? (
              <OptionSection
                title="Admin actions"
                icon={<ShieldAlert size={14} color="#8a9e82" />}
              >
                <OptionRow
                  onPress={handleAdminEditPress}
                  icon={<Edit3 size={18} color="#5f9470" />}
                  label="Edit post (admin)"
                />
                <OptionRow
                  onPress={handleRemovePress}
                  variant="destructive"
                  icon={<Trash2 size={18} color="#f87171" />}
                  label="Remove post"
                />
                {hasPhoto && !authorDisqualified ? (
                  <OptionRow
                    onPress={handleRemoveAuthorPress}
                    variant="accent"
                    icon={<UserX size={18} color="#c8893a" />}
                    label="Remove author credit"
                  />
                ) : null}
              </OptionSection>
            ) : null}

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
