import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Product } from '@mg-mart/types';
import { COLORS, SIZES, SHADOWS } from '../constants';
import OptimizedImage from './OptimizedImage';
import CartQuantityStepper from './CartQuantityStepper';

interface QuickAddProductCardProps {
    product: Product;
    onPress: () => void;
    style?: ViewStyle;
}

export const QuickAddProductCard: React.FC<QuickAddProductCardProps> = ({
    product,
    onPress,
    style,
}) => {
    return (
        <TouchableOpacity
            style={[styles.container, style]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <View style={styles.imageContainer}>
                <OptimizedImage
                    source={{ uri: product.imageUrl || '' }}
                    style={styles.image}
                    resizeMode="cover"
                />
                <View style={styles.timeBadge}>
                    <Ionicons name="time-outline" size={10} color={COLORS.textSecondary} />
                    <Text style={styles.timeText}>10 MINS</Text>
                </View>
            </View>

            <View style={styles.content}>
                <Text style={styles.name} numberOfLines={2}>
                    {product.name}
                </Text>
                <Text style={styles.unit}>{product.unit}</Text>

                <View style={styles.footer}>
                    <Text style={styles.price}>₹{product.price.toFixed(0)}</Text>
                    <CartQuantityStepper
                        productId={product.productId}
                        isOrderable={product.isOrderable}
                        compact
                    />
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 140,
        backgroundColor: COLORS.white,
        borderRadius: 12,
        marginRight: 12,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        overflow: 'hidden',
    },
    imageContainer: {
        width: '100%',
        height: 120,
        position: 'relative',
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: 120,
    },
    timeBadge: {
        position: 'absolute',
        bottom: 6,
        left: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    timeText: {
        fontSize: 8,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    content: {
        padding: 8,
    },
    name: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.text,
        height: 32,
        marginBottom: 2,
    },
    unit: {
        fontSize: 10,
        color: COLORS.textSecondary,
        marginBottom: 8,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    price: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.text,
    },
});

export default QuickAddProductCard;
