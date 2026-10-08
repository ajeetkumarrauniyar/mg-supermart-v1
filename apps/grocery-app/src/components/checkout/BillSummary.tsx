import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Bill, FeeRule } from '@mg-mart/types';
import { COLORS, SIZES } from '@/constants';

export interface BillSummaryProps {
  /** The server's bill. Every figure shown here comes from it unchanged. */
  bill: Bill;
}

interface FeeRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** What this bill actually charges: 0 when the waiver applied. */
  charged: number;
  /** The configured fee behind the charge, needed to explain a waiver. */
  rule: FeeRule;
}

/**
 * One fee line. A fee the store does not levy at all is not rendered; a fee
 * that exists but was waived is shown struck through, so the customer can see
 * what the waiver saved them rather than just a missing row.
 */
const FeeRow: React.FC<FeeRowProps> = ({ icon, label, charged, rule }) => {
  if (rule.amount <= 0) return null;

  const waived = charged === 0;

  return (
    <View style={billStyles.row}>
      <View style={billStyles.labelGroup}>
        <Ionicons name={icon} size={18} color={COLORS.textLight} />
        <Text style={billStyles.label}>{label}</Text>
      </View>

      {waived ? (
        <View style={billStyles.labelGroup}>
          <Text style={billStyles.struckValue}>₹{rule.amount}</Text>
          <Text style={billStyles.freeValue}>FREE</Text>
        </View>
      ) : (
        <Text style={billStyles.value}>₹{charged}</Text>
      )}
    </View>
  );
};

/**
 * How many more rupees of cart would waive this fee, or null when a waiver is
 * not configured, not reachable, or already applied.
 */
const amountToWaiver = (rule: FeeRule, charged: number, subtotal: number): number | null => {
  if (rule.amount <= 0 || charged === 0) return null;
  if (rule.waivedAtOrAbove === null) return null;
  const gap = rule.waivedAtOrAbove - subtotal;
  return gap > 0 ? gap : null;
};

export const BillSummary: React.FC<BillSummaryProps> = ({ bill }) => {
  const { deliveryFee, handlingFee } = bill.appliedConfig;
  const toFreeDelivery = amountToWaiver(deliveryFee, bill.deliveryFee, bill.subtotal);

  return (
    <View style={billStyles.container}>
      <Text style={billStyles.heading}>Bill summary</Text>

      <View style={billStyles.row}>
        <View style={billStyles.labelGroup}>
          <Ionicons name="receipt-outline" size={18} color={COLORS.textLight} />
          <Text style={billStyles.label}>Item total</Text>
        </View>
        <Text style={billStyles.value}>₹{bill.subtotal.toFixed(0)}</Text>
      </View>

      <FeeRow
        icon="bicycle-outline"
        label="Delivery fee"
        charged={bill.deliveryFee}
        rule={deliveryFee}
      />

      <FeeRow
        icon="shield-checkmark-outline"
        label="Handling fee"
        charged={bill.handlingFee}
        rule={handlingFee}
      />

      {toFreeDelivery !== null && (
        <View style={billStyles.nudge}>
          <Ionicons name="gift-outline" size={16} color={COLORS.primaryDark} />
          <Text style={billStyles.nudgeText}>
            Add ₹{toFreeDelivery.toFixed(0)} more to get free delivery
          </Text>
        </View>
      )}

      <View style={billStyles.divider} />

      <View style={billStyles.row}>
        <Text style={billStyles.totalLabel}>Grand total</Text>
        <Text style={billStyles.totalValue}>₹{bill.total.toFixed(0)}</Text>
      </View>
    </View>
  );
};

const billStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.backgroundLight,
    marginHorizontal: SIZES.padding,
    marginTop: 8,
    borderRadius: SIZES.borderRadiusLarge,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  heading: {
    fontSize: SIZES.fontSize.large,      // 18px
    fontWeight: SIZES.fontWeight.bold,
    color: COLORS.text,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: SIZES.fontSize.medium,     // 15px
    color: COLORS.textSecondary,
  },
  value: {
    fontSize: SIZES.fontSize.medium,     // 15px
    fontWeight: SIZES.fontWeight.semibold,
    color: COLORS.text,
  },
  struckValue: {
    fontSize: SIZES.fontSize.medium,
    color: COLORS.textLight,
    textDecorationLine: 'line-through',
  },
  freeValue: {
    fontSize: SIZES.fontSize.medium,
    fontWeight: SIZES.fontWeight.bold,
    color: COLORS.primary,
  },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.successLight,
    borderRadius: SIZES.borderRadius,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  nudgeText: {
    flex: 1,
    fontSize: SIZES.fontSize.small,
    fontWeight: SIZES.fontWeight.semibold,
    color: COLORS.primaryDark,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  totalLabel: {
    fontSize: SIZES.fontSize.large,      // 18px
    fontWeight: SIZES.fontWeight.bold,
    color: COLORS.text,
  },
  totalValue: {
    fontSize: SIZES.fontSize.large,      // 18px
    fontWeight: SIZES.fontWeight.bold,
    color: COLORS.text,
  },
});
