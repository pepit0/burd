import { Modal, Pressable, Text, View } from "react-native";
import { X } from "lucide-react-native";

export interface FilterChipOption {
  value: string;
  label: string;
}

export interface FilterSectionConfig {
  title: string;
  options: FilterChipOption[];
  value: string;
  onSelect: (value: string) => void;
}

interface FilterSheetProps {
  visible: boolean;
  title: string;
  sections: FilterSectionConfig[];
  onClose: () => void;
  onReset: () => void;
}

export function FilterSheet({
  visible,
  title,
  sections,
  onClose,
  onReset,
}: FilterSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
        <Pressable
          className="rounded-t-2xl border-t border-border bg-card px-4 pb-8 pt-3"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="font-serif-semibold text-base text-foreground">{title}</Text>
            <Pressable onPress={onClose} className="rounded-full p-1.5 active:bg-muted">
              <X size={18} color="#8a9e82" />
            </Pressable>
          </View>

          <View className="gap-5">
            {sections.map((section) => (
              <View key={section.title}>
                <Text className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {section.options.map((option) => {
                    const active = section.value === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => section.onSelect(option.value)}
                        className={`rounded-full px-3.5 py-2 ${
                          active ? "bg-primary" : "border border-border bg-background"
                        }`}
                      >
                        <Text
                          className={`text-xs ${
                            active
                              ? "font-sans-medium text-primary-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>

          <View className="mt-6 flex-row gap-2">
            <Pressable
              onPress={onReset}
              className="flex-1 items-center rounded-xl border border-border bg-background py-3 active:opacity-80"
            >
              <Text className="font-sans-medium text-sm text-muted-foreground">Reset</Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              className="flex-1 items-center rounded-xl bg-primary py-3 active:opacity-90"
            >
              <Text className="font-sans-medium text-sm text-primary-foreground">Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
