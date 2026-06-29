import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { KeyboardModalAvoid } from "@/components/KeyboardModalAvoid";

const MIN_REASON_LENGTH = 10;

interface ModerationReasonModalProps {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}

export function ModerationReasonModal({
  visible,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  submitting = false,
  onClose,
  onConfirm,
}: ModerationReasonModalProps) {
  const [reason, setReason] = useState("");
  const insets = useSafeAreaInsets();

  function handleClose() {
    setReason("");
    onClose();
  }

  const valid = reason.trim().length >= MIN_REASON_LENGTH;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardModalAvoid className="flex-1">
        <Pressable className="flex-1 justify-end bg-black/60" onPress={handleClose}>
          <Pressable
            className="rounded-t-2xl border-t border-border bg-card px-4 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
            onPress={(e) => e.stopPropagation()}
          >
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="font-serif-semibold text-base text-foreground">{title}</Text>
            <Pressable onPress={handleClose} className="rounded-full p-1.5 active:bg-muted">
              <X size={18} color="#8a9e82" />
            </Pressable>
          </View>

          {description ? (
            <Text className="mb-3 font-sans text-sm text-muted-foreground">{description}</Text>
          ) : null}

          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Reason (visible to the user)"
            placeholderTextColor="#5a6e52"
            multiline
            className="min-h-[96px] rounded-xl border border-border bg-background px-4 py-3 font-sans text-sm text-foreground"
            textAlignVertical="top"
          />
          <Text className="mt-1 font-mono text-[10px] text-muted-foreground">
            At least {MIN_REASON_LENGTH} characters
          </Text>

          <Pressable
            disabled={!valid || submitting}
            onPress={() => void onConfirm(reason.trim())}
            className={`mt-4 items-center rounded-xl py-3.5 active:opacity-90 ${
              destructive ? "bg-destructive/90" : "bg-primary"
            } ${!valid || submitting ? "opacity-40" : ""}`}
          >
            {submitting ? (
              <ActivityIndicator color="#f0ead6" />
            ) : (
              <Text
                className={`font-sans-medium text-sm ${
                  destructive ? "text-white" : "text-primary-foreground"
                }`}
              >
                {confirmLabel}
              </Text>
            )}
          </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardModalAvoid>
    </Modal>
  );
}
