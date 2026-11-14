export const DESTINATION_TAGS = [
    "Swimming Pool",
    "Hot Spring",
    "Overnight Stay",
    "Day Tour",
] as const;

export type DestinationTag = (typeof DESTINATION_TAGS)[number];