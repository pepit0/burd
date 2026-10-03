import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";
import { Mic, Users } from "lucide-react-native";
import { triggerHaptic, useAccessibility } from "@/components/AccessibilityProvider";
import { TourSpotlight } from "@/components/TourSpotlight";
import { triggerLiveSoundOpenHaptic } from "@/lib/haptics";

export function HeaderActions() {
  const router = useRouter();
  const { hapticsEnabled } = useAccessibility();

  return (
    <>
      <TourSpotlight target="header-mic" style={{ borderRadius: 999 }}>
      <Pressable
        onPress={() => {
          void triggerHaptic(triggerLiveSoundOpenHaptic, hapticsEnabled);
          router.push("/audio-id");
        }}
        className="flex-row items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 active:opacity-90"
        accessibilityLabel="Identify bird by sound"
      >
        <Text className="font-sans-bold text-sm text-primary-foreground">
          Sound ID
        </Text>
        <Mic size={18} color="#f0ead6" />
      </Pressable>
      </TourSpotlight>
      <Pressable
        onPress={() => router.push("/users")}
        className="rounded-full p-2 active:bg-card"
        accessibilityLabel="Find birders"
      >
        <Users size={18} color="#8a9e82" />
      </Pressable>
    </>
  );
}
