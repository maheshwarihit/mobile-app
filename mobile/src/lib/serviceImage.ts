import type { ImageSourcePropType } from "react-native";

export type ServicePhoto = {
  source: ImageSourcePropType;
  /** Width ÷ height of the picture file. */
  aspect: number;
  /** Where the people's faces are, as a fraction of the picture (0–1 from the
   *  left / top). The card crops around this point, so faces stay in view
   *  whether the card is a tall phone card or a wide, short desktop strip. */
  focus: { x: number; y: number };
};

// One background photo per service, matched by name substring the same way
// `iconForService` is (services are seeded/DB-editable, with no image column).
// A service that matches none of these simply gets the plain white card.
const SERVICE_PHOTOS: { match: string; photo: ServicePhoto }[] = [
  {
    match: "para-medical",
    photo: { source: require("../../assets/services/para-medical.jpg"), aspect: 1600 / 900, focus: { x: 0.4, y: 0.3 } },
  },
  {
    match: "mental",
    photo: { source: require("../../assets/services/mental.jpg"), aspect: 1600 / 892, focus: { x: 0.45, y: 0.36 } },
  },
  {
    match: "nutrition",
    photo: { source: require("../../assets/services/nutrition.jpg"), aspect: 1600 / 893, focus: { x: 0.5, y: 0.3 } },
  },
  {
    match: "physio",
    photo: { source: require("../../assets/services/physio.jpg"), aspect: 1679 / 937, focus: { x: 0.47, y: 0.22 } },
  },
];

export function imageForService(name: string): ServicePhoto | undefined {
  const lower = name.toLowerCase();
  return SERVICE_PHOTOS.find((s) => lower.includes(s.match))?.photo;
}
