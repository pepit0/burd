import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Camera, Pencil } from "lucide-react-native";
import { DisplayNameText } from "@/components/DisplayNameText";
import { ProfileDetailsEditSheet } from "@/components/ProfileDetailsEditSheet";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { getUserFacingMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { stripDisplayNameColorCodes } from "@/lib/displayNameColors";

export default function AccountPreferencesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { profile, loading, updateAvatar, updateDetails } = useProfile(userId);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [detailsEditOpen, setDetailsEditOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  const displayName = profile?.full_name || profile?.username || "Birder";
  const displayNamePlain = stripDisplayNameColorCodes(displayName);

  async function pickProfilePhoto() {
    if (!userId || avatarUploading) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Allow photo library access to choose a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    setAvatarUploading(true);
    try {
      const ext = result.assets[0].uri?.endsWith(".png") ? "png" : "jpg";
      await updateAvatar(result.assets[0].base64, ext);
    } catch (e) {
      Alert.alert("Could not update photo", getUserFacingMessage(e));
    } finally {
      setAvatarUploading(false);
    }
  }

  async function saveProfileDetails(fullName: string, bio: string) {
    setProfileSaving(true);
    try {
      await updateDetails({ full_name: fullName || null, bio: bio || null });
      setDetailsEditOpen(false);
    } catch (e) {
      Alert.alert("Could not update profile", getUserFacingMessage(e));
    } finally {
      setProfileSaving(false);
    }
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader title="Account" onBack={() => router.back()} />
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10 pt-2">
        {loading && !profile ? (
          <ActivityIndicator className="mt-8" color="#5f9470" />
        ) : (
          <>
            <SettingsGroup title="Profile">
              <View className="items-center px-4 py-5">
                <Pressable onPress={() => void pickProfilePhoto()} className="relative active:opacity-90">
                  {profile?.avatar_url ? (
                    <Image
                      source={{ uri: profile.avatar_url }}
                      className="h-20 w-20 rounded-full border-2 border-border"
                    />
                  ) : (
                    <View
                      className="h-20 w-20 items-center justify-center rounded-full border-2 border-border"
                      style={{ backgroundColor: profile?.avatar_color ?? "#5f9470" }}
                    >
                      <Text className="font-serif-semibold text-2xl text-primary-foreground">
                        {(profile?.username ?? "?")[0]?.toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View className="absolute -bottom-1 -right-1 rounded-full border border-border bg-card p-1.5">
                    {avatarUploading ? (
                      <ActivityIndicator size="small" color="#5f9470" />
                    ) : (
                      <Camera size={14} color="#8a9e82" />
                    )}
                  </View>
                </Pressable>
                <DisplayNameText
                  text={displayName}
                  className="mt-3 font-serif-semibold text-lg text-foreground"
                />
                <Text className="font-mono text-xs text-muted-foreground">@{profile?.username}</Text>
                {profile?.bio ? (
                  <Text className="mt-2 text-center font-sans text-sm text-muted-foreground">
                    {profile.bio}
                  </Text>
                ) : null}
                <Pressable
                  onPress={() => setDetailsEditOpen(true)}
                  className="mt-3 flex-row items-center gap-1.5 rounded-full border border-border px-3 py-1.5 active:bg-card/80"
                >
                  <Pencil size={13} color="#8a9e82" />
                  <Text className="font-sans-medium text-xs text-foreground">Edit name & bio</Text>
                </Pressable>
              </View>
              <SettingsRow label="Username" value={`@${profile?.username ?? "—"}`} showChevron={false} borderTop />
              <SettingsRow label="Email" value={user?.email ?? "—"} showChevron={false} borderTop />
            </SettingsGroup>

            <SettingsGroup title="Session">
              <SettingsRow
                label="Sign out"
                onPress={() => {
                  Alert.alert("Sign out?", "You can sign back in anytime.", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Sign out", style: "destructive", onPress: () => void supabase.auth.signOut() },
                  ]);
                }}
              />
            </SettingsGroup>

            <SettingsGroup
              title="Danger zone"
              footer="Deleting your account permanently removes all your data. Export first if you want a copy."
            >
              <SettingsRow
                label="Delete account"
                detail="Permanently remove your account and all data"
                destructive
                onPress={() => router.push("/preferences/delete-account")}
              />
            </SettingsGroup>
          </>
        )}
      </ScrollView>

      <ProfileDetailsEditSheet
        visible={detailsEditOpen}
        fullName={profile?.full_name ?? ""}
        bio={profile?.bio ?? ""}
        saving={profileSaving}
        onClose={() => setDetailsEditOpen(false)}
        onSave={(fullName, bio) => void saveProfileDetails(fullName, bio)}
      />
    </SafeAreaView>
  );
}
