import { Linking, Text } from "react-native";
import { normalizeLinkUrl, splitLinkParts } from "@/lib/linkify";

export function LinkableText({
  children,
  className,
  linkClassName = "text-primary underline",
}: {
  children: string;
  className?: string;
  linkClassName?: string;
}) {
  const parts = splitLinkParts(children);

  return (
    <Text className={className}>
      {parts.map((part, index) =>
        part.type === "link" ? (
          <Text
            key={`link-${index}-${part.value}`}
            className={linkClassName}
            onPress={() => void Linking.openURL(normalizeLinkUrl(part.value))}
            accessibilityRole="link"
          >
            {part.value}
          </Text>
        ) : (
          <Text key={`text-${index}`}>{part.value}</Text>
        ),
      )}
    </Text>
  );
}
