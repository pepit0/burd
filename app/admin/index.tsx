import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, ShieldAlert, Trash2 } from "lucide-react-native";
import { ModerationReasonModal } from "@/components/ModerationReasonModal";
import { DisplayNameText } from "@/components/DisplayNameText";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { getUserFacingMessage } from "@/lib/errors";
import {
  getPendingReports,
  getRecentModerationLog,
  adminUpdateUsername,
  grantAdmin,
  listAdmins,
  removePostAsAdmin,
  revokeAdmin,
} from "@/lib/moderation";
import { searchUsers, searchUsersForAdmin, type UserListItem } from "@/lib/social";
import { normalizeUsername, validateUsername } from "@/lib/signup";
import { timeAgo } from "@/lib/time";
import type { ModerationAction, PostReport, Profile } from "@/types";

export default function AdminHubScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { isAdmin, loading: adminLoading, refresh: refreshAdmin } = useAdmin(userId);

  const [reports, setReports] = useState<PostReport[]>([]);
  const [log, setLog] = useState<ModerationAction[]>([]);
  const [admins, setAdmins] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminQuery, setAdminQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [usernameQuery, setUsernameQuery] = useState("");
  const [usernameResults, setUsernameResults] = useState<UserListItem[]>([]);
  const [usernameSearching, setUsernameSearching] = useState(false);
  const [renameTarget, setRenameTarget] = useState<UserListItem | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [removeReport, setRemoveReport] = useState<PostReport | null>(null);
  const [removing, setRemoving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [reportRows, logRows, adminRows] = await Promise.all([
        getPendingReports(),
        getRecentModerationLog(),
        listAdmins(),
      ]);
      setReports(reportRows);
      setLog(logRows);
      setAdmins(adminRows);
    } catch (e) {
      Alert.alert("Could not load admin data", getUserFacingMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  async function handleSearchAdmins(query: string) {
    const q = query.trim();
    if (!q || !userId) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchUsers(q, userId);
      const adminIds = new Set(admins.map((admin) => admin.id));
      setSearchResults(results.filter((p) => !adminIds.has(p.id)));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    const q = adminQuery.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void handleSearchAdmins(adminQuery);
    }, 180);
    return () => clearTimeout(timer);
  }, [adminQuery, userId, admins]);

  async function handleGrantAdmin(target: UserListItem) {
    Alert.alert(
      "Grant admin access?",
      `@${target.username} will be able to moderate posts and users.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Grant admin",
          onPress: () => {
            void (async () => {
              try {
                await grantAdmin(target.id);
                setSearchResults([]);
                setAdminQuery("");
                await load();
              } catch (e) {
                Alert.alert("Could not grant admin", getUserFacingMessage(e));
              }
            })();
          },
        },
      ],
    );
  }

  async function handleSearchUsersForRename(query: string) {
    const q = query.trim();
    if (!q || !userId) {
      setUsernameResults([]);
      return;
    }
    setUsernameSearching(true);
    try {
      const results = await searchUsersForAdmin(q, userId, {
        includeSelf: true,
        limit: 60,
      });
      setUsernameResults(results);
    } catch {
      setUsernameResults([]);
    } finally {
      setUsernameSearching(false);
    }
  }

  useEffect(() => {
    const q = usernameQuery.trim();
    if (!q) {
      setUsernameResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void handleSearchUsersForRename(usernameQuery);
    }, 180);
    return () => clearTimeout(timer);
  }, [usernameQuery, userId]);

  async function handleRenameUsername() {
    if (!renameTarget) return;
    const validation = validateUsername(newUsername);
    if (validation) {
      Alert.alert("Invalid username", validation);
      return;
    }

    setRenaming(true);
    try {
      const normalized = normalizeUsername(newUsername);
      await adminUpdateUsername(renameTarget.id, normalized);
      Alert.alert("Username updated", `@${renameTarget.username} is now @${normalized}.`);
      setRenameTarget(null);
      setNewUsername("");
      setUsernameQuery("");
      setUsernameResults([]);
      await load();
    } catch (e) {
      Alert.alert("Could not update username", getUserFacingMessage(e));
    } finally {
      setRenaming(false);
    }
  }

  async function handleRevokeAdmin(target: Profile) {
    if (target.id === userId) return;
    Alert.alert(
      "Revoke admin access?",
      `@${target.username} will lose moderation privileges.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await revokeAdmin(target.id);
                await load();
              } catch (e) {
                Alert.alert("Could not revoke admin", getUserFacingMessage(e));
              }
            })();
          },
        },
      ],
    );
  }

  async function handleRemoveReportedPost(reason: string) {
    if (!removeReport || removing) return;
    setRemoving(true);
    try {
      await removePostAsAdmin(removeReport.sighting_id, reason);
      setRemoveReport(null);
      await load();
    } catch (e) {
      Alert.alert("Could not remove post", getUserFacingMessage(e));
    } finally {
      setRemoving(false);
    }
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
            Admin
          </Text>
          <View className="w-10" />
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center font-sans text-sm text-muted-foreground">
            Admin access is required for this screen.
          </Text>
          <Pressable
            onPress={() => void refreshAdmin()}
            className="mt-4 rounded-xl bg-primary px-4 py-2.5 active:opacity-90"
          >
            <Text className="font-sans-medium text-sm text-primary-foreground">Retry</Text>
          </Pressable>
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
          Admin
        </Text>
        <View className="w-10" />
      </View>

      {loading ? (
        <ActivityIndicator className="mt-16" color="#5f9470" />
      ) : (
        <ScrollView contentContainerClassName="px-4 pb-12 pt-4" showsVerticalScrollIndicator={false}>
          <View className="mb-2 flex-row items-center gap-2">
            <ShieldAlert size={16} color="#c8893a" />
            <Text className="font-serif-semibold text-lg text-foreground">Reported posts</Text>
          </View>
          {reports.length === 0 ? (
            <Text className="mb-6 font-sans text-sm text-muted-foreground">No reports yet.</Text>
          ) : (
            reports.map((report) => (
              <View
                key={report.id}
                className="mb-3 rounded-xl border border-border bg-card p-3"
              >
                <Text className="font-sans-medium text-sm text-foreground">
                  {report.sighting?.species ?? "Unknown species"}
                </Text>
                <Text className="mt-1 font-sans text-xs text-muted-foreground">
                  Reported by @{report.reporter?.username ?? "unknown"} ·{" "}
                  {timeAgo(report.created_at)}
                </Text>
                <View className="mt-3 flex-row gap-2">
                  <Pressable
                    onPress={() => router.push(`/post/${report.sighting_id}`)}
                    className="flex-1 items-center rounded-lg border border-border py-2 active:opacity-90"
                  >
                    <Text className="font-sans-medium text-xs text-foreground">View post</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setRemoveReport(report)}
                    className="flex-1 flex-row items-center justify-center gap-1 rounded-lg border border-destructive/30 bg-destructive/10 py-2 active:opacity-90"
                  >
                    <Trash2 size={14} color="#f87171" />
                    <Text className="font-sans-medium text-xs text-foreground">Remove</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}

          <Text className="mb-2 mt-4 font-serif-semibold text-lg text-foreground">
            Manage admins
          </Text>
          <View className="mb-3 flex-row gap-2">
            <TextInput
              value={adminQuery}
              onChangeText={setAdminQuery}
              placeholder="Search by @username or display name"
              placeholderTextColor="#5a6e52"
              autoCapitalize="none"
              className="flex-1 rounded-xl border border-border bg-card px-4 py-3 font-sans text-sm text-foreground"
              onSubmitEditing={() => void handleSearchAdmins(adminQuery)}
            />
            <Pressable
              onPress={() => void handleSearchAdmins(adminQuery)}
              className="items-center justify-center rounded-xl bg-primary px-4 active:opacity-90"
            >
              {searching ? (
                <ActivityIndicator color="#f0ead6" />
              ) : (
                <Text className="font-sans-medium text-sm text-primary-foreground">Find</Text>
              )}
            </Pressable>
          </View>

          {searchResults.map((result) => (
            <Pressable
              key={result.id}
              onPress={() => void handleGrantAdmin(result)}
              className="mb-2 flex-row items-center justify-between rounded-xl border border-border bg-card px-4 py-3 active:opacity-90"
            >
              <View>
                <Text className="font-sans-medium text-sm text-foreground">@{result.username}</Text>
                {result.full_name ? (
                  <DisplayNameText
                    text={result.full_name}
                    className="font-sans text-xs text-muted-foreground"
                  />
                ) : null}
              </View>
              <Text className="font-sans text-xs text-primary">Grant admin</Text>
            </Pressable>
          ))}

          {admins.map((admin) => (
            <View
              key={admin.id}
              className="mb-2 flex-row items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
            >
              <Text className="font-sans-medium text-sm text-foreground">@{admin.username}</Text>
              {admin.id === userId ? (
                <Text className="font-mono text-[10px] text-muted-foreground">You</Text>
              ) : (
                <Pressable onPress={() => void handleRevokeAdmin(admin)}>
                  <Text className="font-sans text-xs text-destructive">Revoke</Text>
                </Pressable>
              )}
            </View>
          ))}

          <Text className="mb-2 mt-6 font-serif-semibold text-lg text-foreground">
            Change username
          </Text>
          <View className="mb-3 flex-row gap-2">
            <TextInput
              value={usernameQuery}
              onChangeText={setUsernameQuery}
              placeholder="Find by @username or display name"
              placeholderTextColor="#5a6e52"
              autoCapitalize="none"
              className="flex-1 rounded-xl border border-border bg-card px-4 py-3 font-sans text-sm text-foreground"
              onSubmitEditing={() => void handleSearchUsersForRename(usernameQuery)}
            />
            <Pressable
              onPress={() => void handleSearchUsersForRename(usernameQuery)}
              className="items-center justify-center rounded-xl bg-primary px-4 active:opacity-90"
            >
              {usernameSearching ? (
                <ActivityIndicator color="#f0ead6" />
              ) : (
                <Text className="font-sans-medium text-sm text-primary-foreground">Find</Text>
              )}
            </Pressable>
          </View>

          {usernameResults.map((result) => (
            <Pressable
              key={`rename-${result.id}`}
              onPress={() => {
                setRenameTarget(result);
                setNewUsername(result.username);
              }}
              className={`mb-2 flex-row items-center justify-between rounded-xl border px-4 py-3 active:opacity-90 ${
                renameTarget?.id === result.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card"
              }`}
            >
              <View>
                <Text className="font-sans-medium text-sm text-foreground">@{result.username}</Text>
                {result.full_name ? (
                  <DisplayNameText
                    text={result.full_name}
                    className="font-sans text-xs text-muted-foreground"
                  />
                ) : null}
              </View>
              <Text className="font-sans text-xs text-muted-foreground">
                {renameTarget?.id === result.id ? "Selected" : "Select"}
              </Text>
            </Pressable>
          ))}

          {renameTarget ? (
            <View className="mb-2 rounded-xl border border-border bg-card p-3">
              <Text className="font-sans text-xs text-muted-foreground">
                Changing @{renameTarget.username}
              </Text>
              <TextInput
                value={newUsername}
                onChangeText={setNewUsername}
                placeholder="new_username"
                placeholderTextColor="#5a6e52"
                autoCapitalize="none"
                autoCorrect={false}
                className="mt-2 rounded-lg border border-border bg-background px-3 py-2.5 font-sans text-sm text-foreground"
              />
              <Pressable
                onPress={() => void handleRenameUsername()}
                disabled={renaming}
                className={`mt-3 items-center rounded-lg py-2.5 ${
                  renaming ? "bg-primary/60" : "bg-primary"
                }`}
              >
                {renaming ? (
                  <ActivityIndicator color="#f0ead6" />
                ) : (
                  <Text className="font-sans-medium text-sm text-primary-foreground">
                    Update username
                  </Text>
                )}
              </Pressable>
            </View>
          ) : null}

          <Text className="mb-2 mt-6 font-serif-semibold text-lg text-foreground">
            Recent moderation log
          </Text>
          {log.length === 0 ? (
            <Text className="font-sans text-sm text-muted-foreground">No actions yet.</Text>
          ) : (
            log.map((entry) => (
              <View key={entry.id} className="mb-2 rounded-xl border border-border bg-card p-3">
                <Text className="font-sans-medium text-sm text-foreground">
                  {entry.action.replaceAll("_", " ")}
                </Text>
                <Text className="mt-1 font-sans text-xs text-muted-foreground">{entry.reason}</Text>
                <Text className="mt-1 font-mono text-[10px] text-muted-foreground/70">
                  @{entry.actor?.username ?? "admin"} · {timeAgo(entry.created_at)}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <ModerationReasonModal
        visible={removeReport != null}
        title="Remove reported post"
        description="The post owner will see this reason."
        confirmLabel="Remove post"
        destructive
        submitting={removing}
        onClose={() => setRemoveReport(null)}
        onConfirm={handleRemoveReportedPost}
      />
    </SafeAreaView>
  );
}
