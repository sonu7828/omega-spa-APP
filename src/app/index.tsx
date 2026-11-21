import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LayoutDashboard,
  Calendar,
  Users,
  CreditCard,
  Menu,
  Clock,
  Sparkles,
  TrendingUp,
  Package,
} from 'lucide-react-native';
import THEME from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import SidebarDrawer from '../components/SidebarDrawer';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ClientsListScreen from '../screens/ClientsListScreen';
import AddClientScreen from '../screens/AddClientScreen';
import ClientFileScreen from '../screens/ClientFileScreen';
import AppointmentCalendarScreen from '../screens/AppointmentCalendarScreen';
import CreateAppointmentScreen from '../screens/CreateAppointmentScreen';
import AppointmentDetailScreen from '../screens/AppointmentDetailScreen';
import CloseServiceScreen from '../screens/CloseServiceScreen';
import PendingInvoicesScreen from '../screens/PendingInvoicesScreen';
import InvoiceDetailScreen from '../screens/InvoiceDetailScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
import ServiceStockScreen from '../screens/ServiceStockScreen';
import DailyStockPhotosScreen from '../screens/DailyStockPhotosScreen';
import RetailProductsScreen from '../screens/RetailProductsScreen';
import TechnicianDailySummaryScreen from '../screens/TechnicianDailySummaryScreen';
import DailyCloseScreen from '../screens/DailyCloseScreen';
import ReportsScreen from '../screens/ReportsScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import GrowthScreen from '../screens/GrowthScreen';
import CleaningUploadScreen from '../screens/CleaningUploadScreen';
import CleaningRecordsScreen from '../screens/CleaningRecordsScreen';
import StaffManagementScreen from '../screens/StaffManagementScreen';
import ServicesCatalogScreen from '../screens/ServicesCatalogScreen';
import AttendanceManagerScreen from '../screens/AttendanceManagerScreen';
import JobSeekersScreen from '../screens/JobSeekersScreen';
import SharedWorkScreen from '../screens/SharedWorkScreen';
import ReferralsScreen from '../screens/ReferralsScreen';
import RebookingScreen from '../screens/RebookingScreen';
import WhatsAppAutomationsScreen from '../screens/WhatsAppAutomationsScreen';
import SocialMediaScreen from '../screens/SocialMediaScreen';
import LoyaltySettingsScreen from '../screens/LoyaltySettingsScreen';
import ClientFeedbackScreen from '../screens/ClientFeedbackScreen';

