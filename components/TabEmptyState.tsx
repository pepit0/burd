import { ActivityIndicator, Pressable, Text, View } from "react-native";

interface TabEmptyStateProps {
  children: React.ReactNode;
  action?: { label: string; onPress: () => void };
  loading?: boolean;
}

/** Centered empty/loading message for tab scroll areas. */
export function TabEmptyState({
  children,
  action,
  loading = false,
}: TabEmptyStateProps) {
  return (
    <View className="min-h-[240px] flex-1 items-center justify-center px-8 py-10">
      {loading ? (
        <ActivityIndicator color="#5f9470" />
      ) : (
        <>
          <Text className="text-center font-sans text-sm leading-relaxed text-muted-foreground">
            {children}
          </Text>
          {action ? (
            <Pressable
              onPress={action.onPress}
              className="mt-5 rounded-full bg-primary px-5 py-3 active:opacity-90"
            >
              <Text className="font-sans-medium text-sm text-primary-foreground">
                {action.label}
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}
