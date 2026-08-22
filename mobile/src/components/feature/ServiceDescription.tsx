import { View, Text } from "react-native";

/**
 * Renders a service's description text (summary line + "• " feature bullets,
 * `\n`-joined — see SEED_SERVICES / migration 0030) as a proper block: the
 * summary as a plain line, each bullet as its own row underneath. Shared
 * between HomeScreen's pre-login teaser and ServicesScreen's live list so the
 * two can't drift in how they split/style the same content shape.
 */
export function ServiceDescription({ text }: { text: string }) {
  const [summary, ...bullets] = text.split("\n").filter((line) => line.trim().length > 0);
  if (!summary) return null;
  return (
    <>
      <Text className="mt-0.5 text-sm text-gray-500">{summary}</Text>
      {bullets.length > 0 ? (
        <View className="mt-1.5 gap-0.5">
          {bullets.map((bullet) => (
            <Text key={bullet} className="text-xs text-gray-500">
              {bullet}
            </Text>
          ))}
        </View>
      ) : null}
    </>
  );
}
