import React, { useMemo } from "react";
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  ViewStyle,
  Platform,
  TouchableOpacity,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
} from "react-native-reanimated";
import { useTheme } from "../contexts/ThemeContext";
import canonicalColors from "@shared/constants/colors.json";

// Light Neumorphic Theme Colors
export const lightTheme = {
  colors: {
    background: canonicalColors.background.page,
    cardBackground: canonicalColors.background.surface,
    primary: canonicalColors.brand.primary,
    primaryLight: canonicalColors.brand.tint,
    primaryDark: canonicalColors.brand.primaryHover,
    secondary: canonicalColors.text.secondary,
    success: canonicalColors.semantic.income,
    warning: canonicalColors.semantic.warning,
    danger: canonicalColors.semantic.expense,
    text: canonicalColors.text.primary,
    textSecondary: canonicalColors.text.secondary,
    textTertiary: canonicalColors.text.secondary,
    placeholder: canonicalColors.semantic.border,
    border: canonicalColors.semantic.border,
    divider: canonicalColors.semantic.border,
    inputBackground: canonicalColors.background.surface,
    toggleInactive: canonicalColors.semantic.border,
    // Category colors
    teal: "#5AC8FA",
    purple: "#AF52DE",
    blue: "#007AFF",
    green: "#34C759",
    yellow: "#FFCC00",
    orange: "#FF9500",
    red: "#FF3B30",
    pink: "#FF2D55",
  },
  shadows: {
    card: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    cardPressed: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 1,
    },
    button: {
      shadowColor: canonicalColors.brand.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
};

// Dark Neumorphic Theme Colors
// Not yet wired to any component — DARK_MODE_ENABLED stays false in
// ThemeContext until this palette is reviewed. Values derived from
// colors.json's dark.* set, following the same relationships web's
// .dark CSS block already uses (background->dark.background,
// cardBackground->dark.surface, text->dark.textPrimary, etc).
// income/expense/warning/transfer have no dark variant anywhere in this
// codebase (same as web and ThemeContext.darkColors) — reused as-is.
// Category swatches are decorative and already render fine on dark
// backgrounds — kept identical to light, not derived from anything.
export const darkTheme = {
  colors: {
    background: canonicalColors.dark.background,
    cardBackground: canonicalColors.dark.surface,
    primary: canonicalColors.dark.brand,
    primaryLight: canonicalColors.dark.surfaceHover,
    primaryDark: canonicalColors.dark.brand,
    secondary: canonicalColors.dark.textSecondary,
    success: canonicalColors.semantic.income,
    warning: canonicalColors.semantic.warning,
    danger: canonicalColors.semantic.expense,
    text: canonicalColors.dark.textPrimary,
    textSecondary: canonicalColors.dark.textSecondary,
    textTertiary: canonicalColors.dark.textSecondary,
    placeholder: canonicalColors.dark.border,
    border: canonicalColors.dark.border,
    divider: canonicalColors.dark.border,
    inputBackground: canonicalColors.dark.surface,
    toggleInactive: canonicalColors.dark.border,
    // Category colors — unchanged from light (see note above)
    teal: "#5AC8FA",
    purple: "#AF52DE",
    blue: "#007AFF",
    green: "#34C759",
    yellow: "#FFCC00",
    orange: "#FF9500",
    red: "#FF3B30",
    pink: "#FF2D55",
  },
  shadows: {
    card: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    cardPressed: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 1,
    },
    button: {
      shadowColor: canonicalColors.dark.brand,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
  },
  borderRadius: lightTheme.borderRadius,
};

/** Picks lightTheme or darkTheme based on ThemeContext's darkMode. */
export function useNeumorphicTheme() {
  const { darkMode } = useTheme();
  return darkMode ? darkTheme : lightTheme;
}

// Neumorphic Card Component
interface NeumorphicCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  noPadding?: boolean;
  /** Stagger entry by this many ms (multiples of 80 work well) */
  entryDelay?: number;
}

const SPRING_BACK = { stiffness: 240, damping: 22, mass: 0.5 };
const SPRING_PRESS = { stiffness: 400, damping: 20, mass: 0.4 };

