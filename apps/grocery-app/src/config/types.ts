// Configuration type definitions for the MG Mart application

// API Endpoints structure
export interface AuthEndpoints {
  LOGIN: string;
  REGISTER: string;
  LOGOUT: string;
}

export interface ProductEndpoints {
  CREATE_PRODUCT: string;
  LIST: string;
  DETAIL: (id: string) => string;
  UPDATE_PRODUCT: (productId: string) => string;
  DELETE_PRODUCT: (productId: string) => string;
}

export interface CartEndpoints {
  GET: string;
  QUOTE: string;
  ADD_ITEM: string;
  UPDATE_ITEM: (productId: string) => string;
  REMOVE_ITEM: (productId: string) => string;
  CLEAR: string;
}

export interface OrderEndpoints {
  CREATE: string;
  LIST: string;
  DETAIL: (orderId: string) => string;
  UPDATE: (orderId: string) => string;
}

export interface UserEndpoints {
  PROFILE: string;
  UPDATE_PROFILE: string;
  CHANGE_PASSWORD: string;
  DELETE_ACCOUNT: string;
}

export interface ApiEndpoints {
  AUTH: AuthEndpoints;
  PRODUCTS: ProductEndpoints;
  CART: CartEndpoints;
  ORDERS: OrderEndpoints;
  USER: UserEndpoints;
}

// Environment configuration interface
export interface EnvironmentConfig {
  APP_NAME: string;
  APP_VERSION: string;
  API_BASE_URL: string;
  TOKEN_KEY: string;
  POSTMAN_COLLECTION_URL: string;
}

// API configuration interface
export interface ApiConfig {
  TIMEOUT: number;
  RETRY_ATTEMPTS: number;
  RETRY_DELAY: number;
  ENDPOINTS: ApiEndpoints;
}

// Debug configuration interface
export interface DebugConfig {
  ENABLE_API_LOGGING: boolean;
  ENABLE_DEBUG_MODE: boolean;
  ENABLE_PERFORMANCE_MONITORING: boolean;
  ENABLE_ZUSTAND_DEVTOOLS: boolean;
  ENABLE_NETWORK_INSPECTOR: boolean;
  ENABLE_ERROR_REPORTING: boolean;
}

// Main application configuration interface
export interface AppConfig {
  environment: EnvironmentConfig;
  api: ApiConfig;
  debug: DebugConfig;
  isDevelopment: boolean;
  isProduction: boolean;
}

// Configuration validation result
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Helper types for configuration access
export type DebugFeature = keyof DebugConfig;
export type EnvironmentKey = keyof EnvironmentConfig;
export type ApiConfigKey = keyof ApiConfig;

// Configuration getter function types
export type ConfigGetter<T> = () => T;
export type FeatureChecker = (feature: DebugFeature) => boolean;
export type UrlBuilder = (endpoint: string) => string;
