import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import { ModerationReasonModal } from "@/components/ModerationReasonModal";
import { getErrorMessage } from "@/lib/errors";
import {
  formatSuspensionExpiry,
  isProfileSuspended,
  suspendUserAsAdmin,
  suspensionDurationToDate,
  unsuspendUserAsAdmin,
} from "@/lib/moderation";
import type { Profile } from "@/types";

const DURATIONS: { label: string; days: number | null }[] = [
  { label: "1 day", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "Indefinite", days: null },
];

interface UserModerationSheetProps {
  visible: boolean;
  profile: Profile | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function UserModerationSheet({
  visible,
  profile,
  onClose,
  onUpdated,
}: UserModerationSheetProps) {
  const [selectedDays, setSelectedDays] = useState<number | null>(7);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [liftOpen, setLiftOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const suspended = profile ? isProfileSuspended(profile) : false;

  function handleClose() {
    setReasonOpen(false);
    setLiftOpen(false);
    onClose();
  }

  async function handleSuspend(reason: string) {
    if (!profile || submitting) return;
    setSubmitting(true);
    try {
      await suspendUserAsAdmin(
        profile.id,
        reason,
        suspensionDurationToDate(selectedDays),
      );
      setReasonOpen(false);
      onUpdated();
      handleClose();
    } catch (e) {
      Alert.alert("Could not suspend", getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLift(reason: string) {
    if (!profile || submitting) return;
    setSubmitting(true);
    try {
      await unsuspendUserAsAdmin(profile.id, reason);
      setLiftOpen(false);
      onUpdated();
      handleClose();
    } catch (e) {
      Alert.alert("Could not lift suspension", getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (!profile) return null;

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
        <Pressable className="flex-1 justify-end bg-black/60" onPress={handleClose}>
          <Pressable
            className="rounded-t-2xl border-t border-border bg-card px-4 pb-8 pt-3"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="font-serif-semibold text-base text-foreground">
                Moderate @{profile.username}
              </Text>
              <Pressable onPress={handleClose} className="rounded-full p-1.5 active:bg-muted">
                <X size={18} color="#8a9e82" />
              </Pressable>
            </View>

            {suspended ? (
              <View className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
                <Text className="font-sans-medium text-sm text-foreground">
                  Currently suspended
                </Text>
                {profile.suspension_reason ? (
                  <Text className="mt-1 font-sans text-xs text-muted-foreground">
                    {profile.suspension_reason}
                  </Text>
                ) : null}
                <Text className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {profile.suspended_until
                    ? `Until ${formatSuspensionExpiry(profile.suspended_until)}`
                    : "Indefinite"}
                </Text>
                <Pressable
                  onPress={() => setLiftOpen(true)}
                  className="mt-3 items-center rounded-lg border border-border bg-background py-2.5 active:opacity-90"
                >
                  <Text className="font-sans-medium text-sm text-foreground">
                    Lift suspension
                  </Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text className="mb-2 font-sans text-sm text-muted-foreground">
                  Choose suspension length
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {DURATIONS.map((option) => {
                    const active = selectedDays === option.days;
                    return (
                      <Pressable
                        key={option.label}
                        onPress={() => setSelectedDays(option.days)}
                        className={`rounded-full border px-3 py-1.5 ${
                          active ? "border-primary bg-primary/15" : "border-border"
                        }`}
                      >
                        <Text
                          className={`font-sans text-xs ${
                            active ? "text-primary" : "text-muted-foreground"
                          }`}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  onPress={() => setReasonOpen(true)}
                  disabled={submitting}
                  className="mt-4 items-center rounded-xl bg-destructive/90 py-3.5 active:opacity-90"
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="font-sans-medium text-sm text-white">Suspend account</Text>
                  )}
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <ModerationReasonModal
        visible={reasonOpen}
        title="Suspension reason"
        description="This reason will be shown to the user."
        confirmLabel="Suspend"
        destructive
        submitting={submitting}
        onClose={() => setReasonOpen(false)}
        onConfirm={handleSuspend}
      />

      <ModerationReasonModal
        visible={liftOpen}
        title="Lift suspension"
        description="Optional note for the user."
        confirmLabel="Lift suspension"
        submitting={submitting}
        onClose={() => setLiftOpen(false)}
        onConfirm={handleLift}
      />
    </>
  );
}
