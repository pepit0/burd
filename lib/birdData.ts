export type Rarity = "common" | "uncommon" | "rare";

export interface Sighting {
  id: number;
  species: string;
  scientific: string;
  location: string;
  time: string;
  user: string;
  avatarColor: string;
  rarity: Rarity;
  photoId: string;
  count: number;
  notes: string;
  baseLikes: number;
  initiallyLiked: boolean;
}

export interface LogEntry {
  id: number;
  species: string;
  count: number;
  location: string;
  photoId: string;
}

export interface LogGroup {
  date: string;
  entries: LogEntry[];
}

export interface FieldGuideBird {
  id: number;
  species: string;
  scientific: string;
  rarity: Rarity;
  logged: boolean;
  photoId: string;
}

export type ActivityType = "like" | "follow" | "log" | "comment" | "milestone";

export interface ActivityEvent {
  id: number;
  type: ActivityType;
  user: string;
  avatarColor: string;
  time: string;
  detail: string;
  species?: string;
  photoId?: string;
}

export interface Badge {
  label: string;
  desc: string;
  earned: boolean;
}

export function unsplash(photoId: string, w: number, h: number): string {
  return `https://images.unsplash.com/${photoId}?w=${w}&h=${h}&fit=crop&auto=format`;
}

export const PROFILE_COVER =
  "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&h=200&fit=crop&auto=format";

export const SIGHTINGS: Sighting[] = [
  {
    id: 1,
    species: "Cedar Waxwing",
    scientific: "Bombycilla cedrorum",
    location: "Prospect Park",
    time: "43 min ago",
    user: "maya_birder",
    avatarColor: "#5f9470",
    rarity: "uncommon",
    photoId: "photo-1444464666168-49d633b86797",
    count: 12,
    notes:
      "Large flock feeding on serviceberries near the boathouse. Incredible crests.",
    baseLikes: 24,
    initiallyLiked: false,
  },
  {
    id: 2,
    species: "Northern Cardinal",
    scientific: "Cardinalis cardinalis",
    location: "Central Park Ramble",
    time: "2 hr ago",
    user: "jvogel_nyc",
    avatarColor: "#c8693a",
    rarity: "common",
    photoId: "photo-1559827260-dc66d52bef19",
    count: 2,
    notes:
      "Mated pair foraging in the understory. Female unmistakable in warm light.",
    baseLikes: 31,
    initiallyLiked: true,
  },
  {
    id: 3,
    species: "Red-tailed Hawk",
    scientific: "Buteo jamaicensis",
    location: "Hudson River Park",
    time: "5 hr ago",
    user: "raptor_watch",
    avatarColor: "#8a6e3a",
    rarity: "uncommon",
    photoId: "photo-1452570053594-1b985d6ea890",
    count: 1,
    notes:
      "Hunting from a lamp post. Took a pigeon mid-air — an incredible display of precision.",
    baseLikes: 87,
    initiallyLiked: false,
  },
  {
    id: 4,
    species: "American Goldfinch",
    scientific: "Spinus tristis",
    location: "Van Cortlandt Park",
    time: "Yesterday",
    user: "bronx_birder",
    avatarColor: "#c8a03a",
    rarity: "common",
    photoId: "photo-1444464666168-49d633b86797",
    count: 6,
    notes:
      "Brilliant males in full breeding plumage, feeding on thistle near the meadow edge.",
    baseLikes: 19,
    initiallyLiked: false,
  },
];

export const LOG_GROUPS: LogGroup[] = [
  {
    date: "Jun 25",
    entries: [
      { id: 1, species: "American Robin", count: 3, location: "Riverside Park", photoId: "photo-1444464666168-49d633b86797" },
      { id: 2, species: "Cedar Waxwing", count: 12, location: "Inwood Hill Park", photoId: "photo-1559827260-dc66d52bef19" },
    ],
  },
  {
    date: "Jun 24",
    entries: [
      { id: 3, species: "Black-capped Chickadee", count: 7, location: "Fort Tryon Park", photoId: "photo-1452570053594-1b985d6ea890" },
      { id: 4, species: "House Finch", count: 2, location: "Fort Tryon Park", photoId: "photo-1444464666168-49d633b86797" },
    ],
  },
  {
    date: "Jun 22",
    entries: [
      { id: 5, species: "White-throated Sparrow", count: 1, location: "Inwood Hill Park", photoId: "photo-1559827260-dc66d52bef19" },
    ],
  },
  {
    date: "Jun 20",
    entries: [
      { id: 6, species: "Blue Jay", count: 5, location: "Central Park", photoId: "photo-1452570053594-1b985d6ea890" },
      { id: 7, species: "Baltimore Oriole", count: 1, location: "Prospect Park", photoId: "photo-1444464666168-49d633b86797" },
    ],
  },
];

