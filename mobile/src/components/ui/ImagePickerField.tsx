import { View, Text, Pressable, Image } from "react-native";
import { Upload, X } from "lucide-react-native";
import { pickImageAsset, type PickedImage } from "@/lib/upload";

export type { PickedImage };

type Props = {
  label?: string;
  value: PickedImage | null;
  onChange: (img: PickedImage | null) => void;
  onError?: (message: string) => void;
};

/** expo-image-picker replacement for the web drag-and-drop FileUpload. */
export function ImagePickerField({ label, value, onChange, onError }: Props) {
  const pick = async () => {
    try {
      const img = await pickImageAsset();
      if (img) onChange(img);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Could not open the image picker.");
    }
  };

  return (
    <View>
      {label ? <Text className="mb-1.5 text-sm font-medium text-gray-700">{label}</Text> : null}
      {value ? (
        <View className="relative w-40">
          <Image source={{ uri: value.uri }} className="h-40 w-40 rounded-lg border border-gray-200" resizeMode="cover" />
          <Pressable
            onPress={() => onChange(null)}
            className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-white shadow"
            hitSlop={8}
          >
            <X size={14} color="#4b5563" />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={pick}
          className="items-center rounded-xl border-2 border-dashed border-gray-300 bg-white px-6 py-8 active:border-purple-400"
        >
          <Upload size={24} color="#9ca3af" />
          <Text className="mt-2 text-sm font-medium text-gray-600">Tap to upload your payment screenshot</Text>
          <Text className="mt-1 text-xs text-gray-400">PNG, JPG or WEBP · max 5 MB</Text>
        </Pressable>
      )}
    </View>
  );
}
