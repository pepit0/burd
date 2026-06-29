export type Rarity = "common" | "uncommon" | "rare";

export type DetectedBy = "manual" | "image" | "audio" | "both";

export type ActivityType = "like" | "follow" | "comment" | "milestone" | "log" | "moderation";

export type UserRole = "user" | "admin";

export type ModerationActionType =
  | "remove_post"
  | "edit_post"
  | "suspend_user"
  | "unsuspend_user"
  | "grant_admin"
  | "revoke_admin"
  | "remove_field_guide_author";

export interface Prediction {
  species: string;
  scientific_name: string | null;
  confidence: number; // 0..1
}

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_color: string;
  avatar_url: string | null;
  bio: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  search_radius_km: number;
  created_at: string;
  role?: UserRole;
  suspended?: boolean;
  suspended_until?: string | null;
  suspension_reason?: string | null;
  suspended_at?: string | null;
  suspended_by?: string | null;
}

export interface Sighting {
  id: string;
  user_id: string;
  species: string;
  scientific_name: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  rarity: Rarity;
  count: number;
  notes: string | null;
  photo_url: string | null;
  created_at: string;
  observed_at: string | null;
  location_city: string | null;
  location_address: string | null;
  confidence: number | null;
  detected_by: DetectedBy;
  removed_at?: string | null;
  removal_reason?: string | null;
  removed_by?: string | null;
  author_disqualified?: boolean;
  author_disqualified_at?: string | null;
  author_disqualified_by?: string | null;
  author_disqualification_reason?: string | null;
  audio_url?: string | null;
  audio_predictions?: Prediction[] | null;
  /** Set when shared to profile / feed; null = journal-only. */
  published_at?: string | null;
}

export interface SoundLibraryEntry {
  id: string;
  user_id: string;
  audio_url: string;
  duration_ms: number;
  recorded_at: string;
  predictions: Prediction[];
  label: string | null;
  sighting_id: string | null;
  created_at: string;
}

/** A row from the `sighting_feed` view: sighting joined with author + like count. */
export interface FeedSighting extends Sighting {
  username: string;
  avatar_color: string;
  full_name: string | null;
  like_count: number;
}

export interface Comment {
  id: string;
  user_id: string;
  username: string;
  avatar_color: string;
  avatar_url: string | null;
  body: string;
  created_at: string;
  like_count: number;
  liked: boolean;
  replies?: Comment[];
}

export interface ActivityItem {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: ActivityType;
  sighting_id: string | null;
  comment_id: string | null;
  detail: string | null;
  created_at: string;
  read_at: string | null;
  actor: { username: string; avatar_color: string } | null;
  sighting: { species: string; photo_url: string | null } | null;
}

export interface NewSightingInput {
  species: string;
  scientific_name?: string | null;
  location_name?: string | null;
  location_city?: string | null;
  location_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  observed_at?: string | null;
  rarity: Rarity;
  count: number;
  notes?: string | null;
  photo_url?: string | null;
  confidence?: number | null;
  detected_by?: DetectedBy;
  audio_url?: string | null;
  audio_predictions?: Prediction[] | null;
  sound_library_id?: string | null;
  /** When true, sighting appears on profile and in the public feed. */
  publish?: boolean;
}

export interface AccountStatus {
  role: UserRole;
  suspended: boolean;
  suspendedUntil: string | null;
  suspensionReason: string | null;
  isSuspended: boolean;
}

export interface ModerationAction {
  id: string;
  actor_id: string;
  action: ModerationActionType;
  target_user_id: string | null;
  target_sighting_id: string | null;
  reason: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor?: { username: string } | null;
  target_user?: { username: string } | null;
}

export interface PostReport {
  id: string;
  reporter_id: string;
  sighting_id: string;
  created_at: string;
  reporter?: { username: string } | null;
  sighting?: {
    species: string;
    photo_url: string | null;
    user_id: string;
    username: string;
  } | null;
}

export interface AdminPostEditInput {
  species: string;
  scientific_name?: string | null;
  location_name?: string | null;
  location_city?: string | null;
  location_address?: string | null;
  rarity: Rarity;
  count: number;
  notes?: string | null;
}
