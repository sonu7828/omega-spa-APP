import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const TOKEN_KEY = 'omega_spa_auth_token';
const USER_KEY = 'omega_spa_auth_user';

// In-memory cache fallback to ensure token is never lost
let memoryToken: string | null = null;
let memoryUser: any = null;

export const storage = {
  async setToken(token: string | null): Promise<void> {
    memoryToken = token;
    try {
      if (token) {
        if (Platform.OS === 'web') {
          await AsyncStorage.setItem(TOKEN_KEY, token);
        } else {
          try {
            await SecureStore.setItemAsync(TOKEN_KEY, token);
          } catch {
            await AsyncStorage.setItem(TOKEN_KEY, token);
          }
        }
      } else {
        if (Platform.OS === 'web') {
          await AsyncStorage.removeItem(TOKEN_KEY);
        } else {
          try {
            await SecureStore.deleteItemAsync(TOKEN_KEY);
          } catch {
            await AsyncStorage.removeItem(TOKEN_KEY);
          }
        }
      }
    } catch (e) {
      // In-memory token already set, so app will continue working seamlessly
    }
  },

  async getToken(): Promise<string | null> {
    if (memoryToken) return memoryToken;
    try {
      if (Platform.OS === 'web') {
        const val = await AsyncStorage.getItem(TOKEN_KEY);
        if (val) memoryToken = val;
        return val;
      }
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (token) {
          memoryToken = token;
          return token;
        }
      } catch {}
      const fallback = await AsyncStorage.getItem(TOKEN_KEY);
      if (fallback) memoryToken = fallback;
      return fallback;
    } catch (e) {
      return memoryToken;
    }
  },

  async setUser(user: any): Promise<void> {
    memoryUser = user;
    try {
      if (user) {
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
      } else {
        await AsyncStorage.removeItem(USER_KEY);
      }
    } catch (e) {
      // In-memory user already set
    }
  },

  async getUser(): Promise<any | null> {
    if (memoryUser) return memoryUser;
    try {
      const data = await AsyncStorage.getItem(USER_KEY);
      if (data) {
        memoryUser = JSON.parse(data);
        return memoryUser;
      }
      return null;
    } catch (e) {
      return memoryUser;
    }
  },

  async clear(): Promise<void> {
    memoryToken = null;
    memoryUser = null;
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {}
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);
    } catch {}
  },
};

export default storage;
