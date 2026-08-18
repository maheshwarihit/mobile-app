import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type ImageSourcePropType,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import {
  HeartHandshake,
  Activity,
  Utensils,
  Users,
  ArrowRight,
  ArrowLeft,
  Check,
  type LucideIcon,
} from "lucide-react-native";
import { BrandLogo } from "@/components/ui";

type Slide = {
  icon: LucideIcon;
  image: ImageSourcePropType;
  // Poster-style stacked all-caps headline (slide 1 only, see 2026-08-11
  // round) — takes over from titleBefore/titleHighlight/titleAfter when set.
  stackedTitle?: string[];
  titleBefore?: string;
  titleHighlight?: string;
  titleAfter?: string;
  description: string;
};

/**
 * 4 slides (image1-4, in filename order) — image5 (the heart-hands photo,
 * "Care Assistant") moved to LandingScreen as its full-bleed backdrop
 * instead of staying a 5th onboarding slide. Covers intro, physio, nutrition,
 * and family — admin isn't named by a slide of its own (unchanged from the
 * prior round's decision); admin functionality itself is untouched
 * (RootNavigator still routes an admin account to its own shell), this is
 * wording/photo selection only.
 */
const SLIDES: Slide[] = [
  {
    icon: HeartHandshake,
    image: require("../../assets/onboarding/image1.png.png"),
    // Reference: a hospital poster's bold stacked headline ("HEALERS.
    // HEROES. HOPE.") + hands-clasped photo + tagline. Rebuilt in VAgeWell's
    // own teal brand with a real care-in-progress photo standing in for that
    // ad's own photo/logo/red scheme, which belongs to a different, real
    // hospital group.
    stackedTitle: ["CARE.", "COMFORT.", "HOME."],
    description: "Healthy choices today, a healthier tomorrow.",
  },
  {
    icon: Activity,
    image: require("../../assets/onboarding/image2.png"),
    titleHighlight: "Physiotherapy",
    titleAfter: " sessions at home",
    description: "Guided exercises and mobility support from a trained professional, right in your living room.",
  },
  {
    icon: Utensils,
    image: require("../../assets/onboarding/image3.png"),
    titleHighlight: "Nutrition & wellness",
    titleAfter: ", tailored to you",
    description: "Personalized meal and wellness plans designed around each person's needs.",
  },
  {
    icon: Users,
    image: require("../../assets/onboarding/image4.png"),
    titleBefore: "Book for the ",
    titleHighlight: "whole family",
    description: "Add parents, kids, or anyone you care for as dependents and manage every visit from one account.",
  },
];

