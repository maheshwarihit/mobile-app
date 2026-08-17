import { View, Image } from "react-native";
import { PROFILE_PHOTO_BUCKET, type Profile } from "@vagewell/shared";
import { Avatar } from "@/components/ui";
import { supabase } from "@/lib/supabase";

/**
 * A client's uploaded photo, falling back to the initials `Avatar` when they
 * haven't set one. The `?v=<updated_at>` cache-buster matches ProfileScreen's:
 * a re-upload lands at a new path, but the browser/native image cache on web
 * keys off the URL, so without it a stale image can survive a change.
 */
export function ProfilePhoto({
  profile,
  size = 40,
}: {
  profile: Pick<Profile, "id" | "full_name" | "avatar_path" | "updated_at">;
  size?: number;
}) {
  if (!profile.avatar_path) {
    return <Avatar name={profile.full_name} id={profile.id} size={size <= 32 ? "sm" : "md"} />;
  }
  const url = `${
    supabase.storage.from(PROFILE_PHOTO_BUCKET).getPublicUrl(profile.avatar_path).data.publicUrl
  }?v=${encodeURIComponent(profile.updated_at)}`;
  return (
    <View style={{ width: size, height: size }} className="overflow-hidden rounded-full bg-gray-100">
      <Image source={{ uri: url }} style={{ width: size, height: size }} resizeMode="cover" />
    </View>
  );
}
