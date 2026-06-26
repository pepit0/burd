import { supabase } from "@/lib/supabase";

export interface SpeciesChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SpeciesAskResponse {
  reply: string;
}

export async function askSpeciesGuide(
  commonName: string,
  scientificName: string,
  messages: SpeciesChatMessage[],
  question: string,
): Promise<string> {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error("Please enter a question.");
  }

  const history: SpeciesChatMessage[] = [
    ...messages,
    { role: "user", content: trimmed },
  ];

  const { data, error } = await supabase.functions.invoke<SpeciesAskResponse>(
    "species-ask",
    {
      body: {
        common_name: commonName,
        scientific_name: scientificName,
        messages: history,
      },
    },
  );

  if (error) {
    throw error;
  }

  if (!data?.reply?.trim()) {
    throw new Error("No answer returned. Try again.");
  }

  return data.reply.trim();
}
