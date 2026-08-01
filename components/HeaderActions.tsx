import { Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Mic, Users } from "lucide-react-native";
import { triggerHaptic, useAccessibility } from "@/components/AccessibilityProvider";
import { triggerLiveSoundOpenHaptic } from "@/lib/haptics";

export function HeaderActions() {
  const router = useRouter();
  const { hapticsEnabled } = useAccessibility();

  return (
    <>
      <Pressable
        onPress={() => {
          void triggerHaptic(triggerLiveSoundOpenHaptic, hapticsEnabled);
          router.push("/audio-id");
        }}
        className="rounded-full bg-primary p-2 active:opacity-90"
        accessibilityLabel="Identify bird by sound"
      >
        <Mic size={18} color="#f0ead6" />
      </Pressable>
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
