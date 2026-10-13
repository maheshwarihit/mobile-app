import type { ImageSourcePropType } from "react-native";

// One background photo per service, matched by name substring the same way
// `iconForService` is (services are seeded/DB-editable, with no image column).
// A service that matches none of these simply gets the plain white card.
const SERVICE_IMAGES: { match: string; image: ImageSourcePropType }[] = [
  { match: "para-medical", image: require("../../assets/services/para-medical.jpg") },
  { match: "mental", image: require("../../assets/services/mental.jpg") },
  { match: "nutrition", image: require("../../assets/services/nutrition.jpg") },
  { match: "physio", image: require("../../assets/services/physio.jpg") },
];

export function imageForService(name: string): ImageSourcePropType | undefined {
  const lower = name.toLowerCase();
  return SERVICE_IMAGES.find((s) => lower.includes(s.match))?.image;
}
