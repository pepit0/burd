import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { View } from "react-native";
import { PostSendOffOverlay } from "@/components/PostSendOffOverlay";
import { usePostSendOff } from "@/hooks/usePostSendOff";

interface PostSendOffContextValue {
  playSendOff: () => Promise<void>;
}

const PostSendOffContext = createContext<PostSendOffContextValue | null>(null);

export function PostSendOffProvider({ children }: { children: ReactNode }) {
  const { sendOffKey, playSendOff, onSendOffComplete } = usePostSendOff();

  const value = useMemo(() => ({ playSendOff }), [playSendOff]);

  return (
    <PostSendOffContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        <PostSendOffOverlay sendOffKey={sendOffKey} onComplete={onSendOffComplete} />
      </View>
    </PostSendOffContext.Provider>
  );
}

export function useGlobalPostSendOff(): PostSendOffContextValue {
  const context = useContext(PostSendOffContext);
  if (!context) {
    throw new Error("useGlobalPostSendOff must be used within PostSendOffProvider");
  }
  return context;
}
