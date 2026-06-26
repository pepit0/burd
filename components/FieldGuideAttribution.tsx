import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";
import type { FieldGuideAuthor } from "@/lib/speciesFieldGuideAuthor";

interface FieldGuideAttributionProps {
  author: FieldGuideAuthor | null;
  fieldGuideLocked: boolean;
  loading?: boolean;
}

export function FieldGuideAttribution({
  author,
  fieldGuideLocked,
  loading = false,
}: FieldGuideAttributionProps) {
  const router = useRouter();

  if (loading) return null;

  if (fieldGuideLocked && !author) {
    return (
      <Text className="font-sans text-[11px] leading-relaxed text-muted-foreground/80">
        Be the first to generate the field guide. The first birder to capture
        this species becomes the field guide author. Content is AI-generated.
      </Text>
    );
  }

  if (fieldGuideLocked && author) {
    return (
      <Pressable onPress={() => router.push(`/user/${author.userId}`)}>
        <Text className="font-sans text-[11px] leading-relaxed text-muted-foreground/80">
          Field guide author{" "}
          <Text className="font-sans-medium text-foreground/70">
            @{author.username}
          </Text>
          {" · first capture · field guide pending · AI-generated"}
        </Text>
      </Pressable>
    );
  }

  if (!fieldGuideLocked && author) {
    return (
      <Pressable onPress={() => router.push(`/user/${author.userId}`)}>
        <Text className="font-sans text-[11px] text-muted-foreground/75">
          Field guide author{" "}
          <Text className="font-sans-medium text-foreground/65">
            @{author.username}
          </Text>
          {" · AI-generated"}
        </Text>
      </Pressable>
    );
  }

  if (!fieldGuideLocked) {
    return (
      <Text className="font-sans text-[11px] text-muted-foreground/70">
        AI-generated field guide
      </Text>
    );
  }

  return null;
}
