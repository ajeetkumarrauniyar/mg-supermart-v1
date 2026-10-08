import React, { memo, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants';
import { useCartStore } from '../stores';
import { useRequireAuth } from '../hooks';
import { addToCartFeedback } from '../utils/haptics';

interface CartQuantityStepperProps {
    productId: string;
    /** The server's verdict that this product may be ordered. */
    isOrderable: boolean;
    compact?: boolean;
}

/**
 * Blinkit-style quantity stepper for product cards.
 * - If item is NOT in cart → shows "ADD" button
 * - If item IS in cart → shows [ - qty + ] stepper
 * - Quantity = 0 → reverts to "ADD" button
 */
export const CartQuantityStepper: React.FC<CartQuantityStepperProps> = memo(({
    productId,
    isOrderable,
    compact = false,
}) => {
    const { items, addItem, updateItem, removeItem } = useCartStore();
    const { requireAuth } = useRequireAuth();

    const cartItem = items.find(item => item.productId === productId);
    const quantity = cartItem?.quantity || 0;

    // Animation values
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const widthAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(quantity > 0 ? 1 : 0)).current;

    // Animate when quantity changes from 0 to 1 (Add → Stepper)
    useEffect(() => {
        if (quantity === 1 && cartItem) {
            // Bounce scale on first add
            Animated.sequence([
                Animated.timing(scaleAnim, {
                    toValue: 0.95,
                    duration: 100,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                }),
            ]).start();

            // Expand stepper into view
            Animated.parallel([
                Animated.timing(widthAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: false, // Width cannot use native driver
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: false, // Must match widthAnim driver
                }),
            ]).start();
        } else if (quantity === 0) {
            // Collapse stepper back to ADD button
            Animated.parallel([
                Animated.timing(widthAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: false, // Width cannot use native driver
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: false, // Must match widthAnim driver
                }),
            ]).start();
        }
    }, [quantity, cartItem]);

    const handleAdd = useCallback(() => {
        if (!isOrderable) return;
        requireAuth(() => {
            addToCartFeedback();
            addItem(productId, 1);
        });
    }, [productId, isOrderable, addItem, requireAuth]);

    // No client-side ceiling: the catalogue's stock figures are not reliable,
    // so any limit here would be invented. The quote blocks a line the shop
    // cannot actually supply.
    const handleIncrease = useCallback(() => {
        addToCartFeedback();
        updateItem(productId, quantity + 1);
    }, [productId, quantity, updateItem]);

    const handleDecrease = useCallback(() => {
        if (quantity <= 1) {
            removeItem(productId);
        } else {
            updateItem(productId, quantity - 1);
        }
    }, [productId, quantity, updateItem, removeItem]);

    // ─── Not orderable ───────────────────────────────────────────────────────────
    if (!isOrderable) {
        return (
            <View style={[styles.unavailableButton, compact && styles.compactUnavailable]}>
                <Text style={[styles.unavailableText, compact && styles.compactText]}>
                    Unavailable
                </Text>
            </View>
        );
    }

    // Not in cart → show Add button
    if (quantity === 0) {
        return (

            <View style={styles.addButtonWrapper}>
                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                    <TouchableOpacity
                        style={[styles.addButton, compact && styles.compactAddButton]}
                        onPress={handleAdd}
                        activeOpacity={0.75}
                    >
                        <Ionicons
                            name="add"
                            size={compact ? 13 : 15}
                            color={COLORS.primary}
                            style={styles.addIcon}
                        />
                        <Text style={[styles.addButtonText, compact && styles.compactText]}>
                            ADD
                        </Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        );
    }

    // In cart → show stepper with animation
    const stepperWidth = widthAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [compact ? 62 : 76, compact ? 78 : 96],
    });

    return (
        <Animated.View
            style={{
                width: stepperWidth,
                opacity: opacityAnim,
            }}
        >
            <Animated.View
                style={[
                    styles.stepperContainer,
                    compact && styles.compactStepper,
                    { transform: [{ scale: scaleAnim }] },
                ]}
            >
                {/* Decrease / Remove */}
                <TouchableOpacity
                    style={[styles.stepperButton, compact && styles.compactStepperButton]}
                    onPress={handleDecrease}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name={quantity <= 1 ? 'trash-outline' : 'remove'}
                        size={compact ? 13 : 15}
                        color={COLORS.white}
                    />
                </TouchableOpacity>

                {/* Separator */}
                <View style={styles.separator} />

                {/* Quantity */}
                <View style={styles.quantityDisplay}>
                    <Text style={[styles.quantityText, compact && styles.compactQuantityText]}>
                        {quantity}
                    </Text>
                </View>

                {/* Separator */}
                <View style={styles.separator} />

                {/* Increase */}
                <TouchableOpacity
                    style={[
                        styles.stepperButton,
                        compact && styles.compactStepperButton,
                    ]}
                    onPress={handleIncrease}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name="add"
                        size={compact ? 13 : 15}
                        color={COLORS.white}
                    />
                </TouchableOpacity>
            </Animated.View>
        </Animated.View>
    );
});

CartQuantityStepper.displayName = 'CartQuantityStepper';

const styles = StyleSheet.create({

    // overflow:'visible' ensures the Animated.View scale bounce isn't clipped
    addButtonWrapper: {
        overflow: 'visible',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: COLORS.primary,
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 7,
        backgroundColor: COLORS.white,
        minWidth: 76,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 4,
        elevation: 3,
    },
    compactAddButton: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        minWidth: 62,
        borderRadius: 6,
    },
    // Inline icon — no absolute positioning, never clips
    addIcon: {
        marginRight: 3,
    },
    addButtonText: {
        fontSize: 13,
        fontWeight: '800',
        color: COLORS.primary,
        letterSpacing: 0.6,
    },

    // ─── OUT OF STOCK ────────────────────────────────────────────────────────────

    unavailableButton: {
        backgroundColor: COLORS.backgroundDark,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 7,
        alignItems: 'center',
        minWidth: 76,
    },
    compactUnavailable: {
        paddingHorizontal: 8,
        paddingVertical: 5,
        minWidth: 62,
        borderRadius: 6,
    },
    unavailableText: {
        fontSize: 10,
        fontWeight: '600',
        color: COLORS.textMuted,
    },

    // ─── STEPPER ─────────────────────────────────────────────────────────────────

    stepperContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        borderRadius: 8,
        overflow: 'hidden',
        minWidth: 96,
        height: 34,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.28,
        shadowRadius: 4,
        elevation: 3,
    },
    compactStepper: {
        minWidth: 78,
        height: 30,
        borderRadius: 6,
    },
    stepperButton: {
        width: 32,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    compactStepperButton: {
        width: 26,
    },
    separator: {
        width: 1,
        height: '60%',
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    stepperButtonDisabled: {
        opacity: 0.4,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
    },

    quantityDisplay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quantityText: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.white,
        letterSpacing: 0.3,
    },

    compactText: {
        fontSize: 11,
    },
    compactQuantityText: {
        fontSize: 12,
        fontWeight: '700',
    },
});

export default CartQuantityStepper;