// API configuration - Endpoints, timeouts, and network settings
import { ApiConfig, ApiEndpoints } from "./types";

// API Endpoints organized by feature area
const apiEndpoints: ApiEndpoints = {
  // Authentication endpoints
  AUTH: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    LOGOUT: "/auth/logout",
  },

  // Product endpoints
  PRODUCTS: {
    CREATE_PRODUCT: "products",
    LIST: "/products",
    DETAIL: (productId: string) => `/products/${productId}`,
    UPDATE_PRODUCT: (productId: string) => `/products/${productId}`,
    DELETE_PRODUCT: (productId: string) => `/products/${productId}`,
  },

  // Shopping cart endpoints
  CART: {
    GET: "/cart",
    // Authoritative bill: fees, minimum order and blockers come from the server
    QUOTE: "/cart/quote",
    ADD_ITEM: "/cart/add",
    UPDATE_ITEM: (productId: string) => `/cart/update/${productId}`,
    REMOVE_ITEM: (productId: string) => `/cart/remove/${productId}`,
    CLEAR: "/cart/clear",
  },

  // Order management endpoints
  ORDERS: {
    CREATE: "/orders",
    LIST: "/orders",
    DETAIL: (orderId: string) => `/orders/${orderId}`,
    UPDATE: (orderId: string) => `/orders/${orderId}/update`,
  },

  // User profile endpoints
  USER: {
    PROFILE: "/users/profile",
    UPDATE_PROFILE: "/users/profile",
    CHANGE_PASSWORD: "/users/change-password",
    DELETE_ACCOUNT: "/users/account",
  },
};

// API configuration object
export const apiConfig: ApiConfig = {
  // Network timeouts and retry settings
  TIMEOUT: 10000, // 10 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second

  // API endpoints
  ENDPOINTS: apiEndpoints,
};

// Helper functions for API configuration
export const getEndpoint = (
  category: keyof ApiEndpoints,
  endpoint: string
): string => {
  const categoryEndpoints = apiConfig.ENDPOINTS[category];
  if (!categoryEndpoints) {
    throw new Error(`API category '${category}' not found`);
  }

  const endpointValue = (categoryEndpoints as any)[endpoint];
  if (!endpointValue) {
    throw new Error(
      `Endpoint '${endpoint}' not found in category '${category}'`
    );
  }

  return typeof endpointValue === "function" ? endpointValue : endpointValue;
};

// Get timeout configuration based on environment
export const getApiTimeout = (): number => {
  // Shorter timeout in development for faster feedback
  return __DEV__ ? 5000 : apiConfig.TIMEOUT;
};

// Get retry configuration
export const getRetryConfig = () => ({
  attempts: apiConfig.RETRY_ATTEMPTS,
  delay: apiConfig.RETRY_DELAY,
});

// Validate API configuration
export const validateApiConfig = (config: ApiConfig): boolean => {
  // Validate timeout values
  if (config.TIMEOUT <= 0) {
    throw new Error("API configuration error: TIMEOUT must be greater than 0");
  }

  if (config.RETRY_ATTEMPTS < 0) {
    throw new Error(
      "API configuration error: RETRY_ATTEMPTS must be non-negative"
    );
  }

  if (config.RETRY_DELAY < 0) {
    throw new Error(
      "API configuration error: RETRY_DELAY must be non-negative"
    );
  }

  // Validate endpoints structure
  const requiredCategories: (keyof ApiEndpoints)[] = [
    "AUTH",
    "PRODUCTS",
    "CART",
    "ORDERS",
    "USER",
  ];

  for (const category of requiredCategories) {
    if (!config.ENDPOINTS[category]) {
      throw new Error(
        `API configuration error: Missing endpoint category '${category}'`
      );
    }
  }

  return true;
};

// Initialize validation on module load
validateApiConfig(apiConfig);

export default apiConfig;
