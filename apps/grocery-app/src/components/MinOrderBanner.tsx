import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SIZES } from "../constants";

interface MinOrderBannerProps {
  /** Bill total of the lines that count toward the minimum. */
  eligibleAmount: number;
  /** The minimum in force for this bill, as configured on the server. */
  minOrderValue: number;
  /** Eligible rupees still needed; 0 once the minimum is met. */
  shortfall: number;
}

/**
 * Shows progress toward the minimum order value.
 *
 * Which lines count toward the minimum is the server's decision — exempt items
 * are already excluded from eligibleAmount — so this only renders the figures.
 *
 * States:
 *   Below minimum → amber progress bar with "Add ₹X more to place order"
 *   At minimum     → green bar, "You're ready to order!"
 *   Above minimum  → green bar (compact, collapsible)
 *
 */
export const MinOrderBanner: React.FC<MinOrderBannerProps> = ({
  eligibleAmount,
  minOrderValue,
  shortfall,
}) => {
  const isMet = shortfall === 0;
  const progress = minOrderValue > 0 ? Math.min(1, eligibleAmount / minOrderValue) : 1;

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 400,
      useNativeDriver: false, // animating width — must be false
    }).start();
  }, [progress, progressAnim]);

  const barWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={[styles.container, isMet && styles.containerMet]}>
      {/* Icon + message row */}
      <View style={styles.row}>
        <Ionicons
          name={isMet ? "checkmark-circle" : "cart-outline"}
          size={20}
          color={isMet ? COLORS.primary : COLORS.warning}
        />
        <Text style={[styles.message, isMet && styles.messageMet]}>
          {isMet
            ? "Ready to order! ✓"
            : `Add ₹${shortfall.toFixed(0)} more to place order`}
        </Text>
        <Text style={styles.fraction}>
          ₹{eligibleAmount.toFixed(0)}&nbsp;/&nbsp;₹{minOrderValue}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.track}>
        <Animated.View
          style={[styles.fill, { width: barWidth }, isMet && styles.fillMet]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.warningLight,
    paddingHorizontal: SIZES.padding,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.warning,
    gap: 8,
  },
  containerMet: {
    backgroundColor: COLORS.successLight,
    borderBottomColor: COLORS.success,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  message: {
    flex: 1,
    fontSize: SIZES.fontSize.small,
    fontWeight: SIZES.fontWeight.semibold,
    color: COLORS.textSecondary,
  },
  messageMet: {
    color: COLORS.primaryDark,
  },

  fraction: {
    fontSize: SIZES.fontSize.tiny,
    fontWeight: SIZES.fontWeight.medium,
    color: COLORS.textSecondary,
  },

  // Progress track
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.warningLight,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: COLORS.warning,
  },
  fillMet: {
    backgroundColor: COLORS.primary,
  },
});

export default MinOrderBanner;