export function NeumorphicCard({
  children,
  style,
  noPadding = false,
  entryDelay = 0,
}: NeumorphicCardProps) {
  const theme = useNeumorphicTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const scale = useSharedValue(1);
  const rotateX = useSharedValue(0);
  const rotateY = useSharedValue(0);
  const cardW = useSharedValue(300);
  const cardH = useSharedValue(120);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { rotateX: `${rotateX.value}deg` },
      { rotateY: `${rotateY.value}deg` },
      { scale: scale.value },
    ],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    cardW.value = e.nativeEvent.layout.width || 300;
    cardH.value = e.nativeEvent.layout.height || 120;
  };

  const onTouchStart = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX;
    const y = e.nativeEvent.locationY;
    // Tilt toward press point (max ±8°)
    rotateX.value = withSpring((y / cardH.value - 0.5) * -8, SPRING_PRESS);
    rotateY.value = withSpring((x / cardW.value - 0.5) * 8, SPRING_PRESS);
    scale.value = withSpring(0.975, SPRING_PRESS);
  };

  const onTouchEnd = () => {
    rotateX.value = withSpring(0, SPRING_BACK);
    rotateY.value = withSpring(0, SPRING_BACK);
    scale.value = withSpring(1, SPRING_BACK);
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(entryDelay).springify().damping(14).stiffness(120)}
      onLayout={onLayout}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      style={[styles.card, !noPadding && styles.cardPadding, theme.shadows.card, style, animStyle]}
    >
      {children}
    </Animated.View>
  );
}

// Segmented Control (Expense/Income/Transfer tabs)
interface SegmentedControlProps {
  options: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function SegmentedControl({ options, selectedIndex, onSelect }: SegmentedControlProps) {
  const theme = useNeumorphicTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.segmentedContainer}>
      <LinearGradient
        colors={[canonicalColors.brand.tint, canonicalColors.background.surface]}
        style={styles.segmentedBackground}
      >
        {options.map((option, index) => (
          <TouchableOpacity
            key={option}
            style={[styles.segmentOption, selectedIndex === index && styles.segmentOptionSelected]}
            onPress={() => onSelect(index)}
            activeOpacity={0.7}
          >
            {selectedIndex === index ? (
              <LinearGradient
                colors={[canonicalColors.brand.primary, canonicalColors.brand.onDark]}
                style={styles.segmentGradient}
              >
                <Text style={styles.segmentTextSelected}>{option}</Text>
              </LinearGradient>
            ) : (
              <Text style={styles.segmentText}>{option}</Text>
            )}
          </TouchableOpacity>
        ))}
      </LinearGradient>
    </View>
  );
}

// List Item Row
interface ListItemRowProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  showArrow?: boolean;
  rightElement?: React.ReactNode;
}

export function ListItemRow({
  icon,
  label,
  value,
  onPress,
  showArrow = true,
  rightElement,
}: ListItemRowProps) {
  const theme = useNeumorphicTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container style={styles.listItemRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.listItemLeft}>
        <View style={styles.listItemIcon}>{icon}</View>
        <Text style={styles.listItemLabel}>{label}</Text>
      </View>
      <View style={styles.listItemRight}>
        {value && <Text style={styles.listItemValue}>{value}</Text>}
        {rightElement}
        {showArrow && onPress && <Text style={styles.listItemArrow}>›</Text>}
      </View>
    </Container>
  );
}

// Toggle Switch
interface ToggleSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function ToggleSwitch({ value, onValueChange }: ToggleSwitchProps) {
  const theme = useNeumorphicTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <TouchableOpacity
      style={[styles.toggleTrack, value && styles.toggleTrackActive]}
      onPress={() => onValueChange(!value)}
      activeOpacity={0.8}
    >
      <View style={[styles.toggleThumb, value && styles.toggleThumbActive]} />
    </TouchableOpacity>
  );
}

// Primary Button
interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
}

export function PrimaryButton({
  title,
  onPress,
  disabled = false,
  variant = "primary",
}: PrimaryButtonProps) {
  const { colors } = useTheme();
  const theme = useNeumorphicTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const getColors = () => {
    if (disabled) return [colors.border, colors.border];
    switch (variant) {
      case "danger":
        return [colors.expense, "#E8352B"];
      case "secondary":
        return [colors.surfaceHover, colors.border];
      default:
        return [colors.primary, colors.primaryHover];
    }
  };

  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8}>
      <LinearGradient
        colors={getColors() as [string, string]}
        style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]}
      >
        <Text
          style={[
            styles.primaryButtonText,
            variant === "secondary" && styles.primaryButtonTextSecondary,
          ]}
        >
          {title}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// Text Link Button
