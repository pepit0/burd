import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Avatar } from "@/components/Avatar";
import { applyMention, getActiveMentionQuery } from "@/lib/mentions";
import { searchUsersForMention, type UserListItem } from "@/lib/social";

const INPUT_FONT_SIZE = 14;
const INPUT_LINE_HEIGHT = 20;
/** Matches icon row — keeps placeholder aligned with speech bubble & send. */
const INPUT_ROW_HEIGHT = 36;
const INPUT_MAX_HEIGHT = 96;
const INPUT_PADDING_Y = (INPUT_ROW_HEIGHT - INPUT_LINE_HEIGHT) / 2;

interface MentionTextInputProps extends Omit<TextInputProps, "value" | "onChangeText"> {
  value: string;
  onChangeText: (text: string) => void;
  userId: string | null;
}

export function MentionTextInput({
  value,
  onChangeText,
  userId,
  style,
  ...inputProps
}: MentionTextInputProps) {
  const [cursor, setCursor] = useState(0);
  const [suggestions, setSuggestions] = useState<UserListItem[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const mentionQuery = getActiveMentionQuery(value, cursor);
  const showSuggestions = !!userId && mentionQuery !== null;

  useEffect(() => {
    if (!value) setCursor(0);
  }, [value]);

  useEffect(() => {
    if (!userId || mentionQuery === null) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    setLoadingSuggestions(true);

    const timer = setTimeout(async () => {
      try {
        const rows = await searchUsersForMention(mentionQuery, userId);
        if (!cancelled) setSuggestions(rows);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoadingSuggestions(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mentionQuery, userId]);

  function pickUser(user: UserListItem) {
    const next = applyMention(value, cursor, user.username);
    onChangeText(next.text);
    setCursor(next.selection);
    setSuggestions([]);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelection(next.selection, next.selection);
    });
  }

  return (
    <View className="relative flex-1">
      {showSuggestions ? (
        <View className="absolute bottom-full left-0 right-0 z-10 mb-2 overflow-hidden rounded-xl border border-border bg-background">
          {loadingSuggestions && suggestions.length === 0 ? (
            <ActivityIndicator className="my-3" color="#5f9470" />
          ) : suggestions.length === 0 ? (
            <Text className="px-3 py-2.5 font-sans text-xs text-muted-foreground">
              No users found
            </Text>
          ) : (
            suggestions.map((user) => (
              <Pressable
                key={user.id}
                onPress={() => pickUser(user)}
                className="flex-row items-center gap-2.5 border-b border-border/40 px-3 py-2.5 active:bg-card"
              >
                <Avatar user={user.username} color={user.avatar_color} size={28} />
                <View className="min-w-0 flex-1">
                  <Text className="font-sans-medium text-sm text-foreground">
                    @{user.username}
                  </Text>
                  {user.full_name ? (
                    <Text className="font-sans text-xs text-muted-foreground">
                      {user.full_name}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))
          )}
        </View>
      ) : null}

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onSelectionChange={(e) => setCursor(e.nativeEvent.selection.start)}
        {...inputProps}
        multiline
        scrollEnabled
        style={[
          {
            flex: 1,
            fontSize: INPUT_FONT_SIZE,
            lineHeight: INPUT_LINE_HEIGHT,
            height: INPUT_ROW_HEIGHT,
            maxHeight: INPUT_MAX_HEIGHT,
            paddingTop: INPUT_PADDING_Y,
            paddingBottom: INPUT_PADDING_Y,
            paddingHorizontal: 0,
            margin: 0,
            textAlignVertical: "center",
            ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
          },
          style,
        ]}
      />
    </View>
  );
}
