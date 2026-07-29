import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { Avatar } from "@/components/Avatar";
import { DisplayNameText } from "@/components/DisplayNameText";
import type { SpeciesObserver } from "@/lib/speciesObservers";
import { formatDetailDate } from "@/lib/sightingFormat";

interface SpeciesObserversSheetProps {
  visible: boolean;
  speciesName: string;
  observers: SpeciesObserver[];
  onClose: () => void;
}

export function SpeciesObserversSheet({
  visible,
  speciesName,
  observers,
  onClose,
}: SpeciesObserversSheetProps) {
  const router = useRouter();

  function openProfile(userId: string) {
    onClose();
    router.push(`/user/${userId}`);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
        <Pressable
          className="max-h-[70%] rounded-t-2xl border-t border-border bg-card px-4 pb-8 pt-3"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="mb-4 flex-row items-center justify-between">
            <View className="min-w-0 flex-1 pr-3">
              <Text className="font-serif-semibold text-base text-foreground">Seen by</Text>
              <Text className="mt-0.5 font-sans text-xs text-muted-foreground" numberOfLines={1}>
                {speciesName}
              </Text>
            </View>
            <Pressable onPress={onClose} className="rounded-full p-1.5 active:bg-muted">
              <X size={18} color="#8a9e82" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="gap-1">
              {observers.map((observer, index) => (
                <Pressable
                  key={observer.userId}
                  onPress={() => openProfile(observer.userId)}
                  className="flex-row items-center gap-3 rounded-xl py-2.5 active:bg-background/80"
                >
                  <Avatar
                    user={observer.username}
                    color={observer.avatarColor}
                    avatarUrl={observer.avatarUrl}
                    size={42}
                  />
                  <View className="min-w-0 flex-1">
                    <DisplayNameText
                      text={observer.fullName || observer.username}
                      className="font-sans-medium text-sm text-foreground"
                      numberOfLines={1}
                    />
                    <Text className="font-mono text-xs text-muted-foreground" numberOfLines={1}>
                      @{observer.username}
                    </Text>
                    <Text className="mt-0.5 font-sans text-[11px] text-muted-foreground/80">
                      {index === 0 ? "First logged" : "Logged"}{" "}
                      {formatDetailDate(new Date(observer.firstSeenAt))}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