export const FIELD_GUIDE: FieldGuideBird[] = [
  { id: 1, species: "American Robin", scientific: "Turdus migratorius", rarity: "common", logged: true, photoId: "photo-1444464666168-49d633b86797" },
  { id: 2, species: "Northern Cardinal", scientific: "Cardinalis cardinalis", rarity: "common", logged: true, photoId: "photo-1559827260-dc66d52bef19" },
  { id: 3, species: "Red-tailed Hawk", scientific: "Buteo jamaicensis", rarity: "uncommon", logged: true, photoId: "photo-1452570053594-1b985d6ea890" },
  { id: 4, species: "Cedar Waxwing", scientific: "Bombycilla cedrorum", rarity: "uncommon", logged: true, photoId: "photo-1444464666168-49d633b86797" },
  { id: 5, species: "Blue Jay", scientific: "Cyanocitta cristata", rarity: "common", logged: true, photoId: "photo-1559827260-dc66d52bef19" },
  { id: 6, species: "Indigo Bunting", scientific: "Passerina cyanea", rarity: "rare", logged: false, photoId: "photo-1452570053594-1b985d6ea890" },
  { id: 7, species: "Baltimore Oriole", scientific: "Icterus galbula", rarity: "uncommon", logged: true, photoId: "photo-1444464666168-49d633b86797" },
  { id: 8, species: "Painted Bunting", scientific: "Passerina ciris", rarity: "rare", logged: false, photoId: "photo-1559827260-dc66d52bef19" },
  { id: 9, species: "American Goldfinch", scientific: "Spinus tristis", rarity: "common", logged: true, photoId: "photo-1452570053594-1b985d6ea890" },
  { id: 10, species: "Snowy Owl", scientific: "Bubo scandiacus", rarity: "rare", logged: false, photoId: "photo-1444464666168-49d633b86797" },
];

export const ACTIVITY: ActivityEvent[] = [
  { id: 1, type: "like", user: "maya_birder", avatarColor: "#5f9470", time: "2 min ago", detail: "liked your Cedar Waxwing sighting", species: "Cedar Waxwing", photoId: "photo-1444464666168-49d633b86797" },
  { id: 2, type: "follow", user: "raptor_watch", avatarColor: "#8a6e3a", time: "18 min ago", detail: "started following you" },
  { id: 3, type: "log", user: "jvogel_nyc", avatarColor: "#c8693a", time: "34 min ago", detail: "logged a new sighting near you", species: "Scarlet Tanager", photoId: "photo-1559827260-dc66d52bef19" },
  { id: 4, type: "comment", user: "bronx_birder", avatarColor: "#c8a03a", time: "1 hr ago", detail: "commented on your Red-tailed Hawk post", species: "Red-tailed Hawk", photoId: "photo-1452570053594-1b985d6ea890" },
  { id: 5, type: "like", user: "birdlady_bk", avatarColor: "#7c6e9e", time: "2 hr ago", detail: "liked your American Goldfinch sighting", species: "American Goldfinch", photoId: "photo-1444464666168-49d633b86797" },
  { id: 6, type: "milestone", user: "burd_app", avatarColor: "#5f9470", time: "3 hr ago", detail: "You hit a 12-day sighting streak! Keep it up." },
  { id: 7, type: "follow", user: "feather_finder", avatarColor: "#3a7a8a", time: "5 hr ago", detail: "started following you" },
  { id: 8, type: "log", user: "maya_birder", avatarColor: "#5f9470", time: "6 hr ago", detail: "logged a sighting near Prospect Park", species: "Black-crowned Night Heron", photoId: "photo-1452570053594-1b985d6ea890" },
  { id: 9, type: "comment", user: "raptor_watch", avatarColor: "#8a6e3a", time: "Yesterday", detail: "replied to your comment on the hawk thread", species: "Cooper's Hawk", photoId: "photo-1559827260-dc66d52bef19" },
  { id: 10, type: "like", user: "upstate_owls", avatarColor: "#6e7a3a", time: "Yesterday", detail: "liked your Baltimore Oriole sighting", species: "Baltimore Oriole", photoId: "photo-1444464666168-49d633b86797" },
];

export const PROFILE = {
  name: "Elara Moss",
  handle: "elara_moss",
  location: "New York, NY",
  bio: "Chasing warblers and raptors through the five boroughs. eBird reviewer. Binoculars always on hand.",
  stats: [
    { label: "Sightings", value: "183" },
    { label: "Species", value: "47" },
    { label: "Followers", value: "312" },
    { label: "Following", value: "89" },
  ],
};

export const BADGES: Badge[] = [
  { label: "Early Bird", desc: "First sighting logged before 6 am", earned: true },
  { label: "Hawk Spotter", desc: "Logged 5 raptor species", earned: true },
  { label: "Warbler Watcher", desc: "Log 10 warbler species to unlock", earned: false },
  { label: "City Lister", desc: "100 species in one metro area", earned: false },
];

export const JOURNAL_STATS = [
  { label: "Species", value: "47", icon: "feather" as const },
  { label: "Sightings", value: "183", icon: "camera" as const },
  { label: "Day Streak", value: "12", icon: "zap" as const },
];
