import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SIZES, SHADOWS, banners, categories } from "../constants";
import {
  useAuthStore,
  useProductStore,
  useLocationStore,
  useCartStore,
} from "../stores";
import { Product } from "@mg-mart/types";
import {
  LocationHeader,
  HomeSearchBar,
  BannerCarousel,
  CategoryGrid,
  QuickAddProductCard,
  ScreenContainer,
} from "../components";
import { RootStackParamList } from "../navigation/AppNavigator";


type NavigationProp = StackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  useAuthStore();
  const {
    featuredProducts,
    fetchFeaturedProducts,
    isLoading: productsLoading,
  } = useProductStore();
  const {
    locationName,
    isLoading: locationLoading,
    initializeLocation,
  } = useLocationStore();
  const { addItem } = useCartStore();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchFeaturedProducts();
    initializeLocation();
  }, [fetchFeaturedProducts, initializeLocation]);

  const handleAddToCart = useCallback(
    (product: Product) => {
      if (!product.isOrderable) {
        Alert.alert("Unavailable", "This product is currently unavailable");
        return;
      }
      addItem(product.productId, 1);
      // Subtle feedback - cart badge updates automatically
    },
    [addItem],
  );

  const renderSectionHeader = (title: string, onSeeAll: () => void) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <TouchableOpacity onPress={onSeeAll}>
        <Text style={styles.seeAllText}>See all</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFeaturedProducts = () => {
    if (featuredProducts.length === 0 && !productsLoading) return null;

    return (
      <View style={styles.featuredSection}>
        {renderSectionHeader("Featured Products", () =>
          navigation.navigate("MainTabs", { screen: "Products" }),
        )}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.featuredList}
        >
          {featuredProducts.slice(0, 10).map((product: Product) => (
            <QuickAddProductCard
              key={product.productId}
              product={product}
              onPress={() =>
                navigation.navigate("ProductDetail", {
                  productId: product.productId,
                })
              }
            />
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <ScreenContainer
      header={
        <View style={styles.stickyHeader}>
          <LocationHeader
            address={locationName}
            isLoading={locationLoading}
            onPress={() => navigation.navigate("LocationSelection")}
            onProfilePress={() =>
              navigation.navigate("MainTabs", { screen: "Profile" })
            }
          />
          <HomeSearchBar value={searchQuery} onChangeText={setSearchQuery} />
        </View>
      }
      scrollable={true}
      bottomTabOffset
    >
      <BannerCarousel banners={banners} />

      <CategoryGrid
        categories={categories}
        onCategoryPress={() =>
          navigation.navigate("MainTabs", { screen: "Products" })
        }
      />

      {renderFeaturedProducts()}

      <View style={styles.promoSection}>
        <View style={styles.promoCard}>
          <View style={styles.promoTextContainer}>
            <Text style={styles.promoTitle}>Super fast delivery</Text>
            <Text style={styles.promoSubtitle}>
              Get your groceries right at your doorstep.
            </Text>
          </View>
          <Ionicons name="flash" size={32} color="#FFD700" />
        </View>
      </View>

      {featuredProducts.length > 5 && (
        <View style={styles.featuredSection}>
          {renderSectionHeader("Best Sellers", () =>
            navigation.navigate("MainTabs", { screen: "Products" }),
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredList}
          >
            {featuredProducts
              .slice()
              .reverse()
              .slice(0, 10)
              .map((product: Product) => (
                <QuickAddProductCard
                  key={product.productId}
                  product={product}
                  onPress={() =>
                    navigation.navigate("ProductDetail", {
                      productId: product.productId,
                    })
                  }
                />
              ))}
          </ScrollView>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  stickyHeader: {
    zIndex: 10,
    backgroundColor: COLORS.white,
    ...SHADOWS.small,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 10,
    paddingBottom: 80,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SIZES.padding,
    marginBottom: SIZES.margin,
  },
  sectionTitle: {
    fontSize: SIZES.fontSize.large,
    fontWeight: SIZES.fontWeight.bold,
    color: COLORS.text,
  },
  seeAllText: {
    fontSize: SIZES.fontSize.medium,
    color: COLORS.primary,
    fontWeight: SIZES.fontWeight.bold,
  },
  featuredSection: {
    marginBottom: SIZES.marginLarge,
  },
  featuredList: {
    paddingLeft: SIZES.padding,
    paddingRight: SIZES.padding - 12,
  },
  promoSection: {
    paddingHorizontal: SIZES.padding,
    marginBottom: SIZES.marginLarge,
  },
  promoCard: {
    backgroundColor: COLORS.backgroundDark,
    borderRadius: SIZES.borderRadiusLarge,
    padding: SIZES.margin,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  promoTextContainer: {
    flex: 1,
  },
  promoTitle: {
    fontSize: SIZES.fontSize.regular,
    fontWeight: SIZES.fontWeight.bold,
    color: COLORS.text,
    marginBottom: 2,
  },
  promoSubtitle: {
    fontSize: SIZES.fontSize.small,
    color: COLORS.textSecondary,
  },
});
