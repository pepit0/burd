import { trackForUser } from "@/lib/analytics";
import { getFunctionErrorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

interface DeleteAccountResponse {
  ok?: boolean;
  error?: string;
}

export async function deleteAccount(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase.functions.invoke<DeleteAccountResponse>(
    "delete-account",
    { method: "POST" },
  );

  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  if (!data?.ok) {
    throw new Error("Could not delete your account. Please try again.");
  }

  if (user?.id) {
    trackForUser(user.id, "account_deleted");
  }

  await supabase.auth.signOut();
}
