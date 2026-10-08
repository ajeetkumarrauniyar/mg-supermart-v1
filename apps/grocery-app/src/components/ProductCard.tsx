import React, { memo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Product } from '@mg-mart/types';
import { COLORS, SIZES, SHADOWS, PRODUCT_IMAGE_HEIGHT } from '../constants';
import { useWishlistStore } from '../stores';
import { useRequireAuth } from '../hooks';
import { selectionFeedback } from '../utils/haptics';
import OptimizedImage from './OptimizedImage';
import CartQuantityStepper from './CartQuantityStepper';

const SCREEN_WIDTH = Dimensions.get('window').width;
// Standard horizontal padding on the list (SIZES.padding = 20 on each side)
const CARD_GUTTER = 12; // gap between 2 cards in same row
const CARD_WIDTH = (SCREEN_WIDTH - (SIZES.padding * 2) - CARD_GUTTER) / 2;

interface ProductCardProps {
    product: Product;
    onPress?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = memo(({ product, onPress }) => {
    const { toggleWishlist, isInWishlist } = useWishlistStore();
    const { requireAuth } = useRequireAuth();

    const handleWishlistToggle = useCallback((e?: any) => {
        if (e) e.stopPropagation();
        requireAuth(() => {
            selectionFeedback(); // Haptic feedback
            toggleWishlist(product);
        });
    }, [product, toggleWishlist, requireAuth]);

    const handlePress = useCallback(() => {
        selectionFeedback(); // Haptic feedback
        if (onPress) {
            onPress(product);
        }
    }, [onPress, product]);

    const isWishlisted = isInWishlist(product.productId);

    return (
        <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.7}>
            <OptimizedImage
                source={{ uri: product.imageUrl || '' }}
                style={styles.image}
                resizeMode="cover"
            />
            <TouchableOpacity
                style={styles.wishlistButton}
                onPress={handleWishlistToggle}
                activeOpacity={0.7}
            >
                <Ionicons
                    name={isWishlisted ? "heart" : "heart-outline"}
                    size={20}
                    color={isWishlisted ? "#e53e3e" : "#4a5568"}
                />
            </TouchableOpacity>
            {!product.isOrderable && (
                <View style={styles.outOfStockBadge}>
                    <Text style={styles.outOfStockText}>Unavailable</Text>
                </View>
            )}
            {product.isFeatured && (
                <View style={styles.discountBadge}>
                    <Text style={styles.discountText}>FEATURED</Text>
                </View>
            )}
            <View style={styles.info}>
                <Text style={styles.name} numberOfLines={2}>
                    {product.name}
                </Text>
                <Text style={styles.description} numberOfLines={2}>
                    {product.description}
                </Text>
                <View style={styles.footer}>
                    <View>
                        <Text style={styles.price}>₹{product.price.toFixed(0)}</Text>
                        <Text style={styles.stockText}>{product.unit}</Text>
                    </View>
                    <CartQuantityStepper
                        productId={product.productId}
                        isOrderable={product.isOrderable}
                        compact
                    />
                </View>
            </View>
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    card: {
        width: CARD_WIDTH,
        backgroundColor: COLORS.cardBackground,
        borderRadius: SIZES.borderRadiusLarge,
        marginBottom: SIZES.margin,
        overflow: 'hidden',
        ...SHADOWS.small,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    image: {
        width: '100%',
        height: PRODUCT_IMAGE_HEIGHT,
    },
    wishlistButton: {
        position: 'absolute',
        top: SIZES.marginSmall,
        right: SIZES.marginSmall,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: SIZES.borderRadiusXLarge,
        width: 34,
        height: 34,
        justifyContent: 'center',
        alignItems: 'center',
        ...SHADOWS.small,
    },
    outOfStockBadge: {
        position: 'absolute',
        top: SIZES.marginSmall,
        right: 52,
        backgroundColor: COLORS.errorLight,
        paddingHorizontal: SIZES.marginSmall,
        paddingVertical: 4,
        borderRadius: SIZES.borderRadiusSmall,
    },
    outOfStockText: {
        color: COLORS.error,
        fontSize: SIZES.fontSize.tiny,
        fontWeight: SIZES.fontWeight.semibold,
    },
    discountBadge: {
        position: 'absolute',
        top: SIZES.marginSmall,
        left: SIZES.marginSmall,
        backgroundColor: COLORS.primary,
        paddingHorizontal: SIZES.marginSmall,
        paddingVertical: 4,
        borderRadius: SIZES.borderRadiusSmall,
    },
    discountText: {
        color: COLORS.white,
        fontSize: SIZES.fontSize.tiny,
        fontWeight: SIZES.fontWeight.bold,
    },
    info: {
        padding: SIZES.paddingSmall,
    },
    name: {
        fontSize: SIZES.fontSize.medium,
        fontWeight: SIZES.fontWeight.semibold,
        color: COLORS.text,
        marginBottom: 2,
        lineHeight: 20,
    },
    description: {
        fontSize: SIZES.fontSize.small,
        color: COLORS.textSecondary,
        marginBottom: SIZES.marginSmall,
        lineHeight: 16,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    price: {
        fontSize: SIZES.fontSize.regular,
        fontWeight: SIZES.fontWeight.bold,
        color: COLORS.primary,
    },
    stockText: {
        fontSize: SIZES.fontSize.tiny,
        color: COLORS.textLight,
        marginTop: 2,
    },
});

ProductCard.displayName = 'ProductCard';
