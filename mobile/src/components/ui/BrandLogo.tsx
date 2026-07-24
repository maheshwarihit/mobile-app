import { View, Image } from "react-native";
import logo from "../../../assets/logo.png";

// The supplied logo.png is fully opaque with a baked-in white background, so it
// sits in a white rounded chip — on the cream `authbg` the white reads as a
// deliberate badge instead of a stray rectangle. Same shadow token as Card.
const chipShadow = {
  elevation: 1,
  shadowColor: "#000",
  shadowOpacity: 0.06,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 1 },
};

/** VAgeWell brand mark. `size` is the chip's outer edge in px. */
export function BrandLogo({ size = 64 }: { size?: number }) {
  const inner = Math.round(size * 0.82);
  return (
    <View
      style={[chipShadow, { width: size, height: size }]}
      className="items-center justify-center rounded-2xl bg-white"
    >
      <Image source={logo} style={{ width: inner, height: inner }} resizeMode="contain" />
    </View>
  );
}
