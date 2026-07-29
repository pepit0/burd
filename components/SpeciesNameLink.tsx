import { Text, type TextProps } from "react-native";
import { useRouter } from "expo-router";
import { ImageOverlayText } from "@/components/ImageOverlayText";
import { resolveCatalogSpecies } from "@/lib/speciesCatalog";

interface SpeciesNameLinkProps extends TextProps {
  species: string;
  scientificName?: string | null;
  /** Readable stroke when drawn over a photo. */
  overlay?: boolean;
}

export function SpeciesNameLink({
  species,
  scientificName,
  children,
  className,
  overlay = false,
  ...rest
}: SpeciesNameLinkProps) {
  const router = useRouter();
  const catalog = resolveCatalogSpecies(species, scientificName);
  const TextComponent = overlay ? ImageOverlayText : Text;

  function openSpecies() {
    if (catalog) router.push(`/species/${catalog.id}`);
  }

  return (
    <TextComponent
      {...rest}
      className={className}
      containerClassName={overlay ? "w-full" : undefined}
      onPress={catalog ? openSpecies : undefined}
      suppressHighlighting={false}
    >
      {children ?? species}
    </TextComponent>
  );
}
