import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { COLORS, SIZES } from '@/constants';
import { OptimizedImage, ScreenContainer, AppHeader } from '@/components';
import { useProductStore, useCartStore, useWishlistStore } from '@/stores';
import { useRequireAuth } from '@/hooks';

type Props = StackScreenProps<RootStackParamList, 'ProductDetail'>;

export default function ProductDetailScreen({ route, navigation }: Props) {
    const { productId } = route.params;
    const { products } = useProductStore();
    const { addItem } = useCartStore();
    const { toggleWishlist, isInWishlist } = useWishlistStore();
    const { requireAuth } = useRequireAuth();
    const [quantity, setQuantity] = useState(1);
    const [isAddingToCart, setIsAddingToCart] = useState(false);

    const product = products.find((p) => p.productId === productId);

    useEffect(() => {
        if (!product) {
            Alert.alert('Error', 'Product not found', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        }
    }, [product]);

    if (!product) {
        return (
            <ScreenContainer>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            </ScreenContainer>
        );
    }

    // Only a lower bound: the catalogue's stock figures are not reliable, so an
    // upper limit here would be invented. The quote blocks a line the shop
    // cannot actually supply.
    const handleQuantityChange = (delta: number) => {
        const newQuantity = quantity + delta;
        if (newQuantity >= 1) {
            setQuantity(newQuantity);
        }
    };

    const handleAddToCart = async () => {
        if (!product.isOrderable) {
            Alert.alert('Unavailable', 'This product is currently unavailable');
            return;
        }

        requireAuth(async () => {
            setIsAddingToCart(true);
            try {
                await addItem(product.productId, quantity);
                // Subtle feedback - navigate to cart
                setQuantity(1); // Reset quantity after adding
            } catch (error) {
                Alert.alert('Error', 'Failed to add item to cart. Please try again.');
            } finally {
                setIsAddingToCart(false);
            }
        });
    };

    const toggleFavorite = () => {
        requireAuth(() => {
            toggleWishlist(product);
        });
    };

    const isWishlisted = isInWishlist(product.productId);

    const totalPrice = product.price * quantity;
    const isUnavailable = !product.isOrderable;

    return (
        <ScreenContainer
            header={
                <AppHeader 
                    title={product?.name || "Product Details"} 
                    rightAction={
                        <TouchableOpacity onPress={toggleFavorite} style={{ padding: 4 }}>
                            <Ionicons
                                name={isWishlisted ? 'heart' : 'heart-outline'}
                                size={24}
                                color={isWishlisted ? '#e53e3e' : COLORS.text}
                            />
                        </TouchableOpacity>
                    }
                />
            }
            footer={
                <View style={styles.bottomBar}>
                    <View style={styles.totalSection}>
                        <Text style={styles.totalLabel}>Total Price</Text>
                        <Text style={styles.totalPrice}>₹{totalPrice.toFixed(2)}</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.addToCartButton, (isUnavailable || isAddingToCart) && styles.addToCartButtonDisabled]}
                        onPress={handleAddToCart}
                        disabled={isUnavailable || isAddingToCart}
                        activeOpacity={0.8}
                    >
                        {isAddingToCart ? (
                            <ActivityIndicator size="small" color={COLORS.white} />
                        ) : (
                            <Ionicons name="cart-outline" size={20} color={COLORS.white} />
                        )}
                        <Text style={styles.addToCartText}>
                            {isUnavailable ? 'Unavailable' : isAddingToCart ? 'Adding...' : 'Add to Cart'}
                        </Text>
                    </TouchableOpacity>
                </View>
            }
        >
            {/* Product Image */}
            <View style={styles.imageContainer}>
                <OptimizedImage
                    source={{ uri: product.imageUrl || 'https://via.placeholder.com/400' }}
                    style={styles.productImage}
                    resizeMode="cover"
                />
                {isUnavailable && (
                    <View style={styles.outOfStockBadge}>
                        <Text style={styles.outOfStockText}>Unavailable</Text>
                    </View>
                )}
            </View>

            {/* Product Info */}
            <View style={styles.contentContainer}>
                {/* Product Name & Category */}
                <View style={styles.titleSection}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productCategory}>{product.category}</Text>
                </View>

                {/* Price & Unit */}
                <View style={styles.priceSection}>
                    <View>
                        <Text style={styles.priceLabel}>Price</Text>
                        <Text style={styles.productPrice}>
                            ₹{product.price.toFixed(2)}
                            <Text style={styles.productUnit}> /{product.unit}</Text>
                        </Text>
                    </View>
                    {!isUnavailable && (
                        <View style={styles.stockBadge}>
                            <Text style={styles.stockText}>Available</Text>
                        </View>
                    )}
                </View>

                {/* Description */}
                {product.description && (
                    <View style={styles.descriptionSection}>
                        <Text style={styles.sectionTitle}>Product Details</Text>
                        <Text style={styles.description}>{product.description}</Text>
                    </View>
                )}

                {/* Quantity Selector */}
                {!isUnavailable && (
                    <View style={styles.quantitySection}>
                        <Text style={styles.sectionTitle}>Quantity</Text>
                        <View style={styles.quantityControls}>
                            <TouchableOpacity
                                style={[
                                    styles.quantityButton,
                                    quantity <= 1 && styles.quantityButtonDisabled,
                                ]}
                                onPress={() => handleQuantityChange(-1)}
                                disabled={quantity <= 1}
                            >
                                <Ionicons
                                    name="remove"
                                    size={20}
                                    color={quantity <= 1 ? '#cbd5e0' : COLORS.text}
                                />
                            </TouchableOpacity>
                            <Text style={styles.quantityText}>{quantity}</Text>
                            <TouchableOpacity
                                style={[
                                    styles.quantityButton,
                                ]}
                                onPress={() => handleQuantityChange(1)}
                            >
                                <Ionicons
                                    name="add"
                                    size={20}
                                    color={COLORS.text}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
        </ScreenContainer>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    imageContainer: {
        width: '100%',
        height: 300,
        backgroundColor: '#f8f9fa',
        position: 'relative',
    },
    productImage: {
        width: '100%',
        height: '100%',
    },
    outOfStockBadge: {
        position: 'absolute',
        top: 16,
        right: 16,
        backgroundColor: '#e53e3e',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    outOfStockText: {
        color: COLORS.white,
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    contentContainer: {
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        marginTop: -20,
        paddingTop: 24,
        paddingHorizontal: SIZES.padding,
        paddingBottom: 100,
    },
    titleSection: {
        marginBottom: 20,
    },
    productName: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 8,
        lineHeight: 32,
    },
    productCategory: {
        fontSize: 14,
        color: '#718096',
        textTransform: 'capitalize',
    },
    priceSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 24,
    },
    priceLabel: {
        fontSize: 12,
        color: '#718096',
        marginBottom: 4,
    },
    productPrice: {
        fontSize: 28,
        fontWeight: '700',
        color: COLORS.primary,
    },
    productUnit: {
        fontSize: 16,
        color: '#718096',
        fontWeight: '400',
    },
    stockBadge: {
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#86efac',
    },
    stockText: {
        fontSize: 12,
        color: '#16a34a',
        fontWeight: '600',
    },
    descriptionSection: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 12,
    },
    description: {
        fontSize: 14,
        color: '#4a5568',
        lineHeight: 22,
    },
    quantitySection: {
        marginBottom: 24,
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
    },
    quantityButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#f7fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityButtonDisabled: {
        backgroundColor: '#f7fafc',
        borderColor: '#e2e8f0',
    },
    quantityText: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.text,
        minWidth: 40,
        textAlign: 'center',
    },
    bottomBar: {
        backgroundColor: COLORS.white,
        paddingHorizontal: SIZES.padding,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        paddingBottom: 20,
    },
    totalSection: {
        flex: 1,
    },
    totalLabel: {
        fontSize: 12,
        color: '#718096',
        marginBottom: 4,
    },
    totalPrice: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.text,
    },
    addToCartButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        elevation: 2,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    addToCartButtonDisabled: {
        backgroundColor: '#cbd5e0',
        elevation: 0,
        shadowOpacity: 0,
    },
    addToCartText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '700',
    },
});
