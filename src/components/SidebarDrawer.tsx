import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Package,
  UserRoundPlus,
  RefreshCw,
  FileCheck,
  ClipboardList,
  LogOut,
  UserCog,
  Camera,
  ClipboardCheck,
  Award,
  Sparkles,
  Share2,
  MessageCircle,
  Star,
  FileText,
  ShoppingBag,
  Receipt,
  Clock,
  Briefcase,
  TrendingUp,
  BarChart3,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import THEME from '../constants/theme';
import { useAuth } from '../context/AuthContext';

interface SidebarDrawerProps {
  visible: boolean;
  activeRoute: string;
  onClose: () => void;
  onNavigate: (route: string) => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  visible,
  activeRoute,
  onClose,
  onNavigate,
}) => {
  const { user, logout, isMarketer, isCleaner } = useAuth();
  const insets = useSafeAreaInsets();
  const role = (user?.role || 'manager').toLowerCase();

  const handleSelect = (route: string) => {
    onNavigate(route);
    onClose();
  };

  const navSections = isMarketer
    ? [
        {
          title: 'MARKETING PORTAL',
          items: [
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'services', label: 'Services Catalog', icon: Sparkles },
            { id: 'clients', label: 'Clients Directory', icon: Users },
            { id: 'appointments', label: 'Appointments', icon: CalendarDays },
            { id: 'invoices', label: 'Invoices', icon: FileText },
            { id: 'summary', label: 'My Performance', icon: ClipboardList },
          ],
        },
      ]
    : [
        {
          title: 'MAIN',
          items: [
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['manager', 'reception', 'technician'] },
            { id: 'appointments', label: 'Appointments', icon: CalendarDays, roles: ['manager', 'reception', 'technician'] },
            { id: 'clients', label: 'Clients', icon: Users, roles: ['manager', 'reception', 'technician'] },
          ],
        },
        {
          title: 'OPERATIONS',
          items: [
            { id: 'invoices', label: 'Invoices', icon: FileText, roles: ['manager', 'reception', 'technician'] },
            { id: 'expenses', label: 'Expenses', icon: Receipt, roles: ['manager', 'reception'] },
            { id: 'shared_work', label: 'Shared Work', icon: Users, roles: ['manager', 'reception', 'technician'] },
            { id: 'services', label: 'Services', icon: Sparkles, roles: ['manager', 'reception', 'technician'] },
            { id: 'stock', label: 'Service Stock', icon: Package, roles: ['manager', 'reception'] },
            { id: 'stock_photos', label: 'Daily Stock Photos', icon: Camera, roles: ['technician', 'manager', 'reception'] },
            { id: 'retail', label: 'Retail Products', icon: ShoppingBag, roles: ['manager', 'reception'] },
            { id: 'summary', label: 'Tech Summary', icon: ClipboardList, roles: ['manager', 'reception', 'technician'] },
            { id: 'cleaning', label: 'Cleaning', icon: isCleaner ? Camera : ClipboardCheck, roles: ['cleaner', 'manager', 'reception'] },
            { id: 'staff', label: 'Staff', icon: UserCog, roles: ['manager', 'reception'] },
            { id: 'job_seekers', label: 'Job Seekers', icon: Briefcase, roles: ['manager', 'reception'] },
            { id: 'daily_close', label: 'Daily Close', icon: FileCheck, roles: ['manager', 'reception'] },
            { id: 'reports', label: 'Reports', icon: BarChart3, roles: ['manager', 'reception'] },
            { id: 'attendance_manager', label: 'Staff Attendance', icon: ClipboardCheck, roles: ['manager', 'reception'] },
            { id: 'attendance', label: 'My Attendance', icon: Clock, roles: ['technician', 'reception'] },
          ],
        },
        {
          title: 'CLIENT GROWTH',
          items: [
            { id: 'social_media', label: 'Social Media', icon: Share2, roles: ['manager', 'reception'] },
            { id: 'loyalty_settings', label: 'Loyalty', icon: Award, roles: ['manager', 'reception'] },
            { id: 'referrals', label: 'Referrals', icon: UserRoundPlus, roles: ['manager', 'reception'] },
            { id: 'rebooking', label: 'Rebooking', icon: RefreshCw, roles: ['manager', 'reception'] },
            { id: 'whatsapp_automations', label: 'WhatsApp', icon: MessageCircle, roles: ['manager', 'reception'] },
            { id: 'client_feedback', label: 'Feedback', icon: Star, roles: ['manager', 'reception'] },
          ],
        },
      ];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop Tap to Close */}
        <Pressable style={styles.backdrop} onPress={onClose} />

        {/* Drawer Content */}
        <View
          style={[
            styles.drawer,
            {
              paddingTop: Math.max(16, insets.top + 8),
              paddingBottom: Math.max(16, insets.bottom + 16),
            },
          ]}
        >
          {/* Brand Header */}
          <View style={styles.brandRow}>
            <View>
              <Text style={styles.brandTitle}>OMEGA SPA</Text>
              <Text style={styles.brandSubtitle}>Douala • Point of Sale</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* User Profile Info */}
          {user && (
            <View style={styles.userBox}>
              <View style={styles.userAvatar}>
                <Text style={styles.userInitials}>
                  {user.name.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userRole}>{user.role.toUpperCase()}</Text>
              </View>
            </View>
          )}

          {/* Navigation Items */}
          <ScrollView showsVerticalScrollIndicator={false} style={styles.navScroll}>
            {navSections.map((section, sIdx) => {
              const visibleItems = isMarketer
                ? section.items
                : section.items?.filter((item) => (item as any).roles.includes(role));

              if (!visibleItems || visibleItems.length === 0) return null;

              return (
                <View key={sIdx} style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  {visibleItems.map((item) => {
                    const isSelected = activeRoute === item.id;
                    const Icon = item.icon;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.7}
                        onPress={() => handleSelect(item.id)}
                        style={[
                          styles.navItem,
                          isSelected && styles.navItemSelected,
                        ]}
                      >
                        <Icon
                          size={19}
                          color={
                            isSelected
                              ? THEME.colors.primaryDark
                              : THEME.colors.textMuted
                          }
                        />
                        <Text
                          style={[
                            styles.navText,
                            isSelected && styles.navTextSelected,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>

          {/* Logout Action */}
          <TouchableOpacity
            onPress={() => {
              onClose();
              logout();
            }}
            style={styles.logoutRow}
          >
            <LogOut size={18} color={THEME.colors.danger} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(45, 45, 42, 0.5)',
  },
  drawer: {
    width: '82%',
    maxWidth: 320,
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: THEME.spacing.lg,
    borderRightWidth: 1,
    borderRightColor: THEME.colors.border,
    ...THEME.shadows.modal,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  brandTitle: {
    fontSize: THEME.typography.sizes.xl,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  userBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    padding: 12,
    borderRadius: THEME.radii.md,
    marginTop: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  userInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.primaryDark,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  userRole: {
    fontSize: 10,
    color: THEME.colors.primaryDark,
    fontWeight: '700',
  },
  navScroll: {
    flex: 1,
    marginTop: 8,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 1,
    marginBottom: 6,
    paddingLeft: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: THEME.radii.md,
    marginBottom: 2,
  },
  navItemSelected: {
    backgroundColor: THEME.colors.primarySoft,
  },
  navText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  navTextSelected: {
    color: THEME.colors.primaryDark,
    fontWeight: '800',
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    marginTop: 8,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.danger,
  },
});

export default SidebarDrawer;

