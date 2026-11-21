import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Sparkles, Shield } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import THEME from '../constants/theme';
import Input from '../components/Input';
import Button from '../components/Button';
import { useAuth, DEMO_USERS } from '../context/AuthContext';

export const LoginScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { login, isLoading, error } = useAuth();
  const [email, setEmail] = useState<string>('akabandolo@gmail.com');
  const [password, setPassword] = useState<string>('password');

  const handleDemoSelect = (demo: any) => {
    setEmail(demo.email);
    setPassword(demo.password);
  };

  const handleSubmit = async () => {
    if (!email.trim()) return;
    await login(email, password);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(30, insets.top + 20),
            paddingBottom: Math.max(30, insets.bottom + 20),
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand Banner */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Sparkles size={28} color={THEME.colors.primaryDark} />
          </View>
          <Text style={styles.title}>OMEGA SPA</Text>
          <Text style={styles.subtitle}>Douala • Point of Sale</Text>
        </View>

        {/* Card Form */}
        <View style={styles.card}>
          <Text style={styles.formTitle}>Sign In</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Input
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="akabandolo@gmail.com"
          />

          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
          />

          <Button
            title="Log In"
            onPress={handleSubmit}
            loading={isLoading}
            variant="primary"
            style={styles.submitBtn}
          />

          {/* Quick Demo Credentials */}
          <View style={styles.demoSection}>
            <View style={styles.demoHeader}>
              <Shield size={14} color={THEME.colors.textMuted} />
              <Text style={styles.demoTitle}>Click to Fill Demo Credentials</Text>
            </View>

            <View style={styles.demoGrid}>
              {DEMO_USERS.map((demo) => {
                const isSelected = email.toLowerCase() === demo.email.toLowerCase();
                return (
                  <TouchableOpacity
                    key={demo.role}
                    onPress={() => handleDemoSelect(demo)}
                    style={[
                      styles.demoChip,
                      isSelected && styles.demoChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.demoChipText,
                        isSelected && styles.demoChipTextSelected,
                      ]}
                    >
                      {demo.role}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: THEME.spacing.xl,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: THEME.spacing.xl,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: THEME.colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.xl,
    padding: THEME.spacing.xl,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  formTitle: {
    fontSize: THEME.typography.sizes.xl,
    fontWeight: '700',
    color: THEME.colors.text,
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: THEME.colors.dangerBg,
    borderRadius: THEME.radii.md,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: THEME.colors.danger,
    fontSize: THEME.typography.sizes.sm,
  },
  submitBtn: {
    marginTop: 8,
  },
  demoSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderLight,
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  demoTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  demoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  demoChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radii.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  demoChipSelected: {
    backgroundColor: THEME.colors.primarySoft,
    borderColor: THEME.colors.primary,
  },
  demoChipText: {
    fontSize: 12,
    color: THEME.colors.text,
    fontWeight: '600',
  },
  demoChipTextSelected: {
    color: THEME.colors.primaryDark,
    fontWeight: '800',
  },
});

export default LoginScreen;