export default function AppEntry() {
  const { user, isAuthenticated, isLoading, isTechnician, isMarketer, isCleaner } = useAuth();

  // Active route — Cleaners default to 'cleaning', other roles to 'dashboard'
  const [activeRoute, setActiveRoute] = useState<string>(isCleaner ? 'cleaning' : 'dashboard');
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Subscreen navigation stack
  const [subscreen, setSubscreen] = useState<{
    name: string;
    params?: any;
  } | null>(null);

  // Reset to role's default primary menu on login, logout, or account switch:
  // - Cleaner -> 'cleaning' (Cleaner's first menu)
  // - Manager / Reception / Technician / Marketer -> 'dashboard' (Primary first menu)
  useEffect(() => {
    if (isAuthenticated && user) {
      const defaultHome = user.role === 'cleaner' ? 'cleaning' : 'dashboard';
      setActiveRoute(defaultHome);
      setSubscreen(null);
      setDrawerOpen(false);
    } else if (!isAuthenticated) {
      setActiveRoute('dashboard');
      setSubscreen(null);
      setDrawerOpen(false);
    }
  }, [user?.id, user?.role, isAuthenticated]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Connecting to OMEGA SPA POS...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // Handle detailed subscreen navigation
  if (subscreen) {
    switch (subscreen.name) {
      case 'add_client':
        return (
          <SafeAreaView style={styles.container}>
            <AddClientScreen
              onBack={() => setSubscreen(null)}
              onSuccess={(cid) => setSubscreen({ name: 'client_file', params: { clientId: cid } })}
            />
          </SafeAreaView>
        );

      case 'client_file':
        return (
          <SafeAreaView style={styles.container}>
            <ClientFileScreen
              clientId={subscreen.params?.clientId}
              onBack={() => setSubscreen(null)}
              onBookAppointment={(c) =>
                setSubscreen({ name: 'create_appointment', params: { initialClientId: c.id } })
              }
            />
          </SafeAreaView>
        );

      case 'create_appointment':
        return (
          <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <CreateAppointmentScreen
              initialClientId={subscreen.params?.initialClientId}
              initialTechId={subscreen.params?.technicianId}
              initialDate={subscreen.params?.date}
              initialTime={subscreen.params?.time}
              onBack={() => setSubscreen(null)}
              onSuccess={() => setSubscreen(null)}
              onNavigateAddClient={() => setSubscreen({ name: 'add_client' })}
            />
          </SafeAreaView>
        );

      case 'appointment_detail':
        return (
          <SafeAreaView style={styles.container}>
            <AppointmentDetailScreen
              appointmentId={subscreen.params?.appointmentId}
              onBack={() => setSubscreen(null)}
              onCloseService={(apt) =>
                setSubscreen({ name: 'close_service', params: { appointment: apt } })
              }
            />
          </SafeAreaView>
        );

      case 'close_service':
        return (
          <SafeAreaView style={styles.container}>
            <CloseServiceScreen
              appointment={subscreen.params?.appointment}
              onBack={() => setSubscreen(null)}
              onInvoiceCreated={(invId) =>
                setSubscreen({ name: 'invoice_detail', params: { invoiceId: invId } })
              }
            />
          </SafeAreaView>
        );

      case 'invoice_detail':
        return (
          <SafeAreaView style={styles.container}>
            <InvoiceDetailScreen
              invoiceId={subscreen.params?.invoiceId}
              onBack={() => setSubscreen(null)}
              onPaymentSuccess={() => setSubscreen(null)}
            />
          </SafeAreaView>
        );
    }
  }

  // Render current active screen
  const renderContent = () => {
    // 1. Cleaner Strict Boundary: Cleaners can ONLY see CleaningUploadScreen
    if (isCleaner) {
      return <CleaningUploadScreen onOpenMenu={() => setDrawerOpen(true)} />;
    }

    // 2. Marketer Strict Boundary: Marketers cannot access Cleaning or Admin screens
    if (isMarketer) {
      switch (activeRoute) {
        case 'dashboard':
          return (
            <DashboardScreen
              onOpenMenu={() => setDrawerOpen(true)}
              onNavigate={(screen) => setActiveRoute(screen)}
              onSelectAppointment={(apt) =>
                setSubscreen({ name: 'appointment_detail', params: { appointmentId: apt.id } })
              }
            />
          );
        case 'services':
          return <ServicesCatalogScreen onOpenMenu={() => setDrawerOpen(true)} />;
        case 'clients':
          return (
            <ClientsListScreen
              onAddClient={() => setSubscreen({ name: 'add_client' })}
              onSelectClient={(c) =>
                setSubscreen({ name: 'client_file', params: { clientId: c.id } })
              }
            />
          );
        case 'appointments':
          return (
            <AppointmentCalendarScreen
              onOpenMenu={() => setDrawerOpen(true)}
              onCreateAppointment={(prefill) =>
                setSubscreen({ name: 'create_appointment', params: prefill })
              }
              onSelectAppointment={(apt) =>
                setSubscreen({ name: 'appointment_detail', params: { appointmentId: apt.id } })
              }
            />
          );
        case 'invoices':
          return (
            <PendingInvoicesScreen
              onSelectInvoice={(inv) =>
                setSubscreen({ name: 'invoice_detail', params: { invoiceId: inv.id } })
              }
            />
          );
        case 'summary':
          return <TechnicianDailySummaryScreen onOpenMenu={() => setDrawerOpen(true)} />;
        default:
          return (
            <DashboardScreen
              onOpenMenu={() => setDrawerOpen(true)}
              onNavigate={(screen) => setActiveRoute(screen)}
              onSelectAppointment={(apt) =>
                setSubscreen({ name: 'appointment_detail', params: { appointmentId: apt.id } })
              }
            />
          );
      }
    }

    switch (activeRoute) {
      case 'dashboard':
        return (
          <DashboardScreen
            onOpenMenu={() => setDrawerOpen(true)}
            onNavigate={(screen) => setActiveRoute(screen)}
            onSelectAppointment={(apt) =>
              setSubscreen({ name: 'appointment_detail', params: { appointmentId: apt.id } })
            }
          />
        );

      case 'appointments':
        return (
          <AppointmentCalendarScreen
            onOpenMenu={() => setDrawerOpen(true)}
            onCreateAppointment={(prefill) =>
              setSubscreen({ name: 'create_appointment', params: prefill })
            }
            onSelectAppointment={(apt) =>
              setSubscreen({ name: 'appointment_detail', params: { appointmentId: apt.id } })
            }
          />
        );

      case 'clients':
        return (
          <ClientsListScreen
            onAddClient={() => setSubscreen({ name: 'add_client' })}
            onSelectClient={(c) =>
              setSubscreen({ name: 'client_file', params: { clientId: c.id } })
            }
          />
        );

      case 'invoices':
        return (
          <PendingInvoicesScreen
            onSelectInvoice={(inv) =>
              setSubscreen({ name: 'invoice_detail', params: { invoiceId: inv.id } })
            }
          />
        );

      case 'stock':
        return (
          <ServiceStockScreen
            onOpenMenu={() => setDrawerOpen(true)}
            onNavigateToStockPhotos={() => setActiveRoute('stock_photos')}
          />
        );

      case 'stock_photos':
        return <DailyStockPhotosScreen onOpenMenu={() => setDrawerOpen(true)} />;

      case 'retail':
        return <RetailProductsScreen onOpenMenu={() => setDrawerOpen(true)} />;

      case 'attendance':
        return <AttendanceScreen onOpenMenu={() => setDrawerOpen(true)} />;

      case 'summary':
        return <TechnicianDailySummaryScreen onOpenMenu={() => setDrawerOpen(true)} />;

      case 'cleaning':
        if (isCleaner) {
          return <CleaningUploadScreen onOpenMenu={() => setDrawerOpen(true)} />;
        }
        return <CleaningRecordsScreen onOpenMenu={() => setDrawerOpen(true)} />;

      case 'daily_close':
        return (
          <DailyCloseScreen
            onOpenMenu={() => setDrawerOpen(true)}
            onNavigate={(screen) => setActiveRoute(screen)}
          />
        );

      case 'reports':
        return <ReportsScreen onOpenMenu={() => setDrawerOpen(true)} />;

      case 'expenses':
        return <ExpensesScreen onOpenMenu={() => setDrawerOpen(true)} />;

      case 'staff':
        return <StaffManagementScreen onOpenMenu={() => setDrawerOpen(true)} />;

      case 'services':
        return <ServicesCatalogScreen onOpenMenu={() => setDrawerOpen(true)} />;

      case 'attendance_manager':
        return <AttendanceManagerScreen onOpenMenu={() => setDrawerOpen(true)} />;

      case 'job_seekers':
        return <JobSeekersScreen onOpenMenu={() => setDrawerOpen(true)} />;

      case 'shared_work':
        return <SharedWorkScreen onOpenMenu={() => setDrawerOpen(true)} />;

      case 'referrals':
        return <ReferralsScreen onOpenMenu={() => setDrawerOpen(true)} />;

      case 'rebooking':
        return <RebookingScreen onOpenMenu={() => setDrawerOpen(true)} />;

      case 'whatsapp':
      case 'whatsapp_automations':
      case 'growth_whatsapp':
        return <WhatsAppAutomationsScreen onOpenMenu={() => setDrawerOpen(true)} />;

      case 'social_media':
        return <SocialMediaScreen onOpenMenu={() => setDrawerOpen(true)} />;

      case 'loyalty':
      case 'loyalty_settings':
      case 'loyalty_feedback':
      case 'growth_loyalty':
        return <LoyaltySettingsScreen onOpenMenu={() => setDrawerOpen(true)} />;

      case 'client_feedback':
      case 'feedback':
      case 'growth_feedback':
        return <ClientFeedbackScreen onOpenMenu={() => setDrawerOpen(true)} />;

      default:
        return (
          <DashboardScreen
            onOpenMenu={() => setDrawerOpen(true)}
            onNavigate={(screen) => setActiveRoute(screen)}
            onSelectAppointment={(apt) =>
              setSubscreen({ name: 'appointment_detail', params: { appointmentId: apt.id } })
            }
          />
        );
    }
  };

  // Bottom Navigation Bar tabs based on role
  const getTabsForRole = () => {
    if (isCleaner) {
      return [];
    }
    if (isTechnician) {
      return [
        { id: 'appointments', label: 'Schedule', icon: Calendar },
        { id: 'summary', label: 'My Earnings', icon: TrendingUp },
        { id: 'attendance', label: 'Attendance', icon: Clock },
        { id: 'stock', label: 'Stock', icon: Package },
      ];
    }
    if (isMarketer) {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'clients', label: 'Clients', icon: Users },
        { id: 'appointments', label: 'Bookings', icon: Calendar },
        { id: 'summary', label: 'Commissions', icon: TrendingUp },
      ];
    }
    // Manager & Reception
    return [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'appointments', label: 'Schedule', icon: Calendar },
      { id: 'clients', label: 'Clients', icon: Users },
      { id: 'invoices', label: 'Invoices', icon: CreditCard },
      { id: 'stock', label: 'Stock', icon: Package },
    ];
  };

  const tabs = getTabsForRole();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Top AppShell Bar — Matches Web Software Mobile AppShell.jsx */}
      <View style={styles.appShellTopBar}>
        <TouchableOpacity
          onPress={() => setDrawerOpen(true)}
          style={styles.hamburgerBtn}
          activeOpacity={0.7}
        >
          <Menu size={22} color="#2D2D2A" />
        </TouchableOpacity>
        <Text style={styles.brandTitle}>OMEGA SPA</Text>
      </View>

      <View style={styles.content}>{renderContent()}</View>

      {/* Bottom Tabs for 1-tap switching (Hidden for Cleaner, matching Web Software) */}
      {!isCleaner && (
        <View style={styles.bottomBar}>
          {tabs.map((t) => {
            const isSelected = activeRoute === t.id;
            const Icon = t.icon;
            return (
              <TouchableOpacity
                key={t.id}
                activeOpacity={0.7}
                onPress={() => setActiveRoute(t.id)}
                style={styles.tabItem}
              >
                <Icon
                  size={22}
                  color={isSelected ? THEME.colors.primaryDark : THEME.colors.textMuted}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    isSelected && styles.tabLabelSelected,
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* More Menu Drawer Trigger */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setDrawerOpen(true)}
            style={styles.tabItem}
          >
            <Menu size={22} color={THEME.colors.textMuted} />
            <Text style={styles.tabLabel}>More</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Full Web-matching Navigation Drawer */}
      <SidebarDrawer
        visible={drawerOpen}
        activeRoute={activeRoute}
        onClose={() => setDrawerOpen(false)}
        onNavigate={(route) => setActiveRoute(route)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF7F2', // Warm Ivory (#FBF7F2) matching web app
  },
  appShellTopBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#F6F1EB', // Soft Cream (#F6F1EB) matching web AppShell.jsx
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D9',
  },
  hamburgerBtn: {
    width: 38,
    height: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2A',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.colors.background,
  },
  loadingText: {
    fontSize: 16,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.card,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    paddingVertical: 10,
    paddingBottom: 16,
    ...THEME.shadows.card,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
    marginTop: 4,
  },
  tabLabelSelected: {
    color: THEME.colors.primaryDark,
    fontWeight: '800',
  },
});
