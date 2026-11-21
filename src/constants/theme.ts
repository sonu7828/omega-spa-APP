/**
 * OMEGA SPA POS — LOCKED MOBILE DESIGN THEME
 * Based on DESIGN-SYSTEM.md
 */

export const THEME = {
  colors: {
    // Surfaces
    background: '#FBF7F2',     // Warm Ivory (Main background)
    surface: '#F6F1EB',        // Soft Cream (Sidebar, sections)
    card: '#FFFFFF',           // Pure White (Cards, panels)
    cardSelected: '#FDFBF7',   // Highlighted card surface
    border: '#EAE3D9',         // Warm Sand (Subtle dividers)
    borderLight: '#F0EBE3',

    // Primary Accents (Muted Sage)
    primary: '#A7B89A',        // Muted Sage
    primaryHover: '#96AA88',
    primaryDark: '#3D5A40',    // Dark Forest Green (Active text/borders)
    primarySoft: '#EEF3EA',    // Soft Sage (Badge background, highlights)
    primaryLight: '#EEF3EA',   // Light Sage Accent
    primaryTextOnDark: '#4F6748',

    // Secondary Accents (Dusty Rose)
    secondary: '#E1B6AC',      // Dusty Rose
    secondarySoft: '#F8ECE8',  // Soft Blush
    secondaryDark: '#C98C7F',

    // Typography
    text: '#2D2D2A',           // Deep Charcoal (Headings, primary body)
    textMuted: '#76766E',      // Warm Grey (Subtitles, labels, inactive)
    textLight: '#A3A39B',      // Inactive/placeholder
    textWhite: '#FFFFFF',

    // Status Colors
    success: '#059669',        // Emerald
    successBg: '#ECFDF5',
    warning: '#D97706',        // Amber
    warningBg: '#FFFBEB',
    danger: '#DC2626',         // Crimson Red
    dangerBg: '#FEF2F2',
    info: '#2563EB',           // Blue
    infoBg: '#EFF6FF',

    // Role Colors
    roleManager: '#3D5A40',
    roleReception: '#2563EB',
    roleTechnician: '#A7B89A',
    roleMarketer: '#D97706',
    roleCleaner: '#0891B2',
  },

  typography: {
    fontFamily: {
      regular: 'System',
      medium: 'System',
      semibold: 'System',
      bold: 'System',
    },
    sizes: {
      xs: 11,
      sm: 13,
      base: 15,
      lg: 17,
      xl: 20,
      xxl: 24,
      title: 28,
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },

  shadows: {
    sm: {
      shadowColor: '#2D2D2A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
    },
    md: {
      shadowColor: '#2D2D2A',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    lg: {
      shadowColor: '#2D2D2A',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 6,
    },
    card: {
      shadowColor: '#2D2D2A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    modal: {
      shadowColor: '#2D2D2A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 10,
    },
  },
};

export default THEME;