interface TextLinkButtonProps {
  title: string;
  onPress: () => void;
  icon?: React.ReactNode;
}

export function TextLinkButton({ title, onPress, icon }: TextLinkButtonProps) {
  const theme = useNeumorphicTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <TouchableOpacity style={styles.textLinkButton} onPress={onPress} activeOpacity={0.6}>
      {icon}
      <Text style={styles.textLinkButtonText}>{title}</Text>
    </TouchableOpacity>
  );
}

// Section Header
interface SectionHeaderProps {
  title: string;
}

export function SectionHeader({ title }: SectionHeaderProps) {
  const theme = useNeumorphicTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

// Divider
export function Divider() {
  const theme = useNeumorphicTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return <View style={styles.divider} />;
}

// Category Icon Badge
interface CategoryBadgeProps {
  icon: React.ReactNode;
  color: string;
  size?: "sm" | "md" | "lg";
}

export function CategoryBadge({ icon, color, size = "md" }: CategoryBadgeProps) {
  const theme = useNeumorphicTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const sizes = { sm: 32, md: 40, lg: 48 };
  const iconSize = sizes[size];

  return (
    <View
      style={[
        styles.categoryBadge,
        {
          width: iconSize,
          height: iconSize,
          borderRadius: iconSize / 2,
          backgroundColor: color + "20",
        },
      ]}
    >
      {icon}
    </View>
  );
}

const makeStyles = (theme: typeof lightTheme) =>
  StyleSheet.create({
    // Card
    card: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.lg,
      overflow: "hidden",
    },
    cardPadding: {
      padding: 16,
    },

    // Segmented Control
    segmentedContainer: {
      borderRadius: theme.borderRadius.lg,
      overflow: "hidden",
    },
    segmentedBackground: {
      flexDirection: "row",
      padding: 4,
      borderRadius: theme.borderRadius.lg,
    },
    segmentOption: {
      flex: 1,
      borderRadius: theme.borderRadius.md,
      overflow: "hidden",
    },
    segmentOptionSelected: {
      ...theme.shadows.button,
    },
    segmentGradient: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      alignItems: "center",
      borderRadius: theme.borderRadius.md,
    },
    segmentText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.textSecondary,
      textAlign: "center",
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    segmentTextSelected: {
      fontSize: 15,
      fontWeight: "600",
      color: "#FFFFFF",
    },

    // List Item Row
    listItemRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    listItemLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    listItemIcon: {
      width: 24,
      alignItems: "center",
    },
    listItemLabel: {
      fontSize: 16,
      color: theme.colors.text,
    },
    listItemRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    listItemValue: {
      fontSize: 16,
      color: theme.colors.textTertiary,
    },
    listItemArrow: {
      fontSize: 20,
      color: theme.colors.placeholder,
      fontWeight: "300",
    },

    // Toggle Switch
    toggleTrack: {
      width: 51,
      height: 31,
      borderRadius: 15.5,
      backgroundColor: theme.colors.toggleInactive,
      justifyContent: "center",
      padding: 2,
    },
    toggleTrackActive: {
      backgroundColor: theme.colors.primary,
    },
    toggleThumb: {
      width: 27,
      height: 27,
      borderRadius: 13.5,
      backgroundColor: "#FFFFFF",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    toggleThumbActive: {
      alignSelf: "flex-end",
    },

    // Primary Button
    primaryButton: {
      borderRadius: theme.borderRadius.md,
      paddingVertical: 16,
      paddingHorizontal: 24,
      alignItems: "center",
    },
    primaryButtonDisabled: {
      opacity: 0.6,
    },
    primaryButtonText: {
      fontSize: 17,
      fontWeight: "600",
      color: "#FFFFFF",
    },
    primaryButtonTextSecondary: {
      color: theme.colors.text,
    },

    // Text Link Button
    textLinkButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      gap: 6,
    },
    textLinkButtonText: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.colors.primary,
    },

    // Section Header
    sectionHeader: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 8,
      marginLeft: 4,
    },

    // Divider
    divider: {
      height: 1,
      backgroundColor: theme.colors.divider,
      marginLeft: 52,
    },

    // Category Badge
    categoryBadge: {
      justifyContent: "center",
      alignItems: "center",
    },
  });
