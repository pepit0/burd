import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, RefreshCw, Search, UserSearch } from "lucide-react-native";
import { SearchBar } from "@/components/SearchBar";
import {
  DismissKeyboardArea,
  dismissKeyboardOnScrollDrag,
  keyboardAwareScrollProps,
} from "@/components/DismissKeyboard";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import {
  issueBadgeTone,
  lookupAdminUserDiagnostics,
  resetAdminUserOnboarding,
  type AdminUserDiagnostics,
} from "@/lib/adminSupport";
import { getUserFacingMessage } from "@/lib/errors";
import { timeAgo } from "@/lib/time";

function DiagnosticRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-start justify-between gap-3 py-1.5">
      <Text className="font-sans text-xs text-muted-foreground">{label}</Text>
      <Text className="max-w-[62%] text-right font-sans-medium text-xs text-foreground">
        {value}
      </Text>
    </View>
  );
}

function IssueBadge({ issue, label }: { issue: AdminUserDiagnostics["issue"]; label: string }) {
  const tone = issueBadgeTone(issue);
  const className =
    tone === "ok"
      ? "border-primary/30 bg-primary/10"
      : tone === "error"
        ? "border-destructive/30 bg-destructive/10"
        : "border-accent/30 bg-accent/10";
  const textClass =
    tone === "ok"
      ? "text-primary"
      : tone === "error"
        ? "text-destructive"
        : "text-accent";

  return (
    <View className={`self-start rounded-full border px-2.5 py-1 ${className}`}>
      <Text className={`font-sans-medium text-[11px] ${textClass}`}>{label}</Text>
    </View>
  );
}

