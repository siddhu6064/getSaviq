/**
 * FloatingIcon — wraps any child in a looping vertical bob animation.
 * Zero deps beyond react-native-reanimated (already in Expo).
 */
import React, { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

interface FloatingIconProps {
  children: React.ReactNode;
  /** Peak vertical travel in px (default 4) */
  amplitude?: number;
  /** Full cycle duration in ms (default 2600) */
  duration?: number;
  /** Startup delay in ms — stagger multiple icons (default 0) */
  delay?: number;
}

export function FloatingIcon({
  children,
  amplitude = 4,
  duration = 2600,
  delay = 0,
}: FloatingIconProps) {
  const y = useSharedValue(0);

  useEffect(() => {
    const t = setTimeout(() => {
      y.value = withRepeat(
        withSequence(
          withTiming(-amplitude, {
            duration: duration / 2,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0, {
            duration: duration / 2,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1, // infinite
        false,
      );
    }, delay);
    return () => clearTimeout(t);
  }, [amplitude, duration, delay]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
