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
import { SearchBar } from "@/components/SearchBar";
import {
  DismissKeyboardArea,
  dismissKeyboardOnScrollDrag,
  keyboardAwareScrollProps,
} from "@/components/DismissKeyboard";
import { DisplayNameWithBadges } from "@/components/DisplayNameWithBadges";
import { UserBadgeAdminPanel } from "@/components/UserBadgeAdminPanel";
import { UserModerationSheet } from "@/components/UserModerationSheet";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { getUserFacingMessage } from "@/lib/errors";
import {
  dismissReport,
  getPendingCommentReports,
  getPendingReports,
  getPendingUserReports,
  getRecentModerationLog,
  getAutoBetaBadgeEnabled,
  setAutoBetaBadgeEnabled,
  adminUpdateUsername,
  grantAdmin,
  listAdmins,
  removePostAsAdmin,
  resolveReport,
  revokeAdmin,
} from "@/lib/moderation";
import { searchUsers, searchUsersForAdmin, type UserListItem } from "@/lib/social";
import { getMyProfile } from "@/lib/sightings";
import { normalizeUsername, validateUsername } from "@/lib/signup";
import { timeAgo } from "@/lib/time";
import type { CommentReport, ModerationAction, PostReport, Profile, UserReport } from "@/types";

export default function AdminHubScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { isAdmin, loading: adminLoading, refresh: refreshAdmin } = useAdmin(userId);

  const [reports, setReports] = useState<PostReport[]>([]);
  const [userReports, setUserReports] = useState<UserReport[]>([]);
  const [commentReports, setCommentReports] = useState<CommentReport[]>([]);
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
  const [autoBetaEnabled, setAutoBetaEnabled] = useState(true);
  const [autoBetaSaving, setAutoBetaSaving] = useState(false);
  const [moderateProfile, setModerateProfile] = useState<Profile | null>(null);
  const [moderateReportId, setModerateReportId] = useState<string | null>(null);
  const [moderateLoading, setModerateLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [reportRows, userReportRows, commentReportRows, logRows, adminRows, autoBeta] =
        await Promise.all([
        getPendingReports(),
        getPendingUserReports(),
        getPendingCommentReports(),
        getRecentModerationLog(),
        listAdmins(),
        getAutoBetaBadgeEnabled(),
      ]);
      setReports(reportRows);
      setUserReports(userReportRows);
      setCommentReports(commentReportRows);
      setLog(logRows);
      setAdmins(adminRows);
      setAutoBetaEnabled(autoBeta);
    } catch (e) {
      Alert.alert("Could not load admin data", getUserFacingMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  async function handleToggleAutoBeta() {
    if (autoBetaSaving) return;
    setAutoBetaSaving(true);
    try {
      const next = !autoBetaEnabled;
      await setAutoBetaBadgeEnabled(next);
      setAutoBetaEnabled(next);
      void load();
    } catch (e) {
      Alert.alert("Could not update beta setting", getUserFacingMessage(e));
    } finally {
      setAutoBetaSaving(false);
    }
  }

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
      await resolveReport("post", removeReport.id);
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
        <ScrollView
          contentContainerClassName="px-4 pb-12 pt-4"
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={dismissKeyboardOnScrollDrag}
          {...keyboardAwareScrollProps}
        >
          <DismissKeyboardArea>
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
                  {report.reason ? ` · ${report.reason}` : ""}
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

          <View className="mb-2 mt-6 flex-row items-center gap-2">
            <ShieldAlert size={16} color="#c8893a" />
            <Text className="font-serif-semibold text-lg text-foreground">Reported users</Text>
          </View>
          {userReports.length === 0 ? (
            <Text className="mb-6 font-sans text-sm text-muted-foreground">
              No user reports yet.
            </Text>
          ) : (
            userReports.map((report) => (
              <View
                key={report.id}
                className="mb-3 rounded-xl border border-border bg-card p-3"
              >
                <Text className="font-sans-medium text-sm text-foreground">
                  @{report.reported_user?.username ?? "unknown"}
                </Text>
                <Text className="mt-1 font-sans text-xs text-muted-foreground">
                  Reported by @{report.reporter?.username ?? "unknown"} ·{" "}
                  {report.source === "block" ? "block" : "report"} ·{" "}
                  {timeAgo(report.created_at)}
                </Text>
                {report.reason ? (
                  <Text className="mt-1 font-sans text-xs text-foreground/75">
                    {report.reason}
                  </Text>
                ) : null}
                <View className="mt-3 flex-row flex-wrap gap-2">
                  <Pressable
                    onPress={() =>
                      router.push(`/user/${report.reported_user_id}`)
                    }
                    className="min-w-[30%] flex-1 items-center rounded-lg border border-border py-2 active:opacity-90"
                  >
                    <Text className="font-sans-medium text-xs text-foreground">View profile</Text>
                  </Pressable>
                  <Pressable
                    disabled={moderateLoading}
                    onPress={() => {
                      void (async () => {
                        setModerateLoading(true);
                        try {
                          const profile = await getMyProfile(report.reported_user_id);
                          if (!profile) {
                            Alert.alert("User not found", "Could not load this profile.");
                            return;
                          }
                          setModerateReportId(report.id);
                          setModerateProfile(profile);
                        } catch (e) {
                          Alert.alert("Could not load user", getUserFacingMessage(e));
                        } finally {
                          setModerateLoading(false);
                        }
                      })();
                    }}
                    className="min-w-[30%] flex-1 items-center rounded-lg border border-destructive/40 bg-destructive/10 py-2 active:opacity-90"
                  >
                    <Text className="font-sans-medium text-xs text-destructive">Moderate</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      void (async () => {
                        try {
                          await dismissReport("user", report.id);
                          await load();
                        } catch (e) {
                          Alert.alert("Could not dismiss report", getUserFacingMessage(e));
                        }
                      })();
                    }}
                    className="min-w-[30%] flex-1 items-center rounded-lg border border-border py-2 active:opacity-90"
                  >
                    <Text className="font-sans-medium text-xs text-foreground">Dismiss</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}

          <View className="mb-2 mt-6 flex-row items-center gap-2">
            <ShieldAlert size={16} color="#c8893a" />
            <Text className="font-serif-semibold text-lg text-foreground">Reported comments</Text>
          </View>
          {commentReports.length === 0 ? (
            <Text className="mb-6 font-sans text-sm text-muted-foreground">
              No comment reports yet.
            </Text>
          ) : (
            commentReports.map((report) => {
              const snippet =
                report.comment?.body?.trim().slice(0, 120) ?? "Comment unavailable";
              return (
                <View
                  key={report.id}
                  className="mb-3 rounded-xl border border-border bg-card p-3"
                >
                  <Text className="font-sans-medium text-sm text-foreground" numberOfLines={3}>
                    {snippet}
                    {(report.comment?.body?.length ?? 0) > 120 ? "…" : ""}
                  </Text>
                  <Text className="mt-1 font-sans text-xs text-muted-foreground">
                    Reported by @{report.reporter?.username ?? "unknown"} ·{" "}
                    {timeAgo(report.created_at)}
                    {report.reason ? ` · ${report.reason}` : ""}
                  </Text>
                  <View className="mt-3 flex-row flex-wrap gap-2">
                    {report.comment?.sighting_id ? (
                      <Pressable
                        onPress={() => router.push(`/post/${report.comment!.sighting_id}`)}
                        className="min-w-[30%] flex-1 items-center rounded-lg border border-border py-2 active:opacity-90"
                      >
                        <Text className="font-sans-medium text-xs text-foreground">View post</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => {
                        void (async () => {
                          try {
                            await resolveReport("comment", report.id);
                            await load();
                          } catch (e) {
                            Alert.alert("Could not resolve report", getUserFacingMessage(e));
                          }
                        })();
                      }}
                      className="min-w-[30%] flex-1 items-center rounded-lg border border-destructive/40 bg-destructive/10 py-2 active:opacity-90"
                    >
                      <Text className="font-sans-medium text-xs text-destructive">Resolve</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        void (async () => {
                          try {
                            await dismissReport("comment", report.id);
                            await load();
                          } catch (e) {
                            Alert.alert("Could not dismiss report", getUserFacingMessage(e));
                          }
                        })();
                      }}
                      className="min-w-[30%] flex-1 items-center rounded-lg border border-border py-2 active:opacity-90"
                    >
                      <Text className="font-sans-medium text-xs text-foreground">Dismiss</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}

          <Text className="mb-2 mt-4 font-serif-semibold text-lg text-foreground">
            Profile badges
          </Text>
          <Pressable
            onPress={() => void handleToggleAutoBeta()}
            disabled={autoBetaSaving}
            className={`mb-4 flex-row items-center justify-between rounded-xl border px-4 py-3 active:opacity-90 ${
              autoBetaEnabled ? "border-primary/40 bg-primary/10" : "border-border bg-card"
            }`}
          >
            <View className="min-w-0 flex-1 pr-3">
              <Text className="font-sans-medium text-sm text-foreground">
                Auto beta badge for new signups
              </Text>
              <Text className="mt-0.5 font-sans text-xs text-muted-foreground">
                When on, new accounts get the beta badge automatically.
              </Text>
            </View>
            {autoBetaSaving ? (
              <ActivityIndicator color="#5f9470" size="small" />
            ) : (
              <Text className="font-sans-medium text-xs text-primary">
                {autoBetaEnabled ? "On" : "Off"}
              </Text>
            )}
          </Pressable>

          <Text className="mb-2 font-serif-semibold text-lg text-foreground">
            Manage admins
          </Text>
          <View className="mb-3 flex-row gap-2">
            <SearchBar
              value={adminQuery}
              onChangeText={setAdminQuery}
              placeholder="Search by @username or display name"
              placeholderTextColor="#5a6e52"
              autoCapitalize="none"
              showSearchIcon={false}
              containerClassName="flex-1 px-4 py-3"
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
                  <DisplayNameWithBadges
                    text={result.full_name}
                    isVerified={result.is_verified}
                    isBeta={result.is_beta}
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
            <SearchBar
              value={usernameQuery}
              onChangeText={setUsernameQuery}
              placeholder="Find by @username or display name"
              placeholderTextColor="#5a6e52"
              autoCapitalize="none"
              showSearchIcon={false}
              containerClassName="flex-1 px-4 py-3"
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
                  <DisplayNameWithBadges
                    text={result.full_name}
                    isVerified={result.is_verified}
                    isBeta={result.is_beta}
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
              <View className="mt-4 border-t border-border/60 pt-4">
                <UserBadgeAdminPanel
                  profile={{
                    id: renameTarget.id,
                    username: renameTarget.username,
                    is_verified: renameTarget.is_verified,
                    is_beta: renameTarget.is_beta,
                  }}
                  onUpdated={() => {
                    void (async () => {
                      const refreshed = await getMyProfile(renameTarget.id);
                      if (refreshed) {
                        setRenameTarget({
                          ...renameTarget,
                          is_verified: refreshed.is_verified,
                          is_beta: refreshed.is_beta,
                        });
                      }
                      void load();
                    })();
                  }}
                />
              </View>
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
          </DismissKeyboardArea>
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

      <UserModerationSheet
        visible={moderateProfile != null}
        profile={moderateProfile}
        onClose={() => {
          setModerateProfile(null);
          setModerateReportId(null);
        }}
        onUpdated={() => {
          void (async () => {
            if (moderateReportId) {
              try {
                await resolveReport("user", moderateReportId);
              } catch {
                // Moderation succeeded; report resolve is best-effort.
              }
            }
            setModerateProfile(null);
            setModerateReportId(null);
            await load();
          })();
        }}
      />
    </SafeAreaView>
  );
}
