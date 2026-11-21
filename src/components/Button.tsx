import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import THEME from '../constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}) => {
  const getBackgroundColor = () => {
    if (disabled) return THEME.colors.borderLight;
    switch (variant) {
      case 'primary':
        return THEME.colors.primary;
      case 'secondary':
        return THEME.colors.secondarySoft;
      case 'outline':
      case 'ghost':
        return 'transparent';
      case 'danger':
        return THEME.colors.danger;
      default:
        return THEME.colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return THEME.colors.textLight;
    switch (variant) {
      case 'primary':
        return THEME.colors.primaryDark;
      case 'secondary':
        return THEME.colors.text;
      case 'outline':
        return THEME.colors.primaryDark;
      case 'ghost':
        return THEME.colors.textMuted;
      case 'danger':
        return THEME.colors.textWhite;
      default:
        return THEME.colors.primaryDark;
    }
  };

  const getBorderColor = () => {
    if (disabled) return 'transparent';
    if (variant === 'outline') return THEME.colors.primary;
    return 'transparent';
  };

  const getPadding = () => {
    switch (size) {
      case 'sm':
        return { paddingVertical: 8, paddingHorizontal: 12, borderRadius: THEME.radii.sm };
      case 'lg':
        return { paddingVertical: 16, paddingHorizontal: 24, borderRadius: THEME.radii.lg };
      case 'md':
      default:
        return { paddingVertical: 12, paddingHorizontal: 16, borderRadius: THEME.radii.md };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'sm':
        return THEME.typography.sizes.sm;
      case 'lg':
        return THEME.typography.sizes.lg;
      case 'md':
      default:
        return THEME.typography.sizes.base;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        getPadding(),
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === 'outline' ? 1.5 : 0,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getTextColor()} />
      ) : (
        <>
          {icon && <>{icon}</>}
          <Text
            style={[
              styles.text,
              {
                color: getTextColor(),
                fontSize: getFontSize(),
                marginLeft: icon ? 8 : 0,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default Button;

