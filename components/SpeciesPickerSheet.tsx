import { useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import { SearchBar } from "@/components/SearchBar";
import { filterCatalog } from "@/lib/fieldGuide";
import { SPECIES_CATALOG } from "@/lib/speciesCatalog";
import type { CatalogSpecies } from "@/lib/speciesCatalog";

export interface SpeciesPickerSelection {
  species: string;
  scientific_name: string;
}

export interface SpeciesPickerSuggestion extends SpeciesPickerSelection {
  subtitle?: string;
}

interface SpeciesPickerSheetProps {
  visible: boolean;
  title?: string;
  suggestions?: SpeciesPickerSuggestion[];
  onClose: () => void;
  onSelect: (selection: SpeciesPickerSelection) => void;
}

const RESULT_LIMIT = 60;

function SpeciesResultRow({
  item,
  onPress,
}: {
  item: CatalogSpecies;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="border-b border-border px-4 py-3 active:bg-muted/50"
    >
      <Text className="font-serif text-base text-foreground">{item.species}</Text>
      <Text className="mt-0.5 font-serif-italic text-xs text-muted-foreground">
        {item.scientific_name}
      </Text>
      <Text className="mt-0.5 font-sans text-[10px] text-muted-foreground/80">
        {item.family}
      </Text>
    </Pressable>
  );
}

function SuggestionRow({
  item,
  onPress,
}: {
  item: SpeciesPickerSuggestion;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="border-b border-primary/20 bg-primary/5 px-4 py-3 active:bg-primary/10"
    >
      <Text className="font-sans-medium text-[10px] uppercase tracking-wider text-primary">
        Suggestion
      </Text>
      <Text className="mt-1 font-serif text-base text-foreground">{item.species}</Text>
      <Text className="mt-0.5 font-serif-italic text-xs text-muted-foreground">
        {item.scientific_name}
      </Text>
      {item.subtitle ? (
        <Text className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          {item.subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function SpeciesPickerSheet({
  visible,
  title = "Choose species",
  suggestions = [],
  onClose,
  onSelect,
}: SpeciesPickerSheetProps) {
  const [query, setQuery] = useState("");

  const trimmedQuery = query.trim();
  const catalogResults = useMemo(() => {
    if (!trimmedQuery) return [];
    return filterCatalog(SPECIES_CATALOG, trimmedQuery).slice(0, RESULT_LIMIT);
  }, [trimmedQuery]);

  const filteredSuggestions = useMemo(() => {
    if (!trimmedQuery) return suggestions;
    const q = trimmedQuery.toLowerCase();
    return suggestions.filter(
      (item) =>
        item.species.toLowerCase().includes(q) ||
        item.scientific_name.toLowerCase().includes(q),
    );
  }, [suggestions, trimmedQuery]);

  function handleSelect(selection: SpeciesPickerSelection) {
    onSelect(selection);
    setQuery("");
    onClose();
  }

  function handleClose() {
    setQuery("");
    onClose();
  }

  const showCustomOption =
    trimmedQuery.length > 0 &&
    !catalogResults.some(
      (item) => item.species.toLowerCase() === trimmedQuery.toLowerCase(),
    );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-end bg-black/60"
      >
        <Pressable className="flex-1" onPress={handleClose} />
        <View className="max-h-[82%] rounded-t-2xl border-t border-border bg-card">
          <View className="flex-row items-center justify-between px-4 pb-3 pt-3">
            <Text className="font-serif-semibold text-base text-foreground">{title}</Text>
            <Pressable onPress={handleClose} className="rounded-full p-1.5 active:bg-muted">
              <X size={18} color="#8a9e82" />
            </Pressable>
          </View>

          <View className="px-4 pb-3">
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Search birds by name or family"
              autoFocus
            />
          </View>

          {showCustomOption ? (
            <Pressable
              onPress={() =>
                handleSelect({
                  species: trimmedQuery,
                  scientific_name: "",
                })
              }
              className="mx-4 mb-2 rounded-xl border border-border bg-background px-4 py-3 active:opacity-90"
            >
              <Text className="font-sans-medium text-sm text-foreground">
                Use &ldquo;{trimmedQuery}&rdquo;
              </Text>
              <Text className="mt-0.5 font-sans text-xs text-muted-foreground">
                Keep a custom species name
              </Text>
            </Pressable>
          ) : null}

          {!trimmedQuery && suggestions.length > 0 ? (
            <View className="px-4 pb-2">
              <Text className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Suggestions
              </Text>
            </View>
          ) : null}

          <FlatList
            data={trimmedQuery ? catalogResults : []}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              !trimmedQuery && filteredSuggestions.length > 0 ? (
                <View>
                  {filteredSuggestions.map((item) => (
                    <SuggestionRow
                      key={`${item.species}-${item.scientific_name}`}
                      item={item}
                      onPress={() => handleSelect(item)}
                    />
                  ))}
                </View>
              ) : null
            }
            ListEmptyComponent={
              trimmedQuery ? (
                catalogResults.length === 0 ? (
                  <Text className="px-4 py-6 text-center font-sans text-sm text-muted-foreground">
                    No catalog matches. Use the custom name option above.
                  </Text>
                ) : null
              ) : suggestions.length === 0 ? (
                <Text className="px-4 py-6 text-center font-sans text-sm text-muted-foreground">
                  Search for a bird by common or scientific name.
                </Text>
              ) : null
            }
            renderItem={({ item }) => (
              <SpeciesResultRow
                item={item}
                onPress={() =>
                  handleSelect({
                    species: item.species,
                    scientific_name: item.scientific_name,
                  })
                }
              />
            )}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
