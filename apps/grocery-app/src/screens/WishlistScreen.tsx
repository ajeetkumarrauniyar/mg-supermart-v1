import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from "react-native";
import {
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { Product } from "@mg-mart/types";
import { useWishlistStore, useCartStore } from "../stores";
import { COLORS, SHADOWS } from "../constants";
import { OptimizedImage, AuthGuard, ScreenContainer, AppHeader } from "../components";
import { RootStackParamList } from "../navigation/AppNavigator";

type NavigationProp = StackNavigationProp<RootStackParamList>;

interface WishlistCardProps {
  product: Product;
  onRemove: () => void;
  onAddToCart: () => void;
  onPress: () => void;
}

const WishlistCard: React.FC<WishlistCardProps> = ({
  product,
  onRemove,
  onAddToCart,
  onPress,
}) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.imageContainer}>
        <OptimizedImage
          source={{
            uri: product.imageUrl || "https://via.placeholder.com/100",
          }}
          style={styles.image}
          resizeMode="cover"
        />
      </View>
      <View style={styles.content}>
        <View style={styles.cardHeader}>
          <View style={styles.nameContainer}>
            <Text style={styles.name} numberOfLines={1}>
              {product.name}
            </Text>
            <Text style={styles.unit}>{product.unit}</Text>
          </View>
          <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.price}>₹{product.price.toFixed(0)}</Text>
          <TouchableOpacity
            style={[styles.addBtn, !product.isOrderable && styles.disabledBtn]}
            onPress={onAddToCart}
            disabled={!product.isOrderable}
          >
            <Text style={styles.addBtnText}>
              {product.isOrderable ? "Add to Cart" : "Unavailable"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const WishlistContent: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { wishlistItems, removeFromWishlist } = useWishlistStore();
  const { addItem } = useCartStore();
  const insets = useSafeAreaInsets();

  const handleAddToCart = (product: Product) => {
    addItem(product.productId, 1);
    Alert.alert("Success", "Item added to cart");
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons
          name="heart-dislike-outline"
          size={60}
          color={COLORS.primary}
        />
      </View>
      <Text style={styles.emptyTitle}>Nothing here yet!</Text>
      <Text style={styles.emptySubtitle}>
        Looks like you haven&apos;t added any items to your favourites.
      </Text>
      <TouchableOpacity
        style={styles.shopBtn}
        onPress={() => navigation.navigate("MainTabs", { screen: "Products" })}
      >
        <Text style={styles.shopBtnText}>Start Shopping</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <ScreenContainer
        header={<AppHeader title="My Favourites" showBackButton={false} />}
        scrollable={false}
        bottomTabOffset
      >
        {wishlistItems.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={wishlistItems}
            keyExtractor={(item) => item.productId}
            renderItem={({ item }) => (
              <WishlistCard
                product={item}
                onRemove={() => removeFromWishlist(item.productId)}
                onAddToCart={() => handleAddToCart(item)}
                onPress={() =>
                  navigation.navigate("ProductDetail", {
                    productId: item.productId,
                  })
                }
              />
            )}
            contentContainerStyle={[
              styles.list,
              { paddingBottom: 80 + insets.bottom },
            ]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </ScreenContainer>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7FAFC",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF2F7",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.text,
  },
  list: {
    padding: 16,
  },
  card: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: 16,
    padding: 12,
    ...SHADOWS.small,
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  content: {
    flex: 1,
    marginLeft: 16,
    justifyContent: "space-between",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  nameContainer: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 2,
  },
  unit: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  removeBtn: {
    padding: 4,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  price: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
  },
  addBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "bold",
  },
  disabledBtn: {
    backgroundColor: "#CBD5E1",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primary + "10",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 32,
  },
  shopBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
    ...SHADOWS.medium,
  },
  shopBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default function WishlistScreen() {
  return (
    <AuthGuard>
      <WishlistContent />
    </AuthGuard>
  );
}