// Longer than the scrollTo({animated:true}) transition it guards (typically
// ~250-300ms) — see the timer note in goTo() below.
const TRANSITION_LOCK_MS = 400;

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  // Locks the buttons for the duration of an in-flight scroll animation — a
  // fast double-tap on "Next" used to fire scrollTo() a second time (and
  // bump `index` again) before the first slide had actually finished
  // sliding into place, letting the two race and land the carousel on
  // "Get Started"/onDone after only one visible transition.
  const [transitioning, setTransitioning] = useState(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLast = index === SLIDES.length - 1;
  const isFirst = index === 0;

  useEffect(
    () => () => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    },
    []
  );

  // No persistence — shows every time the app opens, by design (see
  // RootNavigator). `onDone` just tells RootNavigator to move past
  // onboarding for this app session; it resets on the next cold start.
  const finish = () => {
    onDone();
  };

  /** Scroll to an arbitrary slide — shared by Next, Back and the dots. */
  const goTo = (next: number) => {
    if (transitioning) return;
    if (next < 0 || next > SLIDES.length - 1 || next === index) return;
    setTransitioning(true);
    scrollRef.current?.scrollTo({ x: width * next, animated: true });
    setIndex(next);
    // The lock is released by a timer, not `onScrollEnd` below — on web,
    // react-native-web's ScrollView doesn't reliably fire onMomentumScrollEnd
    // for a *programmatic* scrollTo (only for a real finger drag), which
    // left the buttons permanently disabled after the very first tap when
    // this depended solely on that event.
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    transitionTimer.current = setTimeout(() => setTransitioning(false), TRANSITION_LOCK_MS);
  };

  const goNext = () => (isLast ? finish() : goTo(index + 1));

  // Fires for a manual swipe too, so a real drag still updates the index —
  // also clears the button lock immediately when it does fire (native), so
  // the timer above is purely a fallback, not the primary release path.
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (transitionTimer.current) {
      clearTimeout(transitionTimer.current);
      transitionTimer.current = null;
    }
    setTransitioning(false);
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      {/* True full-bleed: the current slide's photo + scrim sit behind the
          ENTIRE screen (including the logo row and the bottom Skip/dots/Next
          bar), not just behind the scrollable slide content — otherwise the
          logo row rendered on a flat solid-black strip above the photo
          instead of the photo running edge to edge, which is what "full
          bleed" is supposed to mean. Swaps with `index` since only one photo
          shows at a time regardless of which slide the ScrollView is on. */}
      <Image
        key={index}
        source={SLIDES[index].image}
        style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
        resizeMode="cover"
      />
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", "rgba(2,10,13,0.5)", "rgba(2,10,13,0.92)"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        <View className="flex-row items-center gap-2 px-6 pt-2">
          <BrandLogo size={36} transparent />
          <Text className="text-base font-bold text-white">VAgeWell Care</Text>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          className="flex-1"
        >
          {SLIDES.map((s, slideIndex) => (
            <View key={slideIndex} style={{ width }} className="flex-1 justify-end px-8 pb-6">
              <View className="mb-8 h-24 w-24 items-center justify-center rounded-full bg-white/15">
                <s.icon size={40} color="#ffffff" />
              </View>
              {s.stackedTitle ? (
                <View className="mb-1">
                  {s.stackedTitle.map((word, i) => (
                    <Text
                      key={word}
                      className={`text-4xl font-extrabold leading-tight ${
                        i === s.stackedTitle!.length - 1 ? "text-white" : "text-teal-300"
                      }`}
                    >
                      {word}
                    </Text>
                  ))}
                </View>
              ) : (
                <Text className="text-3xl font-bold leading-tight text-white">
                  {s.titleBefore}
                  <Text className="text-teal-300">{s.titleHighlight}</Text>
                  {s.titleAfter}
                </Text>
              )}
              <Text className="mt-3 text-base text-gray-300">{s.description}</Text>
            </View>
          ))}
        </ScrollView>

        {/*
          Matches the reference design's layout: Skip bottom-left, dots
          centered, a small circular Next/Check button bottom-right (Back to
          its left once past slide 1). px-10 (not px-6) and each
          HeroCircleButton's hitSlop/size stay as they were hardened to —
          Android's edge-swipe-back gesture claims a strip along both screen
          edges, and Google's own guidance is to keep interactive controls
          ≥24dp clear of them, so this row gets real clearance even though
          the earlier "buttons are unresponsive" reports turned out to be a
          different bug entirely (DarkHeroBackground's LinearGradient layers
          silently absorbing all touches — see that fix). That root cause is
          now fixed, so it's safe to go back to this compact layout instead
          of the full-width button substituted while it was still suspected.
        */}
        <View className="flex-row items-center justify-between px-10 pb-8 pt-4">
          <Pressable onPress={finish} hitSlop={12} className="active:opacity-70">
            <Text className="text-sm font-semibold text-teal-300">Skip</Text>
          </Pressable>

          <View className="flex-row items-center gap-2">
            {SLIDES.map((s, i) => (
              <Pressable
                key={i}
                onPress={() => goTo(i)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Go to slide ${i + 1}`}
              >
                <View
                  className="h-2 rounded-full"
                  style={{
                    width: i === index ? 20 : 8,
                    backgroundColor: i === index ? "#ffffff" : "rgba(255,255,255,0.3)",
                  }}
                />
              </Pressable>
            ))}
          </View>

          <View className="flex-row items-center gap-2">
            {!isFirst ? (
              <HeroCircleButton icon={ArrowLeft} onPress={() => goTo(index - 1)} disabled={transitioning} />
            ) : null}
            <HeroCircleButton
              icon={isLast ? Check : ArrowRight}
              onPress={goNext}
              disabled={transitioning}
              filled
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

/** Small translucent-circle icon button used for the Back/Next controls on a dark background. */
function HeroCircleButton({
  icon: Icon,
  onPress,
  disabled,
  filled = false,
}: {
  icon: LucideIcon;
  onPress: () => void;
  disabled?: boolean;
  filled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={12}
      className={`h-14 w-14 items-center justify-center rounded-full border ${
        filled ? "border-transparent bg-teal-400" : "border-white/30 bg-white/10"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <Icon size={22} color={filled ? "#04141A" : "#ffffff"} />
    </Pressable>
  );
}
