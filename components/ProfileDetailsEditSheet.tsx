import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import { KeyboardModalAvoid } from "@/components/KeyboardModalAvoid";

interface ProfileDetailsEditSheetProps {
  visible: boolean;
  fullName: string;
  bio: string;
  saving?: boolean;
  onClose: () => void;
  onSave: (fullName: string, bio: string) => void;
}

export function ProfileDetailsEditSheet({
  visible,
  fullName,
  bio,
  saving = false,
  onClose,
  onSave,
}: ProfileDetailsEditSheetProps) {
  const [nameDraft, setNameDraft] = useState(fullName);
  const [bioDraft, setBioDraft] = useState(bio);

  useEffect(() => {
    if (visible) {
      setNameDraft(fullName);
      setBioDraft(bio);
    }
  }, [visible, fullName, bio]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardModalAvoid className="flex-1 justify-end bg-black/60">
        <Pressable className="flex-1" onPress={onClose} />
        <Pressable
          className="rounded-t-2xl border-t border-border bg-card px-4 pb-8 pt-3"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="font-serif-semibold text-base text-foreground">Edit profile</Text>
            <Pressable onPress={onClose} className="rounded-full p-1.5 active:bg-muted">
              <X size={18} color="#8a9e82" />
            </Pressable>
          </View>

          <View className="gap-4">
            <View>
              <Text className="mb-1 font-sans-medium text-sm text-foreground/80">
                Display name
              </Text>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="Your name"
                placeholderTextColor="#8a9e82"
                maxLength={60}
                className="rounded-xl border border-border bg-background px-4 py-3 font-sans text-base text-foreground"
              />
            </View>

            <View>
              <Text className="mb-1 font-sans-medium text-sm text-foreground/80">Bio</Text>
              <TextInput
                value={bioDraft}
                onChangeText={setBioDraft}
                placeholder="Tell other birders a bit about yourself"
                placeholderTextColor="#8a9e82"
                multiline
                maxLength={160}
                textAlignVertical="top"
                className="min-h-[96px] rounded-xl border border-border bg-background px-4 py-3 font-sans text-base leading-relaxed text-foreground"
              />
              <Text className="mt-1 text-right font-mono text-[10px] text-muted-foreground">
                {bioDraft.length}/160
              </Text>
            </View>
          </View>

          <Pressable
            disabled={saving}
            onPress={() => onSave(nameDraft.trim(), bioDraft.trim())}
            className="mt-6 items-center rounded-xl bg-primary py-3 active:opacity-90"
          >
            {saving ? (
              <ActivityIndicator color="#f0ead6" />
            ) : (
              <Text className="font-sans-medium text-sm text-primary-foreground">Save</Text>
            )}
          </Pressable>
        </Pressable>
      </KeyboardModalAvoid>
    </Modal>
  );
}
