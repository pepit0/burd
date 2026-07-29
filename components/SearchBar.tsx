import { useCallback, useRef } from "react";
import { Platform, Pressable, TextInput, View, type TextInputProps } from "react-native";
import { Search, X } from "lucide-react-native";

const INPUT_HEIGHT = 20;

interface SearchBarProps extends TextInputProps {
  value: string;
  onChangeText: (text: string) => void;
  containerClassName?: string;
  inputClassName?: string;
  showSearchIcon?: boolean;
}

export function SearchBar({
  value,
  onChangeText,
  containerClassName = "",
  inputClassName = "flex-1 font-sans text-sm text-foreground",
  showSearchIcon = true,
  placeholderTextColor = "#8a9e82",
  autoCorrect = false,
  spellCheck = false,
  style,
  ...rest
}: SearchBarProps) {
  const hasText = value.length > 0;
  const inputRef = useRef<TextInput>(null);
  const clearingRef = useRef(false);

  const handleChangeText = useCallback(
    (text: string) => {
      if (clearingRef.current) return;
      onChangeText(text);
    },
    [onChangeText],
  );

  const handleClear = useCallback(() => {
    clearingRef.current = true;
    inputRef.current?.setNativeProps({ text: "" });
    onChangeText("");
    requestAnimationFrame(() => {
      setTimeout(() => {
        clearingRef.current = false;
      }, 100);
    });
  }, [onChangeText]);

  return (
    <View
      className={`flex-row items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 ${containerClassName}`}
    >
      {showSearchIcon ? <Search size={14} color="#8a9e82" /> : null}
      <TextInput
        {...rest}
        ref={inputRef}
        value={value}
        onChangeText={handleChangeText}
        placeholderTextColor={placeholderTextColor}
        autoCorrect={autoCorrect}
        spellCheck={spellCheck}
        className={inputClassName}
        multiline={false}
        numberOfLines={1}
        scrollEnabled={false}
        style={[
          {
            height: INPUT_HEIGHT,
            paddingVertical: 0,
            margin: 0,
            textAlignVertical: "center",
            ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
          },
          style,
        ]}
      />
      <Pressable
        onPressIn={handleClear}
        hitSlop={8}
        disabled={!hasText}
        pointerEvents={hasText ? "auto" : "none"}
        className="-mr-0.5 rounded-full p-1 active:opacity-70"
        accessibilityLabel="Clear search"
        style={{ opacity: hasText ? 1 : 0 }}
      >
        <X size={14} color="#8a9e82" />
      </Pressable>
    </View>
  );
}
