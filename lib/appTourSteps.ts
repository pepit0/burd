export type AppTourRoute =
  | "/(tabs)/"
  | "/(tabs)/journal"
  | "/(tabs)/field-guide"
  | "/(tabs)/profile";

export type AppTourSpotlight =
  | "none"
  | "feed-tabs"
  | "header-mic"
  | "camera-fab"
  | "tab-home"
  | "tab-journal"
  | "tab-guide"
  | "tab-profile"
  | "guide-tabs"
  | "profile-badges"
  | "profile-avatar"
  | "journal-tabs";

export type AppTourPhase = "idle" | "awaiting-tabs" | "welcome" | "tour";

export interface AppTourStep {
  id: string;
  route: AppTourRoute;
  kicker: string;
  title: string;
  body: string;
  spotlight: AppTourSpotlight;
  kind?: "copy" | "photo-id";
  guideTab?: "guide" | "collection";
  copyAlign?: "center" | "bottom";
}

export interface AppTourTargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const APP_TOUR_STEPS: AppTourStep[] = [
  {
    id: "photo-id",
    route: "/(tabs)/",
    kicker: "Identify",
    title: "Live Photo ID",
    body: "Hold your phone up. When a bird is found, take the photo.",
    spotlight: "none",
    kind: "photo-id",
  },
  {
    id: "guide",
    route: "/(tabs)/field-guide",
    kicker: "Navigate",
    title: "Field guide",
    body: "Guide is in the bar below. That’s where your catalog and collection live.",
    spotlight: "tab-guide",
    guideTab: "collection",
  },
  {
    id: "guide-tabs",
    route: "/(tabs)/field-guide",
    kicker: "Collect",
    title: "Guide and Collection",
    body: "Collection is cards from Photo ID. Guide is every species. Explore is nearby, and Pet is your pocket bird.",
    spotlight: "guide-tabs",
    guideTab: "collection",
    copyAlign: "bottom",
  },
  {
    id: "sound-id",
    route: "/(tabs)/",
    kicker: "Identify",
    title: "Live Sound ID",
    body: "The mic listens for songs and calls so you can ID birds by ear.",
    spotlight: "header-mic",
  },
  {
    id: "journal",
    route: "/(tabs)/journal",
    kicker: "Navigate",
    title: "Your journal",
    body: "Journal is in the bar below. Every log you save lives here.",
    spotlight: "tab-journal",
  },
  {
    id: "journal-tabs",
    route: "/(tabs)/journal",
    kicker: "Save",
    title: "Photos, Sounds, Drafts",
    body: "Photos and Sounds are your logs. Drafts are captures waiting to be finished.",
    spotlight: "journal-tabs",
    copyAlign: "bottom",
  },
  {
    id: "home",
    route: "/(tabs)/",
    kicker: "Navigate",
    title: "Home",
    body: "Home is in the bar below. That’s the feed from other birders.",
    spotlight: "tab-home",
  },
  {
    id: "home-tabs",
    route: "/(tabs)/",
    kicker: "Connect",
    title: "For you, Friends, Activity",
    body: "For you is a mix. Friends is people you follow. Activity is likes and comments.",
    spotlight: "feed-tabs",
    copyAlign: "bottom",
  },
  {
    id: "profile",
    route: "/(tabs)/profile",
    kicker: "You",
    title: "Your profile",
    body: "Public posts show here. Earn badges as you bird, and showcase up to three.",
    spotlight: "tab-profile",
  },
];
