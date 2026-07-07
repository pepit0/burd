import { Text, type TextProps } from "react-native";
import { parseDisplayNameRuns } from "@/lib/displayNameColors";

interface DisplayNameTextProps extends TextProps {
  text: string;
}

export function DisplayNameText({ text, ...props }: DisplayNameTextProps) {
  const runs = parseDisplayNameRuns(text);
  return (
    <Text {...props}>
      {runs.map((run, idx) => (
        <Text key={`${run.text}-${idx}`} style={run.color ? { color: run.color } : undefined}>
          {run.text}
        </Text>
      ))}
    </Text>
  );
}

