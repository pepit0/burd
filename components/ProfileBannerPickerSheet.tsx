import { Image, Modal, Pressable, Text, View } from "react-native";
import { Check, X } from "lucide-react-native";
import {
  PROFILE_COVER_PRESETS,
  type ProfileCoverPresetId,
} from "@/lib/profileCover";

interface ProfileBannerPickerSheetProps {
  visible: boolean;
  selectedId: ProfileCoverPresetId;
  saving?: boolean;
  onClose: () => void;
  onSelect: (presetId: ProfileCoverPresetId) => void;
}

export function ProfileBannerPickerSheet({
  visible,
  selectedId,
  saving = false,
  onClose,
  onSelect,
}: ProfileBannerPickerSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
        <Pressable
          className="rounded-t-2xl border-t border-border bg-card px-4 pb-8 pt-3"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="font-serif-semibold text-base text-foreground">Choose banner</Text>
            <Pressable onPress={onClose} className="rounded-full p-1.5 active:bg-muted">
              <X size={18} color="#8a9e82" />
            </Pressable>
          </View>

          <Text className="mb-3 font-sans text-xs text-muted-foreground">
            Pick a nature scene for your profile header.
          </Text>

          <View className="gap-2.5">
            {PROFILE_COVER_PRESETS.map((preset) => {
              const active = selectedId === preset.id;
              return (
                <Pressable
                  key={preset.id}
                  disabled={saving}
                  onPress={() => onSelect(preset.id)}
                  className={`overflow-hidden rounded-xl border-2 active:opacity-90 ${
                    active ? "border-primary" : "border-border"
                  }`}
                >
                  <View className="h-20">
                    <Image
                      source={{ uri: preset.url }}
                      className="h-full w-full"
                      resizeMode="cover"
                    />
                  </View>
                  <View className="flex-row items-center justify-between bg-background px-3 py-2">
                    <Text className="font-sans-medium text-sm text-foreground">
                      {preset.label}
                    </Text>
                    {active ? <Check size={16} color="#5f9470" /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
