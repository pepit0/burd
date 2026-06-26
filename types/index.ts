export type Rarity = "common" | "uncommon" | "rare";

export type DetectedBy = "manual" | "image" | "audio" | "both";

export type ActivityType = "like" | "follow" | "comment" | "milestone" | "log";

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
  replies?: Comment[];
}

export interface ActivityItem {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: ActivityType;
  sighting_id: string | null;
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
}
