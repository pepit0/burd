import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import {
  listPocketBirdSpecies,
  type PocketBirdSpecies,
} from "@/lib/pocketBird/matchSpecies";
import { getPocketBirdFrame } from "@/lib/pocketBird/render";
import { PocketBirdRenderer } from "@/components/PocketBirdRenderer";

interface PocketBirdSpeciesPickerProps {
  selectedId: string;
  petNames?: Record<string, string>;
  onSelect: (speciesId: string) => void;
}

const PREVIEW_SIZE = 56;

function SpeciesTile({
  species,
  selected,
  customName,
  onPress,
}: {
  species: PocketBirdSpecies;
  selected: boolean;
  customName?: string;
  onPress: () => void;
}) {
  const pixels = useMemo(
    () => getPocketBirdFrame(species.id, "base"),
    [species.id],
  );

  return (
    <Pressable
      onPress={onPress}
      className="items-center rounded-xl border p-2"
      style={{
        width: "23%",
        margin: "1%",
        borderColor: selected ? species.highlightColor : "transparent",
        backgroundColor: selected ? `${species.highlightColor}18` : undefined,
      }}
    >
      <PocketBirdRenderer pixels={pixels} size={PREVIEW_SIZE} />
      <Text
        className="mt-1 text-center font-sans text-[10px] text-foreground"
        numberOfLines={2}
      >
        {customName || species.name}
      </Text>
      {customName ? (
        <Text
          className="mt-0.5 text-center font-sans text-[9px] text-muted-foreground"
          numberOfLines={1}
        >
          {species.name}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function PocketBirdSpeciesPicker({
  selectedId,
  petNames = {},
  onSelect,
}: PocketBirdSpeciesPickerProps) {
  const speciesList = useMemo(() => listPocketBirdSpecies(), []);

  const sections = useMemo(() => {
    const common = speciesList.filter((s) => s.rarity === "common");
    const uncommon = speciesList.filter((s) => s.rarity === "uncommon");
    return [
      { title: "Familiar birds", data: common },
      { title: "Uncommon birds", data: uncommon },
    ].filter((section) => section.data.length > 0);
  }, [speciesList]);

  return (
    <View className="flex-1">
      <Text className="mb-2 font-serif-semibold text-base text-foreground">
        Choose your pet
      </Text>
      <Text className="mb-3 font-sans text-xs text-muted-foreground">
        Sprites from{" "}
        <Text className="text-muted-foreground underline">Pocket Bird</Text> (MPL-2.0)
      </Text>

      {sections.map((section) => (
        <View key={section.title} className="mb-4">
          <Text className="mb-2 font-sans-semibold text-sm text-muted-foreground">
            {section.title}
          </Text>
          <View className="flex-row flex-wrap">
            {section.data.map((species) => (
              <SpeciesTile
                key={species.id}
                species={species}
                selected={species.id === selectedId}
                customName={petNames[species.id]?.trim() || undefined}
                onPress={() => onSelect(species.id)}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
