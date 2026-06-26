import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Send } from "lucide-react-native";
import { askSpeciesGuide, type SpeciesChatMessage } from "@/lib/speciesAsk";
import { getErrorMessage } from "@/lib/errors";

interface SpeciesAskGuideProps {
  commonName: string;
  scientificName: string;
}

export function SpeciesAskGuide({
  commonName,
  scientificName,
}: SpeciesAskGuideProps) {
  const [messages, setMessages] = useState<SpeciesChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    setError(null);
    setLoading(true);
    setInput("");

    const priorMessages = messages;
    setMessages((prev) => [...prev, { role: "user", content: question }]);

    try {
      const reply = await askSpeciesGuide(
        commonName,
        scientificName,
        priorMessages,
        question,
      );
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages(priorMessages);
      setInput(question);
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="gap-3 rounded-2xl border border-border bg-card p-4">
        <View>
          <Text className="font-sans-medium text-sm text-foreground">
            Ask about this bird
          </Text>
          <Text className="mt-0.5 font-sans text-xs text-muted-foreground">
            Get quick answers from Burd's nature guide.
          </Text>
        </View>

        {messages.length > 0 ? (
          <View className="gap-3">
            {messages.map((message, index) => (
              <View
                key={`${message.role}-${index}-${message.content.slice(0, 24)}`}
                className={
                  message.role === "user"
                    ? "self-end max-w-[92%] rounded-2xl rounded-br-sm bg-primary/15 px-3 py-2.5"
                    : "self-start max-w-[92%] rounded-2xl rounded-bl-sm border border-border/60 bg-background/40 px-3 py-2.5"
                }
              >
                <Text
                  className={`font-sans text-sm leading-relaxed ${
                    message.role === "user"
                      ? "text-foreground"
                      : "text-foreground/90"
                  }`}
                >
                  {message.content}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {loading ? (
          <View className="flex-row items-center gap-2 py-1">
            <ActivityIndicator size="small" color="#5f9470" />
            <Text className="font-sans text-xs text-muted-foreground">
              Thinking…
            </Text>
          </View>
        ) : null}

        {error ? (
          <Text className="font-sans text-xs text-red-400/90">{error}</Text>
        ) : null}

        <View className="flex-row items-end gap-2">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask a question…"
            placeholderTextColor="#8a9e82"
            multiline
            editable={!loading}
            className="max-h-24 min-h-[44px] flex-1 rounded-xl border border-border bg-background px-3 py-2.5 font-sans text-sm text-foreground"
          />
          <Pressable
            onPress={handleSend}
            disabled={loading || !input.trim()}
            className={`h-11 w-11 items-center justify-center rounded-xl bg-primary active:opacity-80 ${
              loading || !input.trim() ? "opacity-40" : ""
            }`}
          >
            <Send size={18} color="#f0ead6" />
          </Pressable>
        </View>
    </View>
  );
}
