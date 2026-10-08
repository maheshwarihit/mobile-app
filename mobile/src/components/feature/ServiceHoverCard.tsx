import { createContext, useContext, useRef, useState } from "react";
import { View, Text, Pressable, Platform, type ViewProps } from "react-native";
import { useLanguage } from "@/lib/i18n";
import type { ServiceIconComponent } from "@/lib/serviceIcon";
import { BRAND } from "@/theme";

const shadow = { elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } };
const popShadow = { elevation: 4, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } };

// The website always uses hover popovers; the installed app (no mouse) lists
// the features in each card. Guessing from touch vs mouse on the web kept
// flipping in a browser's phone view, where mouse clicks arrive as touches.
const isWeb = Platform.OS === "web" && typeof window !== "undefined";
function useCanHover() {
  return isWeb;
}

/**
 * Which card is hovered, for lists. react-native-web gives every View its own
 * stacking context, so a popover can only sit above the next card if the
 * hovered card's list cell is raised — see ServiceCellRenderer.
 */
export const HoveredServiceContext = createContext<{ hoveredKey: string | null; setHoveredKey: (k: string | null) => void }>({
  hoveredKey: null,
  setHoveredKey: () => {},
});

/** FlatList CellRendererComponent that lifts the hovered card's cell above its neighbours. */
export function ServiceCellRenderer({ cellKey, style, ...rest }: ViewProps & { cellKey: string; index: number }) {
  const { hoveredKey } = useContext(HoveredServiceContext);
  return <View {...rest} style={[style, { zIndex: hoveredKey === cellKey ? 10 : 0 }]} />;
}

type Props = {
  /** Display name (translated). */
  name: string;
  /** "summary\n• feature\n• feature…" (translated). */
  description: string;
  icon: ServiceIconComponent;
  onPress: () => void;
  /** Identifies this card to HoveredServiceContext (the list's item key). */
  hoverKey?: string;
};

/**
 * Service card: icon, name and summary. On the website the feature list shows
 * in a popover below the card while the mouse rests on it, or while the card
 * is pressed and held (for touch, and for a browser's phone view where the
 * mouse acts as a finger and never hovers); a quick tap books. In the
 * installed app the features are listed in the card itself.
 */
export function ServiceHoverCard({ name, description, icon: Icon, onPress, hoverKey }: Props) {
  const { t } = useLanguage();
  const { setHoveredKey } = useContext(HoveredServiceContext);
  const [hovered, setHovered] = useState(false);
  const [held, setHeld] = useState(false);
  // Read on release; a ref, since the release can arrive before a re-render.
  const heldRef = useRef(false);
  const canHover = useCanHover();
  const open = hovered || held;

  const [summary, ...lines] = description.split("\n").filter((l) => l.trim().length > 0);
  const features = lines.map((l) => l.replace(/^[•\s]+/, "").trim()).filter(Boolean);

  const setHover = (on: boolean) => {
    setHovered(on);
    if (hoverKey) setHoveredKey(on ? hoverKey : null);
  };
  const setHold = (on: boolean) => {
    heldRef.current = on;
    setHeld(on);
    if (hoverKey) setHoveredKey(on ? hoverKey : null);
  };
  // Press-and-hold shows the popover; letting go hides it. A long press never
  // also counts as a tap, so holding doesn't book.
  const holdProps = canHover
    ? {
        delayLongPress: 350,
        onLongPress: () => setHold(true),
        onPressOut: () => {
          if (heldRef.current) setHold(false);
        },
      }
    : {};
  // Touch "hovers" (a finger landing) never open the popover, even on a
  // hover-capable device with a touchscreen.
  const hoverProps = isWeb
    ? {
        onPointerEnter: (e: { nativeEvent: { pointerType?: string } }) => {
          if (e.nativeEvent.pointerType !== "touch") setHover(true);
        },
        onPointerLeave: () => setHover(false),
      }
    : {};

  return (
    <View {...hoverProps} style={{ zIndex: open ? 10 : 0 }}>
      <Pressable
        onPress={onPress}
        {...holdProps}
        style={shadow}
        className={`rounded-xl border bg-white p-4 active:opacity-80 ${open ? "border-purple-300" : "border-gray-100"}`}
      >
        <View className="flex-row items-start gap-3">
          <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
            <Icon size={18} color={BRAND} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900">{name}</Text>
            {summary ? <Text className="mt-0.5 text-sm text-gray-500">{summary}</Text> : null}
            {!canHover && features.length ? (
              <View className="mt-1.5 gap-0.5">
                {features.map((f) => (
                  <Text key={f} className="text-xs text-gray-500">
                    • {f}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>

      {canHover && open && features.length ? (
        <View
          pointerEvents="none"
          style={[popShadow, { position: "absolute", top: "100%", marginTop: -6, left: 12, right: 12 }]}
          className="gap-1 rounded-xl border border-gray-200 bg-white p-3"
        >
          <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: BRAND }}>
            {t("services.card.includes", { name })}
          </Text>
          {features.map((f) => (
            <Text key={f} className="text-sm text-gray-700">
              • {f}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
