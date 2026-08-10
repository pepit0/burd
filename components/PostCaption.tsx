import { Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SpeciesNameLink } from "@/components/SpeciesNameLink";
import type { SightingCompanion } from "@/types";

interface PostCaptionProps {
  authorUsername: string;
  authorUserId: string;
  companions?: SightingCompanion[];
  species: string;
  scientificName?: string | null;
  notes?: string | null;
  className?: string;
}

function CompanionMention({
  companion,
}: {
  companion: SightingCompanion;
}) {
  const router = useRouter();

  return (
    <Text
      className="font-sans-medium text-primary"
      onPress={() => router.push(`/user/${companion.user_id}`)}
    >
      @{companion.username}
    </Text>
  );
}

export function PostCaption({
  authorUsername,
  authorUserId,
  companions = [],
  species,
  scientificName,
  notes,
  className = "",
}: PostCaptionProps) {
  const router = useRouter();
  const trimmedNotes = notes?.trim();

  return (
    <Text className={`font-sans text-sm leading-relaxed text-foreground ${className}`}>
      <Text
        className="font-sans-medium"
        onPress={() => router.push(`/user/${authorUserId}`)}
      >
        @{authorUsername}
      </Text>
      {companions.length > 0 ? (
        <Text>
          {" with "}
          {companions.map((companion, index) => (
            <Text key={companion.user_id}>
              {index > 0 ? ", " : ""}
              <CompanionMention companion={companion} />
            </Text>
          ))}
        </Text>
      ) : null}
      <Text> · </Text>
      <SpeciesNameLink
        species={species}
        scientificName={scientificName}
        className="font-serif-semibold text-primary"
      />
      {trimmedNotes ? (
        <Text className="text-foreground/85"> · {trimmedNotes}</Text>
      ) : null}
    </Text>
  );
}
