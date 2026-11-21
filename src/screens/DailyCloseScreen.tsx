/**
 * DailyCloseScreen — 1-to-1 Match with Omega Spa POS Web Software
 * Matches frontend/src/pages/DailyClose.jsx & Web View Screenshot:
 * - Header: Title "Daily Close", Subtitle "End-of-day financial reconciliation and operations review."
 * - Closing Date Card:
 *     - Closing Date header (e.g., 5 Nov 2026)
 *     - "Real-time backend figures verified for end-of-day sign-off."
 *     - Manager Section:
 *         - [Phone icon] BOSS WHATSAPP NUMBER
 *         - Full-width phone input
 *         - Full-width [ 💬 Send to Boss WhatsApp ] button (Sage green, 44px height)
 *     - Reception Section (if reception role):
 *         - Verified tally note banner
 * - Financial Summary Card:
 *     - Header: [TrendingUp icon] Financial Summary
 *     - CA Total Box:
 *         - Left: CA TOTAL (REVENUE) -> X FCFA
 *         - Right: Completed Clients -> Y
 *     - Payment Breakdown:
 *         - [Banknote icon] Cash -> X FCFA
 *         - [Smartphone icon] MTN MoMo -> Y FCFA
 *         - [Smartphone icon] Orange Money -> Z FCFA
 *         - [Receipt icon] Today's Cash Expenses -> -W FCFA (if expenses > 0)
 *     - Revenue Per Technician (CA Per Technician):
 *         - Technician Name (X service(s)) -> Amount FCFA
 * - Operational Summary Card:
 *     - Header: [Users icon] Operational Summary
 *     - [Sparkles icon] Services Delivered -> Count
 *     - [UserPlus icon] Referral Clients Introduced -> Count
 *     - [Package icon] Service Stock Consumed -> Count units
 *     - [Camera icon] End-of-Day Stock Photo Proofs -> X photos (Y reviewed) [View]
 *     - [RefreshCw icon] Clients Due for Rebooking -> Count
 *     - End-of-Day Reconciliation Note box
 *
 * ZERO INVENTED CONTENT:
 * - No "Physical Drawer Count"
 * - No "Counted Cash / MoMo / Orange inputs"
 * - No "Net Drawer Balance"
 * - Exact 1-to-1 parity with web POS software.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  TrendingUp,
  MessageCircle,
  Banknote,
  Smartphone,
  Phone,
  Check,
  Package,
  UserPlus,
  Receipt,
  Users,
  Sparkles,
  Camera,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react-native';
import Header from '../components/Header';
import Card from '../components/Card';
import { useAuth } from '../context/AuthContext';
import { useInvoices } from '../context/InvoiceContext';
import { useExpenses } from '../context/ExpensesContext';
import { useClients } from '../context/ClientsContext';
import { useStock } from '../context/StockContext';
import { reportsApi, whatsappApi } from '../services/api';

interface DailyCloseScreenProps {
  onOpenMenu?: () => void;
  onNavigate?: (screen: string) => void;
}

export const DailyCloseScreen: React.FC<DailyCloseScreenProps> = ({ onOpenMenu, onNavigate }) => {
  const { user } = useAuth();
  const { invoices } = useInvoices();
  const { todayExpensesTotal = 0 } = useExpenses();
  const { clients } = useClients();
  const { dailyAudits = [] } = useStock();

  const role = (user?.role || '').toLowerCase();
  const isManager = role === 'manager';
  const isReception = role === 'reception';
  const canAccess = isManager || isReception;

  const [sent, setSent] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [bossPhone, setBossPhone] = useState<string>('+237676761349');

  // Live Backend Reports State
  const [dashboardSummary, setDashboardSummary] = useState<any>(null);
  const [revenueReport, setRevenueReport] = useState<any>(null);
  const [techniciansPerformance, setTechniciansPerformance] = useState<any[]>([]);
  const [stockConsumption, setStockConsumption] = useState<any>(null);
  const [customerAnalytics, setCustomerAnalytics] = useState<any>(null);
  const [loadingReports, setLoadingReports] = useState<boolean>(true);

  // Formatted today string matching Web: "5 Nov 2026"
  const today = useMemo(() => {
    return new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  const todayIso = useMemo(() => {
    return new Date().toISOString().slice(0, 10);
  }, []);

  // Load configured boss phone on mount (Manager & Reception only)
  useEffect(() => {
    if (!canAccess) return;
    let isMounted = true;
    whatsappApi
      .getBossPhone()
      .then((res: any) => {
        if (isMounted && res?.data?.bossPhone) {
          setBossPhone(res.data.bossPhone);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const handleBossPhoneBlur = async () => {
    if (!bossPhone || !bossPhone.trim()) return;
    try {
      await whatsappApi.updateBossPhone(bossPhone.trim());
    } catch (e: any) {
      console.warn('Could not sync boss phone to backend:', e?.message || e);
    }
  };

  // Fetch real reports analytics for today
  const fetchDailyReports = useCallback(async () => {
    if (!canAccess) return;
    setLoadingReports(true);
    try {
      const [dashRes, revRes, techRes, stockRes, custRes] = await Promise.allSettled([
        reportsApi.getDashboard('today'),
        reportsApi.getRevenue('today'),
        reportsApi.getTechnicians('today'),
        reportsApi.getStockConsumption ? reportsApi.getStockConsumption('today') : Promise.resolve(null),
        reportsApi.getCustomers ? reportsApi.getCustomers('today') : Promise.resolve(null),
      ]);

      if (dashRes.status === 'fulfilled' && (dashRes.value as any)?.data) {
        setDashboardSummary((dashRes.value as any).data);
      }
      if (revRes.status === 'fulfilled' && (revRes.value as any)?.data) {
        setRevenueReport((revRes.value as any).data);
      }
      if (techRes.status === 'fulfilled' && (techRes.value as any)?.data) {
        setTechniciansPerformance((techRes.value as any).data.technicians || []);
      }
      if (stockRes.status === 'fulfilled' && (stockRes.value as any)?.data) {
        setStockConsumption((stockRes.value as any).data);
      }
      if (custRes.status === 'fulfilled' && (custRes.value as any)?.data) {
        setCustomerAnalytics((custRes.value as any).data);
      }
    } catch (err: any) {
      console.warn('Daily close fetch error:', err?.message || err);
    } finally {
      setLoadingReports(false);
    }
  }, [canAccess]);

  useEffect(() => {
    fetchDailyReports();
  }, [fetchDailyReports]);

  // Derived financial figures matching DailyClose.jsx
  const todayPaidInvoices = useMemo(() => {
    return (invoices || []).filter((inv: any) => {
      if (inv.status !== 'PAID') return false;
      const invDate = String(inv.date || inv.paidAt || inv.createdAt || '');
      return (
        invDate.startsWith(todayIso) ||
        invDate.includes(today) ||
        invDate === 'Today'
      );
    });
  }, [invoices, todayIso, today]);

  const isCash = (p: string) => {
    const s = String(p || '').toUpperCase();
    return s === 'CASH' || s.includes('CASH');
  };
  const isMtn = (p: string) => {
    const s = String(p || '').toUpperCase();
    return s.includes('MTN') || s === 'MOMO';
  };
  const isOrange = (p: string) => {
    const s = String(p || '').toUpperCase();
    return s.includes('ORANGE');
  };

  const parseNum = (v: any) => {
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    return parseInt(String(v || '0').replace(/[^0-9]/g, ''), 10) || 0;
  };

  const invoiceCash = todayPaidInvoices
    .filter((inv: any) => isCash(inv.paymentMethod))
    .reduce((sum: number, inv: any) => sum + parseNum(inv.finalTotal ?? inv.paidAmount ?? inv.total), 0);

  const invoiceMtn = todayPaidInvoices
    .filter((inv: any) => isMtn(inv.paymentMethod))
    .reduce((sum: number, inv: any) => sum + parseNum(inv.finalTotal ?? inv.paidAmount ?? inv.total), 0);

  const invoiceOrange = todayPaidInvoices
    .filter((inv: any) => isOrange(inv.paymentMethod))
    .reduce((sum: number, inv: any) => sum + parseNum(inv.finalTotal ?? inv.paidAmount ?? inv.total), 0);

  // Real payment values: merge backend report with live invoices to avoid under-counting
  const methods = revenueReport?.paymentMethodBreakdown || revenueReport?.byPaymentMethod || [];
  const backendCash = methods.find((m: any) => m.method === 'CASH')?.amount;
  const backendMtn = methods.find((m: any) => m.method === 'MTN_MOMO' || m.method === 'MOMO')?.amount;
  const backendOrange = methods.find((m: any) => m.method === 'ORANGE_MONEY')?.amount;

  const cashTotal = Math.max(backendCash ?? 0, invoiceCash);
  const mtnTotal = Math.max(backendMtn ?? 0, invoiceMtn);
  const orangeTotal = Math.max(backendOrange ?? 0, invoiceOrange);

  // CA Total
  const backendTotal = dashboardSummary?.cards?.totalRevenue ?? revenueReport?.totalRevenue;
  const caTotal = Math.max(backendTotal ?? 0, cashTotal + mtnTotal + orangeTotal);

  // Unique clients count
  const invoiceClients = new Set(
    todayPaidInvoices.map((inv: any) => inv.clientName || inv.clientId).filter(Boolean)
  ).size;
  const backendClients = dashboardSummary?.cards?.completedServices || 0;
  const uniqueClientsCount = Math.max(backendClients, invoiceClients, todayPaidInvoices.length);

  // Technician Breakdown: combine backend performance report with live invoices
  const techBreakdown = useMemo(() => {
    const map: { [key: string]: { id: string; name: string; total: number; count: number } } = {};

    if (techniciansPerformance && techniciansPerformance.length > 0) {
      techniciansPerformance.forEach((t: any, idx: number) => {
        const name = t.technicianName || 'Other';
        const key = t.technicianId || name;
        if (!map[key]) {
          map[key] = {
            id: key || `tech-${idx}`,
            name,
            total: 0,
            count: 0,
          };
        }
        map[key].total += Number(t.revenueGenerated || 0);
        map[key].count += Number(t.servicesCompleted || 0);
      });
    }

    // Include service items from today's paid invoices if not fully represented
    todayPaidInvoices.forEach((inv: any) => {
      (inv.items || []).forEach((item: any) => {
        if (item.type === 'drink' || item.type === 'cosmetic') return;
        const techName = item.technician || inv.technicianName || inv.technician || 'Staff';
        if (techName === 'Reception' || techName === 'Other') return;
        const key = item.technicianId || techName;
        const itemPrice = parseNum(item.price);
        if (!map[key]) {
          map[key] = {
            id: key,
            name: techName,
            total: 0,
            count: 0,
          };
        }
        if (!techniciansPerformance || techniciansPerformance.length === 0) {
          map[key].total += itemPrice;
          map[key].count += Math.max(1, parseInt(item.quantity || item.qty, 10) || 1);
        }
      });
    });

    return Object.values(map);
  }, [techniciansPerformance, todayPaidInvoices]);

  // Operational metrics
  const servicesDelivered = dashboardSummary?.cards?.completedServices ?? todayPaidInvoices.length;

  const referralsToday = useMemo(() => {
    if (dashboardSummary?.cards?.referralsToday !== undefined) {
      return dashboardSummary.cards.referralsToday;
    }
    return (clients || []).filter((c: any) => {
      const hasRef = Boolean(c.introducedBy || c.introducedById || c.referredByClientId);
      const isToday = (c.createdAt && c.createdAt.includes(todayIso)) || c.registeredDate === today;
      return hasRef && isToday;
    }).length;
  }, [clients, dashboardSummary, today, todayIso]);

  const consumedStockCount = useMemo(() => {
    if (stockConsumption?.items && Array.isArray(stockConsumption.items)) {
      return stockConsumption.items.reduce(
        (sum: number, item: any) => sum + (item.totalConsumed || 0),
        0
      );
    }
    return stockConsumption?.totalItemsConsumed || 0;
  }, [stockConsumption]);

  const stockAuditsCount = dailyAudits.length;
  const reviewedAuditsCount = dailyAudits.filter(
    (a: any) => a.status === 'APPROVED' || a.status === 'REVIEWED'
  ).length;

  const clientsNotRebooked = useMemo(() => {
    if (customerAnalytics?.rebookingStatus?.due !== undefined) {
      return customerAnalytics.rebookingStatus.due;
    }
    return (clients || []).filter((c: any) => {
      if (!c.lastVisit || c.lastVisit === '—') return false;
      const visitDate = new Date(c.lastVisit);
      if (isNaN(visitDate.getTime())) return false;
      const daysSince = (Date.now() - visitDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince > 14;
    }).length;
  }, [clients, customerAnalytics]);

  // Handle Send to Boss WhatsApp
  const handleSend = async () => {
    const cleanPhone = (bossPhone || '').trim();
    if (!cleanPhone || cleanPhone.replace(/[^\d]/g, '').length < 8) {
      setSendError('Please enter a valid Boss WhatsApp phone number (e.g. +2376XXXXXXXX or +91...).');
      setTimeout(() => setSendError(null), 6000);
      return;
    }

    setSending(true);
    setSendError(null);
    try {
      await whatsappApi.updateBossPhone(cleanPhone).catch(() => {});
      const res = await whatsappApi.triggerDailyClose({
        businessDate: todayIso,
        recipientPhone: cleanPhone,
      });

      const resData = res?.data?.data || res?.data || res;
      if (resData?.log?.status === 'FAILED') {
        throw new Error(resData?.log?.failureReason || 'WhatsApp delivery failed at provider');
      }

      setSent(true);
      setTimeout(() => setSent(false), 6000);
      Alert.alert(
        'Daily Close Sent',
        `Official End-of-Day reconciliation successfully dispatched to Boss WhatsApp (${cleanPhone})!`
      );
    } catch (err: any) {
      console.error('Daily close send error:', err);
      const msg = err?.message || 'Failed to send daily close summary';
      setSendError(msg);
      setTimeout(() => setSendError(null), 8000);
      Alert.alert('Send Error', msg);
    } finally {
      setSending(false);
    }
  };

  // RBAC Access Guard
  if (!canAccess) {
    return (
      <View style={styles.container}>
        <Header
          title="Daily Close"
          subtitle="End-of-day financial reconciliation and operations review."
          onOpenMenu={onOpenMenu}
        />
        <View style={styles.accessDeniedCard}>
          <View style={styles.accessDeniedIconWrap}>
            <ShieldAlert size={28} color="#DC2626" />
          </View>
          <Text style={styles.accessDeniedTitle}>Access Denied (403)</Text>
          <Text style={styles.accessDeniedText}>
            Daily Close financial summary is restricted to Management and Reception staff.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. Page Header — Exact match with Web View */}
      <Header
        title="Daily Close"
        subtitle="End-of-day financial reconciliation and operations review."
        onOpenMenu={onOpenMenu}
        rightAction={
          <TouchableOpacity onPress={fetchDailyReports} style={styles.refreshBtn} activeOpacity={0.8}>
            <RotateCcw size={14} color="#4F6748" />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loadingReports} onRefresh={fetchDailyReports} tintColor="#4F6748" />
        }
      >
        {/* 2. Top Card: Closing Date & Send to Boss WhatsApp (Exact 1:1 Match with Web View) */}
        <Card style={styles.topCard}>
          <View style={styles.closingDateSection}>
            <Text style={styles.closingDateLabel}>CLOSING DATE</Text>
            <Text style={styles.closingDateTitle}>{today}</Text>
            <Text style={styles.closingDateSub}>
              Real-time backend figures verified for end-of-day sign-off.
            </Text>
          </View>

          {isManager ? (
            <View style={styles.bossSection}>
              {/* Boss Phone Label with Phone Icon */}
              <View style={styles.bossPhoneLabelRow}>
                <Phone size={11} color="#4F6748" />
                <Text style={styles.bossPhoneLabel}>BOSS WHATSAPP NUMBER</Text>
              </View>

              {/* Full-width Phone Input */}
              <TextInput
                value={bossPhone}
                onChangeText={setBossPhone}
                onBlur={handleBossPhoneBlur}
                placeholder="+2376XXXXXXXX or +91..."
                placeholderTextColor="#A1A1AA"
                style={styles.bossPhoneInput}
                keyboardType="phone-pad"
              />

              {/* Full-width "Send to Boss WhatsApp" Button */}
              <TouchableOpacity
                onPress={handleSend}
                disabled={sending || sent || !bossPhone.trim()}
                style={[
                  styles.sendBossBtn,
                  sent && styles.sendBossBtnSuccess,
                  (!bossPhone.trim() || sending) && styles.sendBossBtnDisabled,
                ]}
                activeOpacity={0.85}
              >
                {sent ? (
                  <>
                    <Check size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.sendBossBtnText}>Sent to Boss WhatsApp</Text>
                  </>
                ) : sending ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.sendBossBtnText}>Sending...</Text>
                  </>
                ) : (
                  <>
                    <MessageCircle size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.sendBossBtnText}>Send to Boss WhatsApp</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.receptionNoteBox}>
              <View style={styles.receptionGreenDot} />
              <Text style={styles.receptionNoteText}>
                Reception View: Verified end-of-day tally. Official dispatch to Boss is handled by General Manager.
              </Text>
            </View>
          )}

          {sendError && (
            <View style={styles.sendErrorBox}>
              <Text style={styles.sendErrorText}>{sendError}</Text>
            </View>
          )}
        </Card>

        {/* 3. Financial Summary Card (Exact 1:1 Match with Web View) */}
        <Card style={styles.sectionCard}>
          {/* Card Header with Divider */}
          <View style={styles.cardHeaderRow}>
            <TrendingUp size={18} color="#4F6748" />
            <Text style={styles.cardHeaderTitle}>Financial Summary</Text>
          </View>

          {/* CA Total Box */}
          <View style={styles.caTotalBox}>
            <View>
              <Text style={styles.caTotalLabel}>CA TOTAL (REVENUE)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 2 }}>
                <Text style={styles.caTotalAmount}>{caTotal.toLocaleString('en-US')}</Text>
                <Text style={styles.caTotalUnit}> FCFA</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.caClientsLabel}>Completed Clients</Text>
              <Text style={styles.caClientsCount}>{uniqueClientsCount}</Text>
            </View>
          </View>

          {/* Payment Breakdown Rows */}
          <View style={styles.breakdownSection}>
            <Text style={styles.breakdownTitle}>PAYMENT BREAKDOWN</Text>

            {/* Cash */}
            <View style={styles.paymentRow}>
              <View style={styles.paymentMethodLeft}>
                <Banknote size={16} color="#4F6748" />
                <Text style={styles.paymentMethodName}>Cash</Text>
              </View>
              <Text style={styles.paymentMethodAmount}>{cashTotal.toLocaleString('en-US')} FCFA</Text>
            </View>

            {/* MTN MoMo */}
            <View style={styles.paymentRow}>
              <View style={styles.paymentMethodLeft}>
                <Smartphone size={16} color="#4F6748" />
                <Text style={styles.paymentMethodName}>MTN MoMo</Text>
              </View>
              <Text style={styles.paymentMethodAmount}>{mtnTotal.toLocaleString('en-US')} FCFA</Text>
            </View>

            {/* Orange Money */}
            <View style={styles.paymentRow}>
              <View style={styles.paymentMethodLeft}>
                <Smartphone size={16} color="#4F6748" />
                <Text style={styles.paymentMethodName}>Orange Money</Text>
              </View>
              <Text style={styles.paymentMethodAmount}>{orangeTotal.toLocaleString('en-US')} FCFA</Text>
            </View>

            {/* Today's Cash Expenses (conditional on todayExpensesTotal > 0) */}
            {todayExpensesTotal > 0 && (
              <View style={styles.expenseRow}>
                <View style={styles.paymentMethodLeft}>
                  <Receipt size={16} color="#E11D48" />
                  <Text style={styles.expenseLabel}>Today's Cash Expenses</Text>
                </View>
                <Text style={styles.expenseAmount}>
                  -{todayExpensesTotal.toLocaleString('en-US')} FCFA
                </Text>
              </View>
            )}
          </View>

          {/* Revenue Per Technician (Inside Financial Summary, matching Web) */}
          <View style={styles.techSection}>
            <Text style={styles.breakdownTitle}>REVENUE PER TECHNICIAN</Text>
            {techBreakdown.length === 0 ? (
              <Text style={styles.emptyTechText}>No technician revenue recorded today.</Text>
            ) : (
              techBreakdown.map((t, idx) => (
                <View key={t.id || `${t.name}-${idx}`} style={styles.techRow}>
                  <Text style={styles.techName}>
                    {t.name}{' '}
                    <Text style={styles.techCount}>
                      ({t.count} service{t.count !== 1 ? 's' : ''})
                    </Text>
                  </Text>
                  <Text style={styles.techRevenue}>{t.total.toLocaleString('en-US')} FCFA</Text>
                </View>
              ))
            )}
          </View>
        </Card>

        {/* 4. Operational Summary Card (Exact 1:1 Match with Web View) */}
        <Card style={styles.sectionCard}>
          {/* Card Header with Divider */}
          <View style={styles.cardHeaderRow}>
            <Users size={18} color="#4F6748" />
            <Text style={styles.cardHeaderTitle}>Operational Summary</Text>
          </View>

          {/* Metrics Rows */}
          <View style={styles.opsList}>
            {/* Services Delivered */}
            <View style={styles.opsRow}>
              <View style={styles.opsLeft}>
                <Sparkles size={16} color="#4F6748" />
                <Text style={styles.opsLabel}>Services Delivered</Text>
              </View>
              <Text style={styles.opsValue}>{servicesDelivered}</Text>
            </View>

            {/* Referral Clients Introduced */}
            <View style={styles.opsRow}>
              <View style={styles.opsLeft}>
                <UserPlus size={16} color="#4F6748" />
                <Text style={styles.opsLabel}>Referral Clients Introduced</Text>
              </View>
              <Text style={styles.opsValue}>{referralsToday}</Text>
            </View>

            {/* Service Stock Consumed */}
            <View style={styles.opsRow}>
              <View style={styles.opsLeft}>
                <Package size={16} color="#4F6748" />
                <Text style={styles.opsLabel}>Service Stock Consumed</Text>
              </View>
              <Text style={styles.opsValue}>{consumedStockCount} units</Text>
            </View>

            {/* End-of-Day Stock Photo Proofs */}
            <View style={styles.opsRow}>
              <View style={styles.opsLeft}>
                <Camera size={16} color="#4F6748" />
                <Text style={styles.opsLabel}>End-of-Day Stock Photo Proofs</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.opsValue}>
                  {stockAuditsCount} photo{stockAuditsCount !== 1 ? 's' : ''} ({reviewedAuditsCount} reviewed)
                </Text>
                {onNavigate && (
                  <TouchableOpacity onPress={() => onNavigate('stock_photos')}>
                    <Text style={styles.viewPhotosLink}>View</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Clients Due for Rebooking */}
            <View style={[styles.opsRow, { borderBottomWidth: 0 }]}>
              <View style={styles.opsLeft}>
                <RefreshCw size={16} color="#4F6748" />
                <Text style={styles.opsLabel}>Clients Due for Rebooking</Text>
              </View>
              <Text style={styles.opsValue}>{clientsNotRebooked}</Text>
            </View>
          </View>

          {/* End-of-Day Reconciliation Note */}
          <View style={styles.noteBox}>
            <Text style={styles.noteTitle}>End-of-Day Reconciliation Note</Text>
            <Text style={styles.noteBody}>
              Daily Close reconciles completed appointments, invoice payment channels, technician revenue attribution, and service stock deductions.
            </Text>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
    gap: 16,
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0ECE4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessDeniedCard: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  accessDeniedIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  accessDeniedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D2D2A',
    marginBottom: 6,
  },
  accessDeniedText: {
    fontSize: 13,
    color: '#71717A',
    textAlign: 'center',
  },

  /* 2. Top Card */
  topCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    gap: 14,
  },
  closingDateSection: {
    gap: 2,
  },
  closingDateLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#71717A',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  closingDateTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2D2D2A',
    marginTop: 2,
  },
  closingDateSub: {
    fontSize: 12,
    color: '#71717A',
    marginTop: 2,
  },
  bossSection: {
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0EAE1',
  },
  bossPhoneLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bossPhoneLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#71717A',
    letterSpacing: 0.6,
  },
  bossPhoneInput: {
    height: 44,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  sendBossBtn: {
    height: 44,
    backgroundColor: '#94A78A',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBossBtnSuccess: {
    backgroundColor: '#16A34A',
  },
  sendBossBtnDisabled: {
    opacity: 0.6,
  },
  sendBossBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  receptionNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: '#FAF8F5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  receptionGreenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4F6748',
  },
  receptionNoteText: {
    fontSize: 11,
    color: '#2D2D2A',
    fontWeight: '500',
    flex: 1,
  },
  sendErrorBox: {
    padding: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 8,
  },
  sendErrorText: {
    fontSize: 11,
    color: '#B91C1C',
    fontWeight: '600',
  },

  /* 3. Section Cards */
  sectionCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    gap: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EAE1',
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D2D2A',
  },

  /* CA Total Box */
  caTotalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 12,
    padding: 14,
  },
  caTotalLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#71717A',
    letterSpacing: 0.6,
  },
  caTotalAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#4F6748',
  },
  caTotalUnit: {
    fontSize: 12,
    fontWeight: '500',
    color: '#71717A',
  },
  caClientsLabel: {
    fontSize: 11,
    color: '#71717A',
    marginBottom: 2,
  },
  caClientsCount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D2D2A',
  },

  /* Payment Breakdown */
  breakdownSection: {
    gap: 7,
  },
  breakdownTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#71717A',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF8F5',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  paymentMethodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentMethodName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  paymentMethodAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FFE4E6',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  expenseLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#BE123C',
  },
  expenseAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#BE123C',
  },

  /* Revenue Per Technician */
  techSection: {
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0EAE1',
  },
  emptyTechText: {
    fontSize: 12,
    color: '#71717A',
    textAlign: 'center',
    paddingVertical: 6,
  },
  techRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  techName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  techCount: {
    fontSize: 11,
    fontWeight: '400',
    color: '#71717A',
  },
  techRevenue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F6748',
  },

  /* Operational Summary */
  opsList: {
    gap: 0,
  },
  opsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F4EFEB',
  },
  opsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  opsLabel: {
    fontSize: 13,
    color: '#71717A',
    fontWeight: '500',
  },
  opsValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  viewPhotosLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F6748',
    textDecorationLine: 'underline',
  },

  /* Note Box */
  noteBox: {
    backgroundColor: '#FAF8F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    padding: 12,
    gap: 3,
  },
  noteTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  noteBody: {
    fontSize: 11,
    color: '#71717A',
    lineHeight: 15,
  },
});

export default DailyCloseScreen;
