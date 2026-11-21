import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import THEME from '../constants/theme';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'muted' | 'default';
  style?: any;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'primary', style }) => {
  const getColors = () => {
    switch (variant) {
      case 'success':
        return { bg: THEME.colors.successBg, text: THEME.colors.success };
      case 'warning':
        return { bg: THEME.colors.warningBg, text: THEME.colors.warning };
      case 'danger':
        return { bg: THEME.colors.dangerBg, text: THEME.colors.danger };
      case 'info':
        return { bg: THEME.colors.infoBg, text: THEME.colors.info };
      case 'muted':
      case 'default':
        return { bg: THEME.colors.surface, text: THEME.colors.textMuted };
      case 'primary':
      default:
        return { bg: THEME.colors.primarySoft, text: THEME.colors.primaryDark };
    }
  };

  const { bg, text } = getColors();

  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radii.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});

export default Badge;

