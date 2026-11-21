/**
 * Header — 1-to-1 Match with Omega Spa POS PageHeader.jsx
 * Matches frontend/src/components/PageHeader.jsx:
 * - Title: 20-22px semi-bold charcoal text
 * - Subtitle: optional muted description
 * - Action: optional right-side action button (e.g. "📅 Appointment", "+ Add Job Seeker")
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import THEME from '../constants/theme';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onOpenMenu?: () => void;
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  rightAction,
}) => {
  return (
    <View style={styles.headerContainer}>
      <View style={styles.titleArea}>
        <Text style={styles.titleText}>{title}</Text>
        {subtitle ? (
          <Text style={styles.subtitleText}>{subtitle}</Text>
        ) : null}
      </View>
      {rightAction ? (
        <View style={styles.actionArea}>{rightAction}</View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: 'transparent',
    gap: 12,
  },
  titleArea: {
    flex: 1,
    minWidth: 0,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2D2D2A',
    letterSpacing: -0.3,
  },
  subtitleText: {
    fontSize: 12,
    color: '#737373',
    marginTop: 2,
  },
  actionArea: {
    flexShrink: 0,
  },
});

export default Header;
