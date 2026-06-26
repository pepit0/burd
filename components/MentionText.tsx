import { Text } from "react-native";
import { useRouter } from "expo-router";
import { splitMentionParts } from "@/lib/mentions";
import { getUserIdByUsername } from "@/lib/social";

export function MentionText({
  body,
  className,
}: {
  body: string;
  className?: string;
}) {
  const router = useRouter();
  const parts = splitMentionParts(body);

  async function openMention(username: string) {
    try {
      const id = await getUserIdByUsername(username);
      if (id) router.push(`/user/${id}`);
    } catch {
      // ignore lookup failures
    }
  }

  return (
    <Text className={className}>
      {parts.map((part, index) =>
        part.type === "mention" ? (
          <Text
            key={`${index}-${part.value}`}
            className="font-sans-medium text-accent"
            onPress={() => void openMention(part.value)}
          >
            @{part.value}
          </Text>
        ) : (
          <Text key={`${index}-text`}>{part.value}</Text>
        ),
      )}
    </Text>
  );
}
