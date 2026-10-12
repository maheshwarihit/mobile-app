import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Image, Modal, Pressable, PanResponder, useWindowDimensions } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import { PrimaryButton, OutlineButton, Spinner } from "@/components/ui";
import { useLanguage } from "@/lib/i18n";

const OUTPUT_PX = 1024;
const MAX_ZOOM = 4;

type Props = {
  uri: string | null;
  onCancel: () => void;
  /** Called with the cropped square as base64 JPEG (no data: prefix) and a preview URI. */
  onCropped: (base64: string, previewUri: string) => void;
};

/**
 * Crop step for the web, where the image picker has no built-in editor (on a
 * phone the system crop screen is used instead and this never opens). Shows
 * the photo behind a square frame: drag to move it, − / + to zoom, then
 * "Use this crop" cuts the framed area out to a 1024px JPEG with a canvas.
 */
export function PlateCropModal({ uri, onCancel, onCropped }: Props) {
  const { t } = useLanguage();
  const { width: winW, height: winH } = useWindowDimensions();
  const frame = Math.round(Math.min(winW - 48, winH - 260, 380));

  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [working, setWorking] = useState(false);
  // Where the drag began, so a move is start + finger travel.
  const dragStart = useRef({ x: 0, y: 0 });
  // Latest values for the PanResponder, which is created once.
  const live = useRef({ offset, zoom, natural, frame });
  live.current = { offset, zoom, natural, frame };

  useEffect(() => {
    setNatural(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    if (uri) Image.getSize(uri, (w, h) => setNatural({ w, h }), () => setNatural(null));
  }, [uri]);

  // Scale at zoom 1 makes the photo's shorter side exactly fill the frame.
  const base = natural ? frame / Math.min(natural.w, natural.h) : 1;
  const shown = natural ? { w: natural.w * base * zoom, h: natural.h * base * zoom } : { w: frame, h: frame };

  // Keep the photo covering the whole frame — never drag an edge inside it.
  const clamp = (o: { x: number; y: number }, z: number, n = natural, f = frame) => {
    if (!n) return { x: 0, y: 0 };
    const b = f / Math.min(n.w, n.h);
    const maxX = Math.max(0, (n.w * b * z - f) / 2);
    const maxY = Math.max(0, (n.h * b * z - f) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, o.x)), y: Math.max(-maxY, Math.min(maxY, o.y)) };
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStart.current = live.current.offset;
        },
        onPanResponderMove: (_e, g) => {
          const { zoom: z, natural: n, frame: f } = live.current;
          setOffset(clamp({ x: dragStart.current.x + g.dx, y: dragStart.current.y + g.dy }, z, n, f));
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const changeZoom = (delta: number) => {
    const z = Math.max(1, Math.min(MAX_ZOOM, Math.round((zoom + delta) * 100) / 100));
    setZoom(z);
    setOffset((o) => clamp(o, z));
  };

  const crop = async () => {
    if (!uri || !natural) return;
    setWorking(true);
    try {
      // Web only (see component note), so the DOM is available.
      const doc = (globalThis as unknown as { document: Document }).document;
      const img = new (globalThis as unknown as { Image: new () => HTMLImageElement }).Image();
      img.src = uri;
      await img.decode();
      // The frame, in the photo's own pixels.
      const scale = base * zoom;
      const side = frame / scale;
      const sx = (natural.w - side) / 2 - offset.x / scale;
      const sy = (natural.h - side) / 2 - offset.y / scale;
      const out = Math.min(OUTPUT_PX, Math.round(side));
      const canvas = doc.createElement("canvas");
      canvas.width = out;
      canvas.height = out;
      canvas.getContext("2d")!.drawImage(img, sx, sy, side, side, 0, 0, out, out);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      onCropped(dataUrl.slice(dataUrl.indexOf(",") + 1), dataUrl);
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-black/80 px-6">
        <Text className="mb-1 text-base font-bold text-white">{t("foodPlate.crop.title")}</Text>
        <Text className="mb-4 text-center text-sm text-white/80">{t("foodPlate.crop.hint")}</Text>

        <View
          {...pan.panHandlers}
          style={{ width: frame, height: frame, cursor: "grab" } as object}
          className="overflow-hidden rounded-xl border-2 border-white bg-black"
        >
          {uri && natural ? (
            <Image
              source={{ uri }}
              // Not draggable as an image by the browser — the frame handles the drag.
              {...({ draggable: false } as object)}
              style={{
                position: "absolute",
                width: shown.w,
                height: shown.h,
                left: (frame - shown.w) / 2 + offset.x,
                top: (frame - shown.h) / 2 + offset.y,
              }}
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Spinner />
            </View>
          )}
        </View>

        <View className="mt-4 flex-row items-center gap-4">
          <ZoomButton label={t("foodPlate.crop.zoomOut")} disabled={zoom <= 1} onPress={() => changeZoom(-0.25)}>
            <Minus size={18} color="#fff" />
          </ZoomButton>
          <Text className="w-14 text-center text-sm font-semibold text-white">{Math.round(zoom * 100)}%</Text>
          <ZoomButton label={t("foodPlate.crop.zoomIn")} disabled={zoom >= MAX_ZOOM} onPress={() => changeZoom(0.25)}>
            <Plus size={18} color="#fff" />
          </ZoomButton>
        </View>

        <View style={{ width: frame }} className="mt-5 gap-3">
          <PrimaryButton fullWidth loading={working} disabled={!natural} onPress={crop}>
            {t("foodPlate.crop.use")}
          </PrimaryButton>
          <OutlineButton fullWidth disabled={working} onPress={onCancel}>
            {t("common.cancel")}
          </OutlineButton>
        </View>
      </View>
    </Modal>
  );
}

function ZoomButton({ label, disabled, onPress, children }: { label: string; disabled: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`h-11 w-11 items-center justify-center rounded-full border border-white/60 ${disabled ? "opacity-40" : "active:opacity-70"}`}
    >
      {children}
    </Pressable>
  );
}
