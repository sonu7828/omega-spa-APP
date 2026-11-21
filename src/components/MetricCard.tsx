import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import THEME from '../constants/theme';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  onPress?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  onPress,
}) => {
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      activeOpacity={0.8}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.topRow}>
        <Text style={styles.title}>{title}</Text>
        {icon && <View style={styles.icon}>{icon}</View>}
      </View>
      <Text style={styles.value}>{value}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </Container>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 150,
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
    marginBottom: THEME.spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '600',
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
  },
  icon: {
    padding: 6,
    borderRadius: THEME.radii.sm,
    backgroundColor: THEME.colors.surface,
  },
  value: {
    fontSize: THEME.typography.sizes.xl,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  subtitle: {
    fontSize: THEME.typography.sizes.xs,
    color: THEME.colors.textMuted,
    marginTop: 4,
  },
});

export default MetricCard;

