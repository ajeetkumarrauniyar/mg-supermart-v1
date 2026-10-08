import React, { useEffect, useRef, memo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCartStore } from '@/stores';
import { COLORS, SIZES, SHADOWS } from '@/constants';
import { RootStackParamList } from '@/navigation/AppNavigator';

type NavigationProp = StackNavigationProp<RootStackParamList>;

const FloatingCartBar: React.FC = memo(() => {
    const navigation = useNavigation<NavigationProp>();
    const { totalItems, totalAmount } = useCartStore();
    const insets = useSafeAreaInsets();
    // Sit just above the tab bar: 54px tab icon area + actual safe area bottom
    const bottomOffset = 54 + insets.bottom + 8;

    // Slide-up animation
    const slideAnim = useRef(new Animated.Value(80)).current;
    const wasVisible = useRef(false);

    useEffect(() => {
        const isVisible = totalItems > 0;

        if (isVisible && !wasVisible.current) {
            // Slide up when cart gets its first item
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 80,
                friction: 10,
            }).start();
        } else if (!isVisible && wasVisible.current) {
            // Slide down when cart is emptied
            Animated.timing(slideAnim, {
                toValue: 80,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }

        wasVisible.current = isVisible;
    }, [totalItems, slideAnim]);

    // Don't render when cart is empty
    if (totalItems === 0) return null;

    const itemLabel = totalItems === 1 ? '1 item' : `${totalItems} items`;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ translateY: slideAnim }],
                    bottom: bottomOffset,
                },
            ]}
            pointerEvents="box-none"
        >
            <TouchableOpacity
                style={styles.bar}
                onPress={() => navigation.navigate('Cart')}
                activeOpacity={0.88}
            >
                {/* Left: bag icon + item count */}
                <View style={styles.left}>
                    <View style={styles.iconBadge}>
                        <Ionicons name="bag-handle" size={18} color={COLORS.primary} />
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{totalItems}</Text>
                        </View>
                    </View>
                    <Text style={styles.itemLabel}>{itemLabel}</Text>
                </View>

                {/* Center: label */}
                <Text style={styles.centerLabel}>View Cart</Text>

                {/* Right: item subtotal + chevron. Fees are priced by the
                    server against a delivery address, so the payable total is
                    only known on the cart screen. */}
                <View style={styles.right}>
                    <View style={styles.amountGroup}>
                        <Text style={styles.subtotalLabel}>Subtotal</Text>
                        <Text style={styles.total}>₹{totalAmount.toFixed(0)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.8)" />
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
});

FloatingCartBar.displayName = 'FloatingCartBar';

export default FloatingCartBar;

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: SIZES.padding,
        right: SIZES.padding,
        zIndex: 999,
        elevation: 10,
    },
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.primary,
        borderRadius: 28,
        height: 56,
        paddingHorizontal: 16,
        ...SHADOWS.medium,
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    iconBadge: {
        position: 'relative',
    },
    badge: {
        position: 'absolute',
        top: -6,
        right: -8,
        backgroundColor: '#ffffff',
        borderRadius: 10,
        minWidth: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 3,
    },
    badgeText: {
        color: COLORS.primary,
        fontSize: 9,
        fontWeight: '800',
    },
    itemLabel: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: SIZES.fontSize.small,
        fontWeight: '500',
    },
    centerLabel: {
        color: '#ffffff',
        fontSize: SIZES.fontSize.regular,
        fontWeight: '700',
        flex: 1,
        textAlign: 'center',
    },
    right: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        flex: 1,
        justifyContent: 'flex-end',
    },
    amountGroup: {
        alignItems: 'flex-end',
    },
    subtotalLabel: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: SIZES.fontSize.tiny,
        fontWeight: '500',
    },
    total: {
        color: '#ffffff',
        fontSize: SIZES.fontSize.regular,
        fontWeight: '700',
    },
});
