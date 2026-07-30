import { Alert } from "react-native";

export const REPORT_REASONS = [
  "Harassment or hate",
  "Spam",
  "Inappropriate content",
  "Other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export function pickReportReason(title = "Report reason"): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      "Why are you reporting this?",
      [
        ...REPORT_REASONS.map((reason) => ({
          text: reason,
          onPress: () => resolve(reason),
        })),
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
      ],
    );
  });
}
