import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SpeciesObserversSheet } from "@/components/SpeciesObserversSheet";
import type { SpeciesObserver } from "@/lib/speciesObservers";

interface SpeciesSeenByProps {
  observers: SpeciesObserver[];
  speciesName: string;
  loading?: boolean;
  fieldGuidePublished?: boolean;
}

export function SpeciesSeenBy({
  observers,
  speciesName,
  loading = false,
  fieldGuidePublished = false,
}: SpeciesSeenByProps) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (loading) return null;

  const first = observers[0];
  const othersCount = Math.max(0, observers.length - 1);

  if (!first) {
    if (fieldGuidePublished) {
      return (
        <Text className="font-sans text-[11px] text-muted-foreground/70">
          AI-generated field guide · not seen by anyone yet
        </Text>
      );
    }
    return null;
  }

  return (
    <>
      <View className="flex-row flex-wrap items-center">
        <Text className="font-sans text-[11px] text-muted-foreground/80">Seen by </Text>
        <Pressable onPress={() => router.push(`/user/${first.userId}`)}>
          <Text className="font-sans text-[11px] text-muted-foreground/80">
            <Text className="font-sans-medium text-foreground/70">@{first.username}</Text>
          </Text>
        </Pressable>
        {othersCount > 0 ? (
          <Pressable onPress={() => setSheetOpen(true)}>
            <Text className="font-sans text-[11px] text-muted-foreground/80">
              {" + "}
              <Text className="font-sans-medium text-primary">
                {othersCount} {othersCount === 1 ? "other" : "others"}
              </Text>
            </Text>
          </Pressable>
        ) : null}
      </View>

      <SpeciesObserversSheet
        visible={sheetOpen}
        speciesName={speciesName}
        observers={observers}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}
