import { Pressable, View } from "react-native";
import { ImageIcon } from "lucide-react-native";

import { useAccessibility } from "@/components/AccessibilityProvider";
import { PocketBirdPet } from "@/components/PocketBirdPet";
import { ProfileCoverBanner } from "@/components/ProfileCoverBanner";
import { isProfilePetVisible, resolveProfilePetHatId, resolveProfilePetSpeciesId } from "@/lib/profilePet";
import { type PocketBirdHatId } from "@/lib/pocketBird/hats";
import type { Profile } from "@/types";

const PROFILE_BANNER_HEIGHT = 112;
const PROFILE_PET_SIZE = 52;

export { PROFILE_BANNER_HEIGHT, PROFILE_PET_SIZE };

interface ProfileCoverWithPetProps {
  coverUrl?: string | null;
  editable?: boolean;
  onPress?: () => void;
  profile?: Pick<Profile, "pet_species_id" | "pet_hat_id" | "profile_pet_enabled"> | null;
  /** Own-profile local selection — updates immediately before server sync. */
  speciesIdOverride?: string | null;
  hatIdOverride?: PocketBirdHatId | null;
  interactive?: boolean;
  soundEnabled?: boolean;
  /** Hide inline pet — use with a separate overlay layer when stacking above profile actions. */
  suppressPet?: boolean;
}

export function ProfileCoverWithPet({
  coverUrl,
  editable = false,
  onPress,
  profile,
  speciesIdOverride,
  hatIdOverride,
  interactive = false,
  soundEnabled = false,
  suppressPet = false,
}: ProfileCoverWithPetProps) {
  const { reduceMotion } = useAccessibility();
  const speciesId = resolveProfilePetSpeciesId(profile, speciesIdOverride);
  const hatId = resolveProfilePetHatId(profile, hatIdOverride);
  const showPet = isProfilePetVisible(profile) && !suppressPet;

  return (
    <View className="relative">
      <ProfileCoverBanner coverUrl={coverUrl} editable={false} />

      {editable && onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="Change profile banner"
          className="absolute inset-0"
        />
      ) : null}

      {showPet ? (
        <View className="absolute inset-0" pointerEvents="box-none">
          <PocketBirdPet
            speciesId={speciesId}
            hatId={hatId}
            size={PROFILE_PET_SIZE}
            arenaHeight={PROFILE_BANNER_HEIGHT}
            interactive={interactive}
            soundEnabled={soundEnabled}
            paused={reduceMotion}
            grounded
          />
        </View>
      ) : null}

      {editable && onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="Change profile banner"
          className="absolute bottom-2 right-2 z-10 h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-card shadow-sm active:opacity-90"
          style={{ elevation: 8 }}
        >
          <ImageIcon size={13} color="#8a9e82" />
        </Pressable>
      ) : null}
    </View>
  );
}
