import { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Flag, ShieldAlert, UserX, X } from "lucide-react-native";
import { blockUser } from "@/lib/blocks";
import { getUserFacingMessage } from "@/lib/errors";
import { pickReportReason } from "@/lib/reportReasons";
import { reportUser } from "@/lib/reports";

interface UserOptionsMenuProps {
  targetUserId: string;
  targetUsername: string;
  viewerUserId: string | null;
  visible: boolean;
  onClose: () => void;
  onBlocked?: () => void;
  isAdmin?: boolean;
  onModerate?: () => void;
}

function OptionRow({
  onPress,
  disabled,
  icon,
  label,
  destructive = false,
}: {
  onPress: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center gap-3 rounded-xl border px-4 py-3.5 active:opacity-90 ${
        destructive ? "border-destructive/30 bg-destructive/10" : "border-border bg-background"
      }`}
    >
      {icon}
      <Text className="font-sans-medium text-sm text-foreground">{label}</Text>
    </Pressable>
  );
}

export function UserOptionsMenu({
  targetUserId,
  targetUsername,
  viewerUserId,
  visible,
  onClose,
  onBlocked,
  isAdmin = false,
  onModerate,
}: UserOptionsMenuProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isSelf = Boolean(viewerUserId && viewerUserId === targetUserId);

  function requireSignIn(action: string): boolean {
    if (viewerUserId) return true;
    onClose();
    Alert.alert("Sign in required", `Sign in to ${action}.`, [
      { text: "Not now", style: "cancel" },
      { text: "Sign in", onPress: () => router.push("/(auth)/login") },
    ]);
    return false;
  }

  async function handleReportPress() {
    onClose();
    if (!requireSignIn("report users")) return;

    const reason = await pickReportReason("Report user");
    if (!reason || !viewerUserId) return;

    setSubmitting(true);
    try {
      await reportUser(viewerUserId, targetUserId, reason);
      Alert.alert(
        "Report submitted",
        "Thanks — our moderators review reports within 24 hours.",
      );
    } catch (e) {
      Alert.alert("Could not report", getUserFacingMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  function handleBlockPress() {
    onClose();
    if (!requireSignIn("block users") || isSelf) return;

    Alert.alert(
      `Block @${targetUsername}?`,
      "Their posts and comments will disappear from your feed immediately. We'll be notified to review this account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => {
            void confirmBlock();
          },
        },
      ],
    );
  }

  async function confirmBlock() {
    if (!viewerUserId || submitting) return;
    setSubmitting(true);
    try {
      await blockUser(
        targetUserId,
        `Blocked @${targetUsername} — user-initiated block with moderation review`,
      );
      onBlocked?.();
      Alert.alert(
        "User blocked",
        `@${targetUsername} has been blocked and removed from your feed.`,
      );
    } catch (e) {
      Alert.alert("Could not block user", getUserFacingMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (isSelf) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
        <Pressable
          className="rounded-t-2xl border-t border-border bg-card px-4 pb-8 pt-3"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="font-serif-semibold text-base text-foreground">
              @{targetUsername}
            </Text>
            <Pressable onPress={onClose} className="rounded-full p-1.5 active:bg-muted">
              <X size={18} color="#8a9e82" />
            </Pressable>
          </View>

          <View className="gap-2">
            {isAdmin && onModerate ? (
              <OptionRow
                onPress={() => {
                  onClose();
                  onModerate();
                }}
                disabled={submitting}
                icon={<ShieldAlert size={18} color="#f87171" />}
                label="Moderate user"
                destructive
              />
            ) : null}
            <OptionRow
              onPress={handleReportPress}
              disabled={submitting}
              icon={<Flag size={18} color="#f87171" />}
              label="Report user"
              destructive
            />
            <OptionRow
              onPress={handleBlockPress}
              disabled={submitting}
              icon={<UserX size={18} color="#f87171" />}
              label="Block user"
              destructive
            />
          </View>

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
