import { Text, type TextProps } from "react-native";
import { useRouter } from "expo-router";
import { resolveCatalogSpecies } from "@/lib/speciesCatalog";

interface SpeciesNameLinkProps extends TextProps {
  species: string;
  scientificName?: string | null;
}

export function SpeciesNameLink({
  species,
  scientificName,
  children,
  className,
  ...rest
}: SpeciesNameLinkProps) {
  const router = useRouter();
  const catalog = resolveCatalogSpecies(species, scientificName);

  function openSpecies() {
    if (catalog) router.push(`/species/${catalog.id}`);
  }

  return (
    <Text
      {...rest}
      className={className}
      onPress={catalog ? openSpecies : undefined}
      suppressHighlighting={false}
    >
      {children ?? species}
    </Text>
  );
}
