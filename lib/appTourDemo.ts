import { Image } from "react-native";
import { resolveCatalogSpecies } from "@/lib/speciesCatalog";
import type { SpeciesCard } from "@/types";

export const TOUR_DEMO_CARD_ID = "tour-demo-card";
export const TOUR_DEMO_PHOTO = require("../assets/app-store/nuthatch-hero.jpg") as number;

const DEMO_SPECIES = "White-breasted Nuthatch";
const DEMO_SCIENTIFIC = "Sitta carolinensis";

export function tourDemoPhotoUri(): string {
  return Image.resolveAssetSource(TOUR_DEMO_PHOTO).uri;
}

export function buildTourDemoCard(): SpeciesCard {
  const catalog = resolveCatalogSpecies(DEMO_SPECIES, DEMO_SCIENTIFIC);
  return {
    id: TOUR_DEMO_CARD_ID,
    user_id: "tour",
    species: catalog?.species ?? DEMO_SPECIES,
    scientific_name: catalog?.scientific_name ?? DEMO_SCIENTIFIC,
    catalog_id: catalog?.id ?? "tour-demo",
    photo_url: tourDemoPhotoUri(),
    location_city: null,
    location_country: null,
    sighting_id: null,
    unlocked_at: new Date().toISOString(),
  };
}

export function tourDemoLiveId() {
  const catalog = resolveCatalogSpecies(DEMO_SPECIES, DEMO_SCIENTIFIC);
  return {
    species: catalog?.species ?? DEMO_SPECIES,
    scientificName: catalog?.scientific_name ?? DEMO_SCIENTIFIC,
    confidence: 0.94,
  };
}
