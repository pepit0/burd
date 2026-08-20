import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BurdLogoMark } from "@/components/BurdLogoMark";
import {
  IMAGE_OVERLAY_GRADIENT,
  ImageOverlayText,
} from "@/components/ImageOverlayText";
import { RarityBadge } from "@/components/RarityBadge";
import { rarityForSpeciesCard, speciesCardPlaceLine } from "@/lib/speciesCards";
import { RARITY_BORDER_COLORS } from "@/lib/rarityVisual";
import type { SpeciesCard as SpeciesCardRow } from "@/types";

const OVERLAY_FILL = { color: "#ffffff" } as const;

interface SpeciesCardProps {
  card: SpeciesCardRow;
  width: number;
  variant?: "grid" | "hero";
  onPress?: () => void;
  onLongPress?: () => void;
}

export function SpeciesCard({
  card,
  width,
  variant = "grid",
  onPress,
  onLongPress,
}: SpeciesCardProps) {
  const height = Math.round((width * 4) / 3);
  const place = speciesCardPlaceLine(card.location_city, card.location_country);
  const hero = variant === "hero";
  const rarity = rarityForSpeciesCard(card);
  const borderColor = RARITY_BORDER_COLORS[rarity];

  const inner = (
    <View
      className="overflow-hidden rounded-2xl border-2 bg-card"
      style={{
        width,
        height,
        borderColor,
      }}
    >
      <Image
        source={{ uri: card.photo_url }}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        transition={200}
      />
      <LinearGradient
        colors={[...IMAGE_OVERLAY_GRADIENT]}
        className="absolute inset-0"
        pointerEvents="none"
      />
      <View
        pointerEvents="none"
        className={`absolute left-0 top-0 ${hero ? "p-3" : "p-2"}`}
      >
        <BurdLogoMark size={hero ? 26 : 20} />
      </View>
      <View
        pointerEvents="none"
        className={`absolute right-0 top-0 ${hero ? "p-3" : "p-2"}`}
      >
        <RarityBadge rarity={rarity} size={hero ? "lg" : "sm"} alwaysShow variant="plain" />
      </View>
      <View className={`absolute bottom-0 left-0 right-0 ${hero ? "p-4" : "p-3"}`}>
        <ImageOverlayText
          className={
            hero
              ? "font-serif-semibold text-xl leading-tight"
              : "font-serif-semibold text-base leading-tight"
          }
          style={OVERLAY_FILL}
          containerClassName="w-full"
          numberOfLines={2}
        >
          {card.species}
        </ImageOverlayText>
        <ImageOverlayText
          className={
            hero
              ? "mt-1 font-serif-italic text-sm"
              : "mt-0.5 font-serif-italic text-[11px]"
          }
          style={OVERLAY_FILL}
          containerClassName="w-full"
          numberOfLines={1}
        >
          {card.scientific_name}
        </ImageOverlayText>
        {place ? (
          <ImageOverlayText
            className={
              hero ? "mt-2 font-sans text-xs" : "mt-1.5 font-sans text-[10px]"
            }
            style={OVERLAY_FILL}
            containerClassName="w-full"
            numberOfLines={1}
          >
            {place}
          </ImageOverlayText>
        ) : null}
      </View>
    </View>
  );

  if (!onPress && !onLongPress) return inner;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={450}
      className="active:opacity-90"
    >
      {inner}
    </Pressable>
  );
}
