import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { getUserFacingMessage } from "@/lib/errors";
import { updateUserBadgesAsAdmin } from "@/lib/moderation";
import type { Profile } from "@/types";

interface UserBadgeAdminPanelProps {
  profile: Pick<Profile, "id" | "username" | "is_verified" | "is_beta">;
  onUpdated: () => void;
}

function BadgeToggleRow({
  label,
  description,
  enabled,
  disabled,
  onToggle,
}: {
  label: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      className={`flex-row items-center justify-between rounded-xl border px-3 py-3 active:opacity-90 ${
        enabled ? "border-primary/40 bg-primary/10" : "border-border bg-background"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <View className="min-w-0 flex-1 pr-3">
        <Text className="font-sans-medium text-sm text-foreground">{label}</Text>
        <Text className="mt-0.5 font-sans text-xs text-muted-foreground">{description}</Text>
      </View>
      <Text className="font-sans-medium text-xs text-primary">
        {enabled ? "On" : "Off"}
      </Text>
    </Pressable>
  );
}

export function UserBadgeAdminPanel({ profile, onUpdated }: UserBadgeAdminPanelProps) {
  const [isVerified, setIsVerified] = useState(Boolean(profile.is_verified));
  const [isBeta, setIsBeta] = useState(Boolean(profile.is_beta));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIsVerified(Boolean(profile.is_verified));
    setIsBeta(Boolean(profile.is_beta));
  }, [profile.id, profile.is_beta, profile.is_verified]);

  const saveBadges = useCallback(
    async (nextVerified: boolean, nextBeta: boolean) => {
      setSaving(true);
      try {
        await updateUserBadgesAsAdmin(profile.id, {
          isVerified: nextVerified,
          isBeta: nextBeta,
        });
        setIsVerified(nextVerified);
        setIsBeta(nextBeta);
        onUpdated();
      } catch (e) {
        Alert.alert("Could not update badges", getUserFacingMessage(e));
      } finally {
        setSaving(false);
      }
    },
    [onUpdated, profile.id],
  );

  return (
    <View className="gap-2">
      <Text className="font-sans-medium text-sm text-foreground">Profile badges</Text>
      <BadgeToggleRow
        label="Verified"
        description="Shows a verified checkmark after the display name."
        enabled={isVerified}
        disabled={saving}
        onToggle={() => void saveBadges(!isVerified, isBeta)}
      />
      <BadgeToggleRow
        label="Beta"
        description="Shows a beta badge after the display name."
        enabled={isBeta}
        disabled={saving}
        onToggle={() => void saveBadges(isVerified, !isBeta)}
      />
      {saving ? (
        <View className="items-center py-1">
          <ActivityIndicator color="#5f9470" size="small" />
        </View>
      ) : null}
    </View>
  );
}
