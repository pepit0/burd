import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, X } from "lucide-react-native";
import {
  BADGE_FAMILY_LABELS,
  BADGE_FAMILY_ORDER,
  groupBadgesByFamily,
  type ProfileBadge,
} from "@/lib/profileBadges";
import { sanitizeShowcaseBadgeIds } from "@/lib/profileShowcaseBadges";
import { BadgeShowcaseSlot, FAMILY_STYLES } from "@/components/ProfileBadges";

interface ProfileBadgeShowcasePickerSheetProps {
  visible: boolean;
  badges: ProfileBadge[];
  selectedIds: string[];
  saving?: boolean;
  onClose: () => void;
  onSave: (ids: string[]) => void;
}

function slotIdsFromSelection(selection: Array<string | null>): string[] {
  return selection.filter((id): id is string => Boolean(id));
}

export function ProfileBadgeShowcasePickerSheet({
  visible,
  badges,
  selectedIds,
  saving = false,
  onClose,
  onSave,
}: ProfileBadgeShowcasePickerSheetProps) {
  const earnedBadges = useMemo(
    () => badges.filter((badge) => badge.earned),
    [badges],
  );
  const earnedIds = useMemo(
    () => new Set(earnedBadges.map((badge) => badge.id)),
    [earnedBadges],
  );
  const earnedById = useMemo(
    () => new Map(earnedBadges.map((badge) => [badge.id, badge])),
    [earnedBadges],
  );

  const [activeSlot, setActiveSlot] = useState(0);
  const [selection, setSelection] = useState<Array<string | null>>([
    null,
    null,
    null,
  ]);

  useEffect(() => {
    if (!visible) return;
    const sanitized = sanitizeShowcaseBadgeIds(selectedIds, earnedIds);
    setSelection([
      sanitized[0] ?? null,
      sanitized[1] ?? null,
      sanitized[2] ?? null,
    ]);
    setActiveSlot(0);
  }, [visible, selectedIds, earnedIds]);

  const grouped = groupBadgesByFamily(earnedBadges);
  const showcaseSlots = selection.map((id) => (id ? earnedById.get(id) ?? null : null));

  function assignBadge(badgeId: string) {
    setSelection((prev) => {
      const next: Array<string | null> = [...prev];
      const existingSlot = next.findIndex((id) => id === badgeId);
      if (existingSlot >= 0) next[existingSlot] = null;
      next[activeSlot] = badgeId;
      onSave(sanitizeShowcaseBadgeIds(slotIdsFromSelection(next), earnedIds));
      return next;
    });
  }

  function clearSlot(index: number) {
    setSelection((prev) => {
      const next: Array<string | null> = [...prev];
      next[index] = null;
      onSave(sanitizeShowcaseBadgeIds(slotIdsFromSelection(next), earnedIds));
      return next;
    });
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-card">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close badge picker"
            className="rounded-full p-2 active:bg-muted"
          >
            <X size={20} color="#8a9e82" />
          </Pressable>
          <Text className="font-serif-semibold text-base text-foreground">
            Profile badges
          </Text>
          <Pressable
            onPress={onClose}
            disabled={saving}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Done choosing badges"
            className="rounded-full px-3 py-2 active:bg-muted"
          >
            <Text className="font-sans-medium text-sm text-primary">Done</Text>
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-6 pt-4"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="mb-4 font-sans text-xs text-muted-foreground">
            Pick up to three unlocked badges to show on your profile.
          </Text>

          <View className="mb-5 flex-row gap-2">
            {showcaseSlots.map((badge, index) => {
              const active = activeSlot === index;
              const cardClassName = `min-w-0 flex-1 items-center rounded-xl border px-2 py-3 ${
                active ? "border-primary bg-primary/10" : "border-border bg-background/40"
              }`;

              if (!badge) {
                return (
                  <Pressable
                    key={index}
                    disabled={saving}
                    onPress={() => setActiveSlot(index)}
                    className={`${cardClassName} self-stretch active:opacity-90`}
                  >
                    <BadgeShowcaseSlot badge={badge} compact />
                    <Text className="mt-1 font-sans text-[10px] text-muted-foreground">
                      Slot {index + 1}
                    </Text>
                  </Pressable>
                );
              }

              return (
                <View key={index} className={cardClassName}>
                  <Pressable
                    disabled={saving}
                    onPress={() => setActiveSlot(index)}
                    className="items-center active:opacity-90"
                  >
                    <BadgeShowcaseSlot badge={badge} compact />
                  </Pressable>
                  <Pressable
                    disabled={saving}
                    onPress={() => clearSlot(index)}
                    hitSlop={8}
                    className="mt-1 rounded-full px-2 py-0.5 active:bg-muted"
                  >
                    <Text className="font-sans text-[10px] text-muted-foreground">Clear</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>

          {earnedBadges.length === 0 ? (
            <View className="py-8">
              <Text className="text-center font-sans text-sm text-muted-foreground">
                Unlock badges by logging sightings, posting, and exploring.
              </Text>
            </View>
          ) : (
            <View className="gap-4">
              {BADGE_FAMILY_ORDER.map((family) => {
                const familyBadges = grouped[family];
                if (familyBadges.length === 0) return null;

                return (
                  <View key={family}>
                    <Text className="mb-2 font-sans-medium text-xs text-foreground/80">
                      {BADGE_FAMILY_LABELS[family]}
                    </Text>
                    <View className="gap-2">
                      {familyBadges.map((badge) => {
                        const style = FAMILY_STYLES[badge.family];
                        const Icon = style.icon;
                        const selectedSlot = selection.findIndex((id) => id === badge.id);

                        return (
                          <Pressable
                            key={badge.id}
                            disabled={saving}
                            onPress={() => assignBadge(badge.id)}
                            className={`flex-row items-center gap-3 rounded-xl border bg-background/50 p-3 active:opacity-90 ${
                              selectedSlot >= 0 ? "border-primary/50" : "border-border"
                            }`}
                          >
                            <View
                              className="h-9 w-9 items-center justify-center rounded-full"
                              style={{ backgroundColor: style.earnedBg }}
                            >
                              <Icon
                                size={15}
                                color={style.earnedIcon}
                                fill={style.earnedIconFill}
                              />
                            </View>
                            <View className="min-w-0 flex-1">
                              <Text className="font-serif text-sm text-foreground">
                                {badge.label}
                              </Text>
                              <Text className="font-sans text-[11px] text-muted-foreground">
                                {badge.desc}
                              </Text>
                            </View>
                            {selectedSlot >= 0 ? (
                              <View className="flex-row items-center gap-1">
                                <Text className="font-mono text-[10px] text-primary">
                                  {selectedSlot + 1}
                                </Text>
                                <Check size={14} color="#5f9470" />
                              </View>
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