function UserDiagnosticsCard({
  row,
  resetting,
  onReset,
  onForceReset,
}: {
  row: AdminUserDiagnostics;
  resetting: boolean;
  onReset: () => void;
  onForceReset: () => void;
}) {
  return (
    <View className="mb-3 rounded-xl border border-border bg-card p-4">
      <View className="mb-3 flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="font-sans-medium text-sm text-foreground">
            {row.email ?? "No email"}
          </Text>
          <Text className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {row.user_id}
          </Text>
        </View>
        <IssueBadge issue={row.issue} label={row.issue_label} />
      </View>

      <DiagnosticRow
        label="Email confirmed"
        value={row.email_confirmed ? "Yes" : "No"}
      />
      <DiagnosticRow
        label="username_chosen"
        value={row.username_chosen ?? "—"}
      />
      <DiagnosticRow
        label="Profile"
        value={
          row.has_profile
            ? `@${row.profile_username ?? "?"} · ${row.profile_full_name ?? "—"}`
            : "Missing"
        }
      />
      <DiagnosticRow
        label="Signup"
        value={`${row.signup_method ?? "unknown"} · ${row.signup_platform ?? "unknown"}`}
      />
      <DiagnosticRow
        label="Created"
        value={row.created_at ? timeAgo(row.created_at) : "—"}
      />
      <DiagnosticRow
        label="Last sign-in"
        value={row.last_sign_in_at ? timeAgo(row.last_sign_in_at) : "Never"}
      />

      <View className="mt-4 flex-row flex-wrap gap-2">
        {row.can_reset_onboarding ? (
          <Pressable
            disabled={resetting}
            onPress={onReset}
            className="min-w-[46%] flex-1 items-center rounded-lg bg-primary py-2.5 active:opacity-90"
          >
            {resetting ? (
              <ActivityIndicator color="#f0ead6" />
            ) : (
              <Text className="font-sans-medium text-xs text-primary-foreground">
                Reset onboarding
              </Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            disabled={resetting}
            onPress={onForceReset}
            className="min-w-[46%] flex-1 items-center rounded-lg border border-destructive/30 bg-destructive/10 py-2.5 active:opacity-90"
          >
            <Text className="font-sans-medium text-xs text-destructive">
              Force reset
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function AdminUserSupportScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { isAdmin, loading: adminLoading } = useAdmin(userId);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminUserDiagnostics[]>([]);
  const [searching, setSearching] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    const trimmed = query.trim();
    if (!trimmed || searching) return;

    setSearching(true);
    setSearched(true);
    try {
      const rows = await lookupAdminUserDiagnostics(trimmed);
      setResults(rows);
    } catch (e) {
      Alert.alert("Lookup failed", getUserFacingMessage(e));
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function runReset(target: AdminUserDiagnostics, force: boolean) {
    if (resettingId) return;

    const title = force ? "Force reset onboarding?" : "Reset onboarding?";
    const message = force
      ? `This deletes @${target.profile_username ?? "profile"} and sends ${target.email ?? "this user"} back to choose-username. Only use for support.`
      : `Send ${target.email ?? "this user"} back to the choose-username screen on next sign-in.`;

    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: force ? "Force reset" : "Reset",
        style: force ? "destructive" : "default",
        onPress: () => {
          void (async () => {
            setResettingId(target.user_id);
            try {
              const updated = await resetAdminUserOnboarding(target.user_id, { force });
              setResults((prev) =>
                prev.map((row) => (row.user_id === target.user_id ? updated : row)),
              );
              Alert.alert(
                "Onboarding reset",
                `${updated.email ?? "User"} should sign out and back in, then finish profile setup.`,
              );
            } catch (e) {
              Alert.alert("Reset failed", getUserFacingMessage(e));
            } finally {
              setResettingId(null);
            }
          })();
        },
      },
    ]);
  }

  if (adminLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#5f9470" />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center border-b border-border px-3 pb-2.5 pt-1">
          <Pressable onPress={() => router.back()} className="rounded-full p-2 active:bg-card">
            <ArrowLeft size={22} color="#eee8d4" />
          </Pressable>
          <Text className="mx-2 flex-1 text-center font-serif-semibold text-base text-foreground">
            User support
          </Text>
          <View className="w-10" />
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center font-sans text-sm text-muted-foreground">
            Admin access is required.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <View className="flex-row items-center border-b border-border px-3 pb-2.5 pt-1">
        <Pressable onPress={() => router.back()} className="rounded-full p-2 active:bg-card">
          <ArrowLeft size={22} color="#eee8d4" />
        </Pressable>
        <Text className="mx-2 flex-1 text-center font-serif-semibold text-base text-foreground">
          User support
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView
        contentContainerClassName="px-4 pb-12 pt-4"
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={dismissKeyboardOnScrollDrag}
        {...keyboardAwareScrollProps}
      >
        <DismissKeyboardArea>
          <View className="mb-2 flex-row items-center gap-2">
            <UserSearch size={16} color="#5f9470" />
            <Text className="font-serif-semibold text-lg text-foreground">
              Account diagnostics
            </Text>
          </View>
          <Text className="mb-4 font-sans text-sm leading-relaxed text-muted-foreground">
            Look up a user by email or @username to inspect signup state. Reset
            onboarding sends them to choose-username on next sign-in — no
            password access required.
          </Text>

          <View className="mb-4 flex-row gap-2">
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Email or @username"
              placeholderTextColor="#5a6e52"
              autoCapitalize="none"
              keyboardType="email-address"
              showSearchIcon={false}
              containerClassName="flex-1 px-4 py-3"
              onSubmitEditing={() => void handleSearch()}
            />
            <Pressable
              onPress={() => void handleSearch()}
              className="items-center justify-center rounded-xl bg-primary px-4 active:opacity-90"
            >
              {searching ? (
                <ActivityIndicator color="#f0ead6" />
              ) : (
                <Search size={18} color="#f0ead6" />
              )}
            </Pressable>
          </View>

          {searched && results.length === 0 && !searching ? (
            <Text className="font-sans text-sm text-muted-foreground">
              No users matched that search.
            </Text>
          ) : null}

          {results.map((row) => (
            <UserDiagnosticsCard
              key={row.user_id}
              row={row}
              resetting={resettingId === row.user_id}
              onReset={() => void runReset(row, false)}
              onForceReset={() => void runReset(row, true)}
            />
          ))}

          {results.length > 0 ? (
            <Pressable
              onPress={() => void handleSearch()}
              className="mt-2 flex-row items-center justify-center gap-2 rounded-xl border border-border py-3 active:opacity-90"
            >
              <RefreshCw size={14} color="#8a9e82" />
              <Text className="font-sans-medium text-sm text-muted-foreground">
                Refresh results
              </Text>
            </Pressable>
          ) : null}
        </DismissKeyboardArea>
      </ScrollView>
    </SafeAreaView>
  );
}
