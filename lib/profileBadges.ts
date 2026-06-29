export interface ProfileBadge {
  label: string;
  desc: string;
  earned: boolean;
}

export function buildProfileBadges(input: {
  sightingsCount: number;
  photoCount: number;
  rareCount: number;
  following: number;
}): ProfileBadge[] {
  return [
    {
      label: "First Flight",
      desc: "Logged your first sighting",
      earned: input.sightingsCount >= 1,
    },
    {
      label: "Shutterbug",
      desc: "Added a photo to a sighting",
      earned: input.photoCount >= 1,
    },
    {
      label: "Rare Find",
      desc: "Spotted a rare bird",
      earned: input.rareCount >= 1,
    },
    {
      label: "Prolific Birder",
      desc: "Logged 10+ sightings",
      earned: input.sightingsCount >= 10,
    },
    {
      label: "Social Flyer",
      desc: "Followed another birder",
      earned: input.following >= 1,
    },
  ];
}
