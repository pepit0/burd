import { Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

function presetAccessibilityLabel(id: ProfileCoverPresetId, selected: boolean) {
  const name = id.replace(/-/g, " ");
  return selected ? `${name}, selected` : name;
}

export function ProfileBannerPickerSheet({
  visible,
  selectedId,
  saving = false,
  onClose,
  onSelect,
}: ProfileBannerPickerSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
        <Pressable
          className="max-h-[72%] rounded-t-2xl border-t border-border bg-card px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
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

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <View className="gap-2.5 pb-1">
              {PROFILE_COVER_PRESETS.map((preset) => {
                const active = selectedId === preset.id;
                return (
                  <Pressable
                    key={preset.id}
                    disabled={saving}
                    onPress={() => onSelect(preset.id)}
                    accessibilityLabel={presetAccessibilityLabel(preset.id, active)}
                    className={`overflow-hidden rounded-xl border-2 active:opacity-90 ${
                      active ? "border-primary" : "border-border"
                    }`}
                  >
                    <View className="relative h-20">
                      <Image
                        source={{ uri: preset.url }}
                        className="h-full w-full"
                        resizeMode="cover"
                      />
                      {active ? (
                        <View className="absolute right-2 top-2 rounded-full bg-background/90 p-1">
                          <Check size={14} color="#5f9470" />
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
