/**
 * PendingInvoicesScreen — 1-to-1 Match with Omega Spa POS PendingInvoices.jsx
 * Matches frontend/src/pages/PendingInvoices.jsx & Web View Screenshot:
 * - Header: "Invoices" + Subtitle + Refresh button
 * - 3 Metric Cards:
 *     1. PENDING (e.g. 10)
 *     2. PAID TODAY (e.g. 2)
 *     3. HISTORY (e.g. 128)
 * - 3 Tabs:
 *     1. Pending      → Review, loyalty redemption, payment collection
 *     2. Paid Today   → All invoices paid today with quick receipt reprint
 *     3. History      → Simple historical paid invoices archive
 * - Accordion invoice cards matching Web View:
 *     - Green check circle / Orange document icon
 *     - Invoice # pill badge + Client name + Paid/Created time
 *     - Service list + Tech pill badge
 *     - Price in FCFA + Payment method (e.g. ORANGE MONEY) + Paid badge + Chevron
 *     - Expandable inline details with itemized breakdown & action buttons
 * - Settle Payment Modal & Official Receipt Modal
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
  TextInput,
  Linking,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  FileText,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  CreditCard,
  CheckCircle2,
  DollarSign,
  Printer,
  MessageCircle,
  X,
  Search,
  Check,
  User,
  RotateCcw,
  Sparkles,
  Star,
  AlertCircle,
  ShoppingBag,
  AlertTriangle,
  Lock,
} from 'lucide-react-native';
import NewRetailSaleModal from '../components/NewRetailSaleModal';
import NewWalkInServiceModal from '../components/NewWalkInServiceModal';
import THEME from '../constants/theme';
import Header from '../components/Header';
import { formatFCFA } from '../utils/currency';
import { formatDate } from '../utils/date';
import { useInvoices, Invoice, formatPaymentMethod } from '../context/InvoiceContext';
import { useAuth, isMarketerUser } from '../context/AuthContext';
import { useClients } from '../context/ClientsContext';
import { whatsappApi, API_BASE_URL } from '../services/api';

interface PendingInvoicesScreenProps {
  onSelectInvoice?: (invoice: Invoice) => void;
  onOpenMenu?: () => void;
}

const PAYMENT_METHODS = [
  { key: 'CASH', label: 'CASH' },
  { key: 'MTN_MOMO', label: 'MTN MOMO' },
  { key: 'ORANGE_MONEY', label: 'ORANGE MONEY' },
];

export const PendingInvoicesScreen: React.FC<PendingInvoicesScreenProps> = ({
  onSelectInvoice,
  onOpenMenu,
}) => {
  const { user } = useAuth();
  const { clients } = useClients();
  const {
    invoices,
    pendingInvoices,
    paidTodayInvoices,
    historyInvoices,
    loading,
    refreshInvoices,
    collectPayment,
    recordSplitPayment,
    sendWhatsAppReceipt,
  } = useInvoices();

  const [activeTab, setActiveTab] = useState<'PENDING' | 'PAID_TODAY' | 'HISTORY'>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const userRole = (user?.role || '').toLowerCase();
  const isTechnician = userRole === 'technician';
  const isMarketer = userRole === 'marketer' || isMarketerUser(user);
  const canCollectPayment = (userRole === 'manager' || userRole === 'reception' || userRole === 'receptionist') && !isMarketer;
  const canSellRetail = (userRole === 'manager' || userRole === 'reception' || userRole === 'receptionist') && !isMarketer;
  const canCreateInvoice = userRole === 'manager' || userRole === 'reception' || userRole === 'receptionist' || isMarketer || isTechnician;

  // Filter invoices for Marketer and Technician (Exact match with Web Software PendingInvoices.jsx)
  const myUserId = user?.id;
  const myUserName = (user?.name || '').trim().toLowerCase();

  const filterForUserRole = useCallback(
    (list: Invoice[]) => {
      const matchName = (name: any) => {
        if (!name || !myUserName) return false;
        const str = String(name).trim().toLowerCase();
        return str === myUserName || str.includes(myUserName) || myUserName.includes(str);
      };

      if (isTechnician) {
        return (list || []).filter((inv: any) => {
          if (inv.technicianId && String(inv.technicianId) === String(myUserId)) return true;
          if (inv.mainTechnicianId && String(inv.mainTechnicianId) === String(myUserId)) return true;
          if (inv.createdById && String(inv.createdById) === String(myUserId)) return true;
          if (inv.technician && matchName(inv.technician)) return true;
          if (inv.technicianName && matchName(inv.technicianName)) return true;
          if (inv.mainTechnicianName && matchName(inv.mainTechnicianName)) return true;
          if (Array.isArray(inv.items)) {
            return inv.items.some(
              (it: any) =>
                (it.technicianId && String(it.technicianId) === String(myUserId)) ||
                (it.technician && matchName(it.technician))
            );
          }
          return false;
        });
      }

      if (isMarketer) {
        // Find all client IDs introduced by this marketer
        const myClientIds = new Set(
          (clients || [])
            .filter(
              (c: any) =>
                (c.introducedById && String(c.introducedById) === String(myUserId)) ||
                (c.introducedBy && matchName(c.introducedBy))
            )
            .map((c: any) => String(c.id))
        );

        return (list || []).filter((inv: any) => {
          // 1. Created by this marketer
          if (inv.createdById && String(inv.createdById) === String(myUserId)) return true;
          // 2. Direct introducedBy attribute on invoice
          if (inv.introducedById && String(inv.introducedById) === String(myUserId)) return true;
          if (inv.introducedBy && matchName(inv.introducedBy)) return true;
          // 3. Client belongs to this marketer
          if (inv.clientId && myClientIds.has(String(inv.clientId))) return true;
          if (
            inv.client &&
            ((inv.client.introducedByEmployeeId &&
              String(inv.client.introducedByEmployeeId) === String(myUserId)) ||
              (inv.client.introducedBy && matchName(inv.client.introducedBy)))
          ) {
            return true;
          }
          return false;
        });
      }

      return list || [];
    },
    [isTechnician, isMarketer, myUserId, myUserName, clients]
  );

  const filteredPending = useMemo(() => filterForUserRole(pendingInvoices), [pendingInvoices, filterForUserRole]);
  const filteredPaidToday = useMemo(() => filterForUserRole(paidTodayInvoices), [paidTodayInvoices, filterForUserRole]);
  const filteredHistory = useMemo(() => filterForUserRole(historyInvoices), [historyInvoices, filterForUserRole]);

  // Modals for Retail Sale and New Walk-In Service
  const [showRetailSaleModal, setShowRetailSaleModal] = useState(false);
  const [showNewServiceModal, setShowNewServiceModal] = useState(false);

  // Settle Payment Modal State
  const [settlingInvoice, setSettlingInvoice] = useState<Invoice | null>(null);
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'CASH' | 'MTN_MOMO' | 'ORANGE_MONEY'>('CASH');
  const [splitCash, setSplitCash] = useState<string>('');
  const [splitMomo, setSplitMomo] = useState<string>('');
  const [splitOrange, setSplitOrange] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<string>('0');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Receipt Preview Modal State
  const [receiptInvoice, setReceiptInvoice] = useState<Invoice | null>(null);
  const [sendingWhatsAppId, setSendingWhatsAppId] = useState<string | null>(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  // WhatsApp Phone Number Prompt Modal (for Walk-in clients without phone on file)
  const [phonePromptInvoice, setPhonePromptInvoice] = useState<Invoice | null>(null);
  const [promptPhoneNumber, setPromptPhoneNumber] = useState<string>('+237 ');



  // Toggle Accordion expand/collapse
  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Displayed invoices based on active tab and search
  const displayedInvoices = useMemo(() => {
    let list: Invoice[] = [];
    if (activeTab === 'PENDING') {
      list = filteredPending;
    } else if (activeTab === 'PAID_TODAY') {
      list = filteredPaidToday;
    } else {
      list = filteredHistory;
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.clientName.toLowerCase().includes(q) ||
        inv.clientPhone.includes(q) ||
        (inv.technicianName && inv.technicianName.toLowerCase().includes(q)) ||
        inv.items.some((it) => it.name.toLowerCase().includes(q))
    );
  }, [activeTab, filteredPending, filteredPaidToday, filteredHistory, searchQuery]);

  const handleOpenSettle = (inv: Invoice) => {
    setSettlingInvoice(inv);
    setIsSplitMode(false);
    setSelectedMethod('CASH');
    setSplitCash('');
    setSplitMomo('');
    setSplitOrange('');
    setDiscountAmount('0');
  };

  const handleConfirmPayment = async () => {
    if (!settlingInvoice) return;
    setIsSubmitting(true);
    try {
      const disc = Number(discountAmount) || 0;
      const paidSoFar = (settlingInvoice.payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
      const remainingDue = Math.max(0, (settlingInvoice.total || 0) - paidSoFar);
      const netPayable = Math.max(0, remainingDue - disc);

      if (isSplitMode) {
        const cashVal = parseInt(splitCash.replace(/[^0-9]/g, ''), 10) || 0;
        const momoVal = parseInt(splitMomo.replace(/[^0-9]/g, ''), 10) || 0;
        const orangeVal = parseInt(splitOrange.replace(/[^0-9]/g, ''), 10) || 0;
        const totalSplit = cashVal + momoVal + orangeVal;

        if (totalSplit !== netPayable) {
          Alert.alert(
            'Invalid Split Amount',
            `Total split payments (${formatFCFA(totalSplit)}) must match Net Payable (${formatFCFA(netPayable)}).`
          );
          setIsSubmitting(false);
          return;
        }

        const splitList: { method: 'CASH' | 'MTN_MOMO' | 'ORANGE_MONEY'; amount: number }[] = [];
        if (cashVal > 0) splitList.push({ method: 'CASH', amount: cashVal });
        if (momoVal > 0) splitList.push({ method: 'MTN_MOMO', amount: momoVal });
        if (orangeVal > 0) splitList.push({ method: 'ORANGE_MONEY', amount: orangeVal });

        await recordSplitPayment(settlingInvoice.id, splitList, '', disc);
      } else {
        await collectPayment(settlingInvoice.id, netPayable, selectedMethod, '');
      }

      setIsSubmitting(false);
      const paidInv = settlingInvoice;
      setSettlingInvoice(null);
      setActiveTab('PAID_TODAY');
      setExpandedId(paidInv.id);
      refreshInvoices();

      // Feedback link is automatically dispatched by backend on payment collect
      if (paidInv.clientPhone) {
        Alert.alert(
          'Payment Settled',
          `Invoice #${paidInv.invoiceNumber} is marked PAID.\nFeedback rating link dispatched to ${paidInv.clientName} on WhatsApp.`,
          [
            { text: 'Done', style: 'cancel' },
            {
              text: 'Print / Download PDF',
              onPress: () => handlePrintReceipt(paidInv),
            },
            {
              text: 'WhatsApp Receipt',
              onPress: () => handleSendWhatsApp(paidInv),
            },
          ]
        );
      } else {
        Alert.alert('Payment Settled', `Invoice #${paidInv.invoiceNumber} marked as PAID.`, [
          { text: 'Done', style: 'cancel' },
          {
            text: 'Print / Download PDF',
            onPress: () => handlePrintReceipt(paidInv),
          },
        ]);
      }
    } catch (e: any) {
      setIsSubmitting(false);
      Alert.alert('Payment Error', e?.message || 'Could not settle payment.');
    }
  };

  const executeSendWhatsApp = async (inv: Invoice, targetPhone: string) => {
    setSendingWhatsAppId(inv.id);
    try {
      await whatsappApi.sendInvoicePdf(inv.id, targetPhone);
      inv.clientPhone = targetPhone;
      (inv as any).phone = targetPhone;
      Alert.alert(
        'Receipt Sent Successfully! 🌿',
        `Official PDF invoice receipt for Invoice #${inv.invoiceNumber} has been delivered to ${inv.clientName} (${targetPhone}) via WhatsApp!`
      );
    } catch (err: any) {
      const errorMsg = err?.message || 'Delivery error';
      Alert.alert(
        'Delivery Issue',
        `Meta Cloud API could not deliver the PDF receipt (${errorMsg}). Would you like to share via WhatsApp app instead?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open WhatsApp App',
            onPress: () => {
              const cleanPhone = targetPhone.replace(/[^0-9]/g, '');
              const itemsSummary = (inv.items || []).map((i) => `• ${i.name} (${formatFCFA(i.price)})`).join('\n');
              const msg =
                `*OMEGA SPA DOUALA — RECEIPT*\n` +
                `----------------------------------------\n` +
                `Facture / Invoice: #${inv.invoiceNumber}\n` +
                `Client: ${inv.clientName}\n` +
                `Date: ${inv.date || formatDate(inv.createdAt, 'dd MMM yyyy')}\n\n` +
                `*Prestations / Services:*\n${itemsSummary}\n\n` +
                `----------------------------------------\n` +
                `*Total Payé / Paid:* ${formatFCFA(inv.total)}\n` +
                `*Mode de Paiement:* ${formatPaymentMethod(inv.paymentMethod)}\n` +
                `----------------------------------------\n` +
                `_Merci pour votre visite chez OMEGA SPA !_ 🌿\n` +
                `📍 *Adresse :* Round point maetur Bonamousadi, Douala\n` +
                `📞 *Réservation directe :* +237 6 53 14 62 69`;

              const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
              Linking.openURL(url).catch(() => {
                Alert.alert('Error', 'Could not open WhatsApp.');
              });
            },
          },
        ]
      );
    } finally {
      setSendingWhatsAppId(null);
    }
  };

  const handleSendWhatsApp = async (inv: Invoice) => {
    const targetPhone = inv.clientPhone || (inv as any).phone;
    if (!targetPhone || !targetPhone.trim()) {
      setPhonePromptInvoice(inv);
      setPromptPhoneNumber('+237 ');
      return;
    }
    await executeSendWhatsApp(inv, targetPhone.trim());
  };

  const handleConfirmPhonePrompt = async () => {
    if (!phonePromptInvoice) return;
    const clean = promptPhoneNumber.trim();
    if (!clean || clean === '+237' || clean === '+237 ') {
      Alert.alert(
        'Invalid Phone Number',
        'Please enter a valid WhatsApp number (e.g. +237 6XXXXXXXX).'
      );
      return;
    }
    const inv = phonePromptInvoice;
    setPhonePromptInvoice(null);
    await executeSendWhatsApp(inv, clean);
  };

  const handlePrintReceipt = async (inv: Invoice) => {
    try {
      setDownloadingPdfId(inv.id);
      const targetId = inv.id || inv.invoiceNumber;
      const pdfUrl = `${API_BASE_URL}/invoices/${encodeURIComponent(targetId)}/pdf`;
      const supported = await Linking.canOpenURL(pdfUrl).catch(() => true);
      if (supported) {
        await Linking.openURL(pdfUrl);
      } else {
        Alert.alert('Download Error', 'Could not open receipt URL.');
      }
    } catch (e: any) {
      Alert.alert('Download Error', e?.message || 'Could not open receipt PDF.');
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const settlingPaidSoFar = (settlingInvoice?.payments || []).reduce(
    (s: number, p: any) => s + Number(p.amount || 0),
    0
  );
  const settlingDisc = Number(discountAmount) || 0;
  const settlingNetPayable = Math.max(
    0,
    (settlingInvoice?.total || 0) - settlingPaidSoFar - settlingDisc
  );
  const splitCashVal = parseInt(splitCash.replace(/[^0-9]/g, ''), 10) || 0;
  const splitMomoVal = parseInt(splitMomo.replace(/[^0-9]/g, ''), 10) || 0;
  const splitOrangeVal = parseInt(splitOrange.replace(/[^0-9]/g, ''), 10) || 0;
  const splitTotalVal = splitCashVal + splitMomoVal + splitOrangeVal;
  const splitRemainingToAllocate = settlingNetPayable - splitTotalVal;
  const isSplitValid = isSplitMode
    ? splitTotalVal === settlingNetPayable && splitTotalVal > 0
    : true;

  const handleQuickSplit5050 = () => {
    const half1 = Math.round(settlingNetPayable / 2);
    const half2 = settlingNetPayable - half1;
    setSplitCash(String(half1));
    setSplitMomo(String(half2));
    setSplitOrange('');
  };

  const handleClearSplit = () => {
    setSplitCash('');
    setSplitMomo('');
    setSplitOrange('');
  };

  return (
    <View style={styles.container}>
      {/* Header — 1-to-1 Web Software Parity */}
      <Header
        title={isMarketer ? 'Marketer Invoices' : isTechnician ? 'My Invoices' : 'Invoices'}
        subtitle={
          isMarketer
            ? 'Create service invoices for your clients and track pending payment.'
            : isTechnician
            ? 'View your service invoices and payment status.'
            : 'Reception & Manager Invoices Management'
        }
        onOpenMenu={onOpenMenu}
      />

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainScrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refreshInvoices}
            tintColor={THEME.colors.primaryDark}
          />
        }
      >
        {/* ========================================================================= */}
        {/* TOP ACTION BUTTONS (Exact match with Web Software PendingInvoices.jsx) */}
        {/* ========================================================================= */}
        <View style={styles.topActionsRow}>
          <TouchableOpacity
            onPress={() => refreshInvoices()}
            style={styles.topActionBtnSecondary}
            activeOpacity={0.7}
          >
            <RotateCcw size={15} color="#2D2D2A" />
            <Text style={styles.topActionBtnSecondaryText}>Refresh</Text>
          </TouchableOpacity>

          {canSellRetail && (
            <TouchableOpacity
              onPress={() => setShowRetailSaleModal(true)}
              style={styles.topActionBtnSecondary}
              activeOpacity={0.7}
            >
              <ShoppingBag size={15} color="#2D2D2A" />
              <Text style={styles.topActionBtnSecondaryText}>+ Retail Sale</Text>
            </TouchableOpacity>
          )}

          {canCreateInvoice && (
            <TouchableOpacity
              onPress={() => setShowNewServiceModal(true)}
              style={styles.topActionBtnPrimary}
              activeOpacity={0.7}
            >
              <Sparkles size={15} color="#FFFFFF" />
              <Text style={styles.topActionBtnPrimaryText}>+ New Service</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ========================================================================= */}
        {/* TOP 3 METRIC CARDS (Exact match with Web Software PendingInvoices.jsx) */}
        {/* ========================================================================= */}
        <View style={styles.metricCardsRow}>
          {/* Card 1: PENDING */}
          <TouchableOpacity
            onPress={() => setActiveTab('PENDING')}
            activeOpacity={0.8}
            style={[
              styles.metricCard,
              activeTab === 'PENDING' && styles.metricCardActiveWarning,
            ]}
          >
            <Text style={styles.metricCardLabel}>PENDING</Text>
            <Text style={[styles.metricCardValue, { color: '#D97706' }]}>
              {filteredPending.length}
            </Text>
          </TouchableOpacity>

          {/* Card 2: PAID TODAY */}
          <TouchableOpacity
            onPress={() => setActiveTab('PAID_TODAY')}
            activeOpacity={0.8}
            style={[
              styles.metricCard,
              activeTab === 'PAID_TODAY' && styles.metricCardActiveSuccess,
            ]}
          >
            <Text style={styles.metricCardLabel}>PAID TODAY</Text>
            <Text style={[styles.metricCardValue, { color: '#16A34A' }]}>
              {filteredPaidToday.length}
            </Text>
          </TouchableOpacity>

          {/* Card 3: HISTORY */}
          <TouchableOpacity
            onPress={() => setActiveTab('HISTORY')}
            activeOpacity={0.8}
            style={[
              styles.metricCard,
              activeTab === 'HISTORY' && styles.metricCardActiveCharcoal,
            ]}
          >
            <Text style={styles.metricCardLabel}>HISTORY</Text>
            <Text style={[styles.metricCardValue, { color: '#2D2D2A' }]}>
              {filteredHistory.length}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ========================================================================= */}
        {/* TAB BAR (Exact Web Software underline & count badge style) */}
        {/* ========================================================================= */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            onPress={() => setActiveTab('PENDING')}
            style={[styles.tab, activeTab === 'PENDING' && styles.tabActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'PENDING' && styles.tabTextActive]}>
              Pending
            </Text>
            <View
              style={[
                styles.tabBadge,
                activeTab === 'PENDING' ? styles.tabBadgePendingActive : styles.tabBadgeInactive,
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  activeTab === 'PENDING' ? styles.tabBadgeTextPendingActive : styles.tabBadgeTextInactive,
                ]}
              >
                {filteredPending.length}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('PAID_TODAY')}
            style={[styles.tab, activeTab === 'PAID_TODAY' && styles.tabActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'PAID_TODAY' && styles.tabTextActive]}>
              Paid Today
            </Text>
            <View
              style={[
                styles.tabBadge,
                activeTab === 'PAID_TODAY' ? styles.tabBadgeSuccessActive : styles.tabBadgeInactive,
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  activeTab === 'PAID_TODAY' ? styles.tabBadgeTextSuccessActive : styles.tabBadgeTextInactive,
                ]}
              >
                {filteredPaidToday.length}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('HISTORY')}
            style={[styles.tab, activeTab === 'HISTORY' && styles.tabActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'HISTORY' && styles.tabTextActive]}>
              History
            </Text>
            <View
              style={[
                styles.tabBadge,
                activeTab === 'HISTORY' ? styles.tabBadgeHistoryActive : styles.tabBadgeInactive,
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  activeTab === 'HISTORY' ? styles.tabBadgeTextHistoryActive : styles.tabBadgeTextInactive,
                ]}
              >
                {filteredHistory.length}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={15} color="#737373" style={{ marginRight: 8 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by invoice # or client name..."
            placeholderTextColor="#737373"
            style={styles.searchInput}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
              <X size={14} color="#737373" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ========================================================================= */}
        {/* INVOICE LIST (Exact 1-to-1 Accordion match with Web Software) */}
        {/* ========================================================================= */}
        <View style={styles.invoicesListContainer}>
          {displayedInvoices.length === 0 ? (
            <View style={styles.emptyCard}>
              <FileText size={38} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>
                {activeTab === 'PENDING'
                  ? 'No pending invoices.'
                  : activeTab === 'PAID_TODAY'
                  ? 'No invoices paid today yet.'
                  : 'No invoices found.'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'PENDING'
                  ? 'Invoices appear here after a technician completes a service, or create a walk-in invoice directly.'
                  : 'Completed invoices will appear here once payment is collected.'}
              </Text>
              {activeTab === 'PENDING' && (
                <View style={styles.emptyActionRow}>
                  {canCreateInvoice && (
                    <TouchableOpacity
                      onPress={() => setShowNewServiceModal(true)}
                      style={styles.topActionBtnPrimary}
                      activeOpacity={0.7}
                    >
                      <Sparkles size={14} color="#FFFFFF" />
                      <Text style={styles.topActionBtnPrimaryText}>+ New Service Invoice</Text>
                    </TouchableOpacity>
                  )}
                  {canSellRetail && (
                    <TouchableOpacity
                      onPress={() => setShowRetailSaleModal(true)}
                      style={styles.topActionBtnSecondary}
                      activeOpacity={0.7}
                    >
                      <ShoppingBag size={14} color="#2D2D2A" />
                      <Text style={styles.topActionBtnSecondaryText}>+ Retail Sale</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          ) : (
            displayedInvoices.map((invoice) => {
              const isExpanded = expandedId === invoice.id;
              const isPaid = invoice.status === 'PAID';
              const servicesList =
                invoice.items.map((it) => it.service || it.name).join(', ') || 'Spa Service';
              const techDisplay = invoice.technicianName || 'Staff';
              const timeDisplay = invoice.paidTime || 'Today';
              const isSplit =
                (Array.isArray(invoice.payments) && invoice.payments.length > 1) ||
                String(invoice.paymentMethod || '').includes('+');
              const paymentBadge = isSplit ? 'SPLIT PAYMENT' : formatPaymentMethod(invoice.paymentMethod);

              return (
                <View key={invoice.id} style={styles.invoiceCard}>
                  {/* Card Header (Tap to toggle expand) */}
                  <TouchableOpacity
                    onPress={() => toggleExpand(invoice.id)}
                    style={styles.cardHeaderTouchable}
                    activeOpacity={0.8}
                  >
                    {/* Top Row: Icon + Invoice # + Client Name */}
                    <View style={styles.cardHeaderTopRow}>
                      <View
                        style={[
                          styles.iconCircle,
                          isPaid ? styles.iconCirclePaid : styles.iconCirclePending,
                        ]}
                      >
                        {isPaid ? (
                          <CheckCircle2 size={18} color="#16A34A" />
                        ) : (
                          <FileText size={18} color="#D97706" />
                        )}
                      </View>

                      <View style={styles.cardHeaderMainInfo}>
                        <View style={styles.cardHeaderTitleRow}>
                          <View style={styles.invNumberBadge}>
                            <Text style={styles.invNumberText}>{invoice.invoiceNumber}</Text>
                          </View>
                          <Text style={styles.clientNameText} numberOfLines={1}>
                            {invoice.clientName}
                          </Text>
                        </View>

                        <View style={styles.cardHeaderSubRow}>
                          <Text style={styles.servicesText} numberOfLines={1}>
                            {servicesList}
                          </Text>
                          <View style={styles.techPill}>
                            <User size={10} color="#4F6748" />
                            <Text style={styles.techPillText} numberOfLines={1}>
                              Tech: {techDisplay}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Bottom Meta Row: Time/Method badge on Left, Amount + Paid/Pending Badge + Chevron on Right */}
                    <View style={styles.cardHeaderBottomRow}>
                      <View style={styles.cardHeaderBottomLeft}>
                        {isPaid ? (
                          <>
                            <View style={styles.timeTag}>
                              <Clock size={11} color="#737373" />
                              <Text style={styles.timeText}>{timeDisplay}</Text>
                            </View>
                            {paymentBadge ? (
                              <View style={styles.paymentMethodPill}>
                                <Text style={styles.paymentMethodPillText} numberOfLines={1}>
                                  {paymentBadge}
                                </Text>
                              </View>
                            ) : null}
                          </>
                        ) : (
                          <View style={styles.timeTag}>
                            <Clock size={11} color="#D97706" />
                            <Text style={[styles.timeText, { color: '#B45309' }]}>
                              {invoice.paidTime || formatDate(invoice.createdAt, 'HH:mm') || 'Pending'}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.cardHeaderBottomRight}>
                        <Text style={styles.amountText}>{formatFCFA(invoice.total)}</Text>
                        <View
                          style={[
                            styles.statusBadge,
                            isPaid ? styles.statusBadgePaid : styles.statusBadgePending,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              isPaid ? styles.statusBadgeTextPaid : styles.statusBadgeTextPending,
                            ]}
                          >
                            {isPaid ? 'Paid' : 'Pending'}
                          </Text>
                        </View>

                        {isExpanded ? (
                          <ChevronUp size={16} color="#737373" />
                        ) : (
                          <ChevronDown size={16} color="#737373" />
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* ========================================================================= */}
                  {/* EXPANDED ACCORDION DETAILS (Exact match with Web Software) */}
                  {/* ========================================================================= */}
                  {isExpanded && (
                    <View style={styles.expandedSection}>
                      {/* Meta Information Grid */}
                      <View style={styles.metaGrid}>
                        <View style={styles.metaCol}>
                          <Text style={styles.metaLabel}>INVOICE NUMBER</Text>
                          <Text style={styles.metaValueMono}>{invoice.invoiceNumber}</Text>
                        </View>
                        <View style={styles.metaCol}>
                          <Text style={styles.metaLabel}>CLIENT</Text>
                          <Text style={styles.metaValue}>{invoice.clientName}</Text>
                        </View>
                        <View style={styles.metaCol}>
                          <Text style={styles.metaLabel}>PHONE</Text>
                          <Text style={styles.metaValue}>{invoice.clientPhone || '—'}</Text>
                        </View>
                        <View style={styles.metaCol}>
                          <Text style={styles.metaLabel}>DATE</Text>
                          <Text style={styles.metaValue}>
                            {invoice.date || formatDate(invoice.createdAt, 'dd MMM yyyy')}
                          </Text>
                        </View>
                      </View>

                      {/* Line Items Breakdown */}
                      <View style={styles.itemsBreakdownBox}>
                        <View style={styles.itemsHeaderRow}>
                          <Text style={styles.itemsHeaderTitle}>SERVICES & ITEMS</Text>
                          <Text style={styles.itemsHeaderCount}>{invoice.items.length}</Text>
                        </View>
                        {invoice.items.map((item, idx) => (
                          <View key={idx} style={styles.breakdownItemRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.breakdownItemName}>{item.name}</Text>
                              <Text style={styles.breakdownItemTech}>
                                Tech: {item.technicianName || invoice.technicianName || 'Staff'}
                                {item.productName ? ` · Product: ${item.productName}` : ''}
                              </Text>
                            </View>
                            <Text style={styles.breakdownItemPrice}>{formatFCFA(item.price)}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Payment Breakdown Details (for Paid Invoices) */}
                      {isPaid && (
                        <View style={styles.paymentInfoBox}>
                          <View style={styles.paymentInfoHeaderRow}>
                            <Text style={styles.paymentInfoTitle}>Payment Breakdown</Text>
                            <Text style={styles.paymentInfoTotal}>{formatFCFA(invoice.total)}</Text>
                          </View>
                          {Array.isArray(invoice.payments) && invoice.payments.length > 0 ? (
                            invoice.payments.map((p: any, pIdx: number) => (
                              <View key={pIdx} style={styles.paymentLineRow}>
                                <Text style={styles.paymentLineMethod}>
                                  {formatPaymentMethod(p.method || p.paymentMethod)}
                                </Text>
                                <Text style={styles.paymentLineAmount}>{formatFCFA(p.amount)}</Text>
                              </View>
                            ))
                          ) : (
                            <View style={styles.paymentLineRow}>
                              <Text style={styles.paymentLineMethod}>
                                {formatPaymentMethod(invoice.paymentMethod)}
                              </Text>
                              <Text style={styles.paymentLineAmount}>{formatFCFA(invoice.total)}</Text>
                            </View>
                          )}
                        </View>
                      )}

                      {/* Action Buttons Row */}
                      <View style={styles.expandedActionsRow}>
                        {isPaid ? (
                          <>

                            <TouchableOpacity
                              onPress={() => handlePrintReceipt(invoice)}
                              style={[
                                styles.printReceiptBtn,
                                downloadingPdfId === invoice.id && { opacity: 0.7 },
                              ]}
                              disabled={downloadingPdfId === invoice.id}
                              activeOpacity={0.8}
                            >
                              {downloadingPdfId === invoice.id ? (
                                <ActivityIndicator size="small" color="#2D2D2A" />
                              ) : (
                                <Printer size={14} color="#2D2D2A" />
                              )}
                              <Text style={styles.printReceiptBtnText}>
                                {downloadingPdfId === invoice.id ? 'Downloading...' : 'Print Receipt'}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => handleSendWhatsApp(invoice)}
                              style={[
                                styles.whatsAppReceiptBtn,
                                sendingWhatsAppId === invoice.id && { opacity: 0.7 },
                              ]}
                              disabled={sendingWhatsAppId === invoice.id}
                              activeOpacity={0.8}
                            >
                              {sendingWhatsAppId === invoice.id ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <MessageCircle size={14} color="#FFFFFF" />
                              )}
                              <Text style={styles.whatsAppReceiptBtnText}>
                                {sendingWhatsAppId === invoice.id ? 'Sending...' : 'WhatsApp'}
                              </Text>
                            </TouchableOpacity>
                          </>
                        ) : canCollectPayment ? (
                          <TouchableOpacity
                            onPress={() => handleOpenSettle(invoice)}
                            style={styles.collectPaymentActionBtn}
                            activeOpacity={0.8}
                          >
                            <DollarSign size={15} color="#FFFFFF" />
                            <Text style={styles.collectPaymentActionBtnText}>
                              Collect Payment ({formatFCFA(invoice.total)})
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.awaitingPaymentBox}>
                            <Clock size={14} color="#D97706" />
                            <Text style={styles.awaitingPaymentText}>
                              Pending Payment · Awaiting Reception Desk to collect
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODAL 1: Settle Payment Modal */}
      {/* ========================================================================= */}
      <Modal visible={!!settlingInvoice} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Settle Payment</Text>
                <Text style={styles.modalSubtitle}>
                  Invoice #{settlingInvoice?.invoiceNumber} · {settlingInvoice?.clientName}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSettlingInvoice(null)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#737373" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Payment Mode Toggle */}
              <View style={styles.settleModeToggleRow}>
                <TouchableOpacity
                  onPress={() => setIsSplitMode(false)}
                  style={[
                    styles.settleModeTab,
                    !isSplitMode && styles.settleModeTabActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.settleModeTabText,
                      !isSplitMode && styles.settleModeTabTextActive,
                    ]}
                  >
                    Single Payment
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsSplitMode(true)}
                  style={[
                    styles.settleModeTab,
                    isSplitMode && styles.settleModeTabActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.settleModeTabText,
                      isSplitMode && styles.settleModeTabTextActive,
                    ]}
                  >
                    Split Payment (Multi-Method)
                  </Text>
                </TouchableOpacity>
              </View>

              {!isSplitMode ? (
                <>
                  {/* Payment Method Selector */}
                  <Text style={styles.fieldLabel}>SELECT PAYMENT METHOD</Text>
                  <View style={styles.methodPillsRow}>
                    {PAYMENT_METHODS.map((m) => (
                      <TouchableOpacity
                        key={m.key}
                        onPress={() => setSelectedMethod(m.key as any)}
                        style={[
                          styles.methodPill,
                          selectedMethod === m.key && styles.methodPillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.methodPillText,
                            selectedMethod === m.key && styles.methodPillTextActive,
                          ]}
                        >
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.splitHeaderRow}>
                    <Text style={styles.fieldLabel}>ENTER AMOUNTS PER PAYMENT METHOD</Text>
                    <View style={styles.quickSplitActionRow}>
                      <TouchableOpacity
                        onPress={handleQuickSplit5050}
                        style={styles.quickSplitActionBtn}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.quickSplitActionBtnText}>50 / 50 Cash & MoMo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleClearSplit}
                        style={styles.clearSplitActionBtn}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.clearSplitActionBtnText}>Clear</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.splitInputBlock}>
                    <View style={styles.splitInputLabelRow}>
                      <Text style={styles.splitInputLabel}>Cash Amount (FCFA):</Text>
                      {splitCashVal > 0 && (
                        <Text style={styles.splitPercentBadge}>
                          {((splitCashVal / (settlingNetPayable || 1)) * 100).toFixed(0)}%
                        </Text>
                      )}
                    </View>
                    <TextInput
                      value={splitCash}
                      onChangeText={setSplitCash}
                      keyboardType="numeric"
                      style={styles.formInput}
                      placeholder="0"
                    />

                    <View style={[styles.splitInputLabelRow, { marginTop: 8 }]}>
                      <Text style={styles.splitInputLabel}>MTN MoMo Amount (FCFA):</Text>
                      {splitMomoVal > 0 && (
                        <Text style={styles.splitPercentBadge}>
                          {((splitMomoVal / (settlingNetPayable || 1)) * 100).toFixed(0)}%
                        </Text>
                      )}
                    </View>
                    <TextInput
                      value={splitMomo}
                      onChangeText={setSplitMomo}
                      keyboardType="numeric"
                      style={styles.formInput}
                      placeholder="0"
                    />

                    <View style={[styles.splitInputLabelRow, { marginTop: 8 }]}>
                      <Text style={styles.splitInputLabel}>Orange Money Amount (FCFA):</Text>
                      {splitOrangeVal > 0 && (
                        <Text style={styles.splitPercentBadge}>
                          {((splitOrangeVal / (settlingNetPayable || 1)) * 100).toFixed(0)}%
                        </Text>
                      )}
                    </View>
                    <TextInput
                      value={splitOrange}
                      onChangeText={setSplitOrange}
                      keyboardType="numeric"
                      style={styles.formInput}
                      placeholder="0"
                    />
                  </View>

                  {/* Split Reconciliation Summary Bar */}
                  <View style={styles.splitReconciliationBar}>
                    <View style={styles.reconciliationStatsRow}>
                      <View>
                        <Text style={styles.reconciliationSubLabel}>NET DUE TO SETTLE</Text>
                        <Text style={styles.reconciliationVal}>{formatFCFA(settlingNetPayable)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.reconciliationSubLabel}>TOTAL ALLOCATED</Text>
                        <Text style={styles.reconciliationVal}>{formatFCFA(splitTotalVal)}</Text>
                      </View>
                    </View>

                    <View style={styles.reconciliationBadgeContainer}>
                      {isSplitValid ? (
                        <View style={styles.badgeExact}>
                          <CheckCircle2 size={13} color="#047857" />
                          <Text style={styles.badgeExactText}>Exact Match: Ready to Collect</Text>
                        </View>
                      ) : splitRemainingToAllocate > 0 ? (
                        <View style={styles.badgeRemaining}>
                          <AlertTriangle size={13} color="#B45309" />
                          <Text style={styles.badgeRemainingText}>
                            Remaining: {formatFCFA(splitRemainingToAllocate)}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.badgeOver}>
                          <AlertCircle size={13} color="#BE123C" />
                          <Text style={styles.badgeOverText}>
                            Over by: {formatFCFA(Math.abs(splitRemainingToAllocate))}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </>
              )}

              {/* Discount Input */}
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>APPLY DISCOUNT (FCFA)</Text>
              <TextInput
                value={discountAmount}
                onChangeText={setDiscountAmount}
                keyboardType="numeric"
                style={styles.formInput}
                placeholder="0"
              />

              {/* Total Calculation */}
              <View style={styles.summaryBox}>
                <View style={styles.sumRow}>
                  <Text style={styles.sumLabel}>Invoice Total:</Text>
                  <Text style={styles.sumVal}>{formatFCFA(settlingInvoice?.total || 0)}</Text>
                </View>
                {settlingPaidSoFar > 0 && (
                  <View style={styles.sumRow}>
                    <Text style={[styles.sumLabel, { color: '#059669', fontWeight: '700' }]}>Already Paid:</Text>
                    <Text style={[styles.sumVal, { color: '#059669', fontWeight: '700' }]}>
                      -{formatFCFA(settlingPaidSoFar)}
                    </Text>
                  </View>
                )}
                {settlingDisc > 0 && (
                  <View style={styles.sumRow}>
                    <Text style={styles.sumLabel}>Discount:</Text>
                    <Text style={[styles.sumVal, { color: '#B91C1C' }]}>
                      -{formatFCFA(settlingDisc)}
                    </Text>
                  </View>
                )}
                <View style={[styles.sumRow, styles.sumRowTotal]}>
                  <Text style={styles.totalLabelBold}>Net Due / Payable:</Text>
                  <Text style={styles.totalValBold}>
                    {formatFCFA(settlingNetPayable)}
                  </Text>
                </View>
                {isSplitMode && (
                  <>
                    <View style={[styles.sumRow, { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#E8E2D9' }]}>
                      <Text style={styles.sumLabel}>Total Split Allocated:</Text>
                      <Text style={styles.sumVal}>{formatFCFA(splitTotalVal)}</Text>
                    </View>
                    <View style={styles.sumRow}>
                      <Text style={styles.sumLabel}>Reconciliation Status:</Text>
                      {isSplitValid ? (
                        <Text style={[styles.sumVal, { color: '#047857', fontWeight: '700' }]}>
                          ✓ Exact Match
                        </Text>
                      ) : splitRemainingToAllocate > 0 ? (
                        <Text style={[styles.sumVal, { color: '#B45309', fontWeight: '700' }]}>
                          Remaining: {formatFCFA(splitRemainingToAllocate)}
                        </Text>
                      ) : (
                        <Text style={[styles.sumVal, { color: '#BE123C', fontWeight: '700' }]}>
                          Over by: {formatFCFA(Math.abs(splitRemainingToAllocate))}
                        </Text>
                      )}
                    </View>
                  </>
                )}
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={handleConfirmPayment}
              disabled={isSubmitting || (isSplitMode && !isSplitValid)}
              style={[
                styles.confirmSettleBtn,
                isSplitMode && !isSplitValid && styles.confirmSettleBtnDisabled,
              ]}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <Text style={styles.confirmSettleBtnText}>Recording Settlement...</Text>
              ) : isSplitMode ? (
                isSplitValid ? (
                  <>
                    <Check size={18} color="#FFFFFF" />
                    <Text style={styles.confirmSettleBtnText}>
                      Collect Split Payment ({formatFCFA(settlingNetPayable)})
                    </Text>
                  </>
                ) : (
                  <>
                    <Lock size={15} color="#FFFFFF" />
                    <Text style={styles.confirmSettleBtnText}>
                      {splitRemainingToAllocate > 0
                        ? `Allocate ${formatFCFA(splitRemainingToAllocate)} Remaining`
                        : `Over by ${formatFCFA(Math.abs(splitRemainingToAllocate))}`}
                    </Text>
                  </>
                )
              ) : (
                <>
                  <Check size={18} color="#FFFFFF" />
                  <Text style={styles.confirmSettleBtnText}>
                    Confirm Payment & Issue Receipt
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: Receipt Preview Modal */}
      {/* ========================================================================= */}
      <Modal visible={!!receiptInvoice} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.receiptSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Official Spa Receipt</Text>
              <TouchableOpacity
                onPress={() => setReceiptInvoice(null)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#737373" />
              </TouchableOpacity>
            </View>

            {receiptInvoice && (
              <ScrollView style={styles.receiptPaper}>
                {/* Brand Header */}
                <View style={styles.receiptBrand}>
                  <Text style={styles.receiptBrandTitle}>OMEGA SPA</Text>
                  <Text style={styles.receiptBrandSub}>Douala, Cameroon · Tel: +237 682 68 43 92</Text>
                  <View style={styles.receiptDivider} />
                </View>

                {/* Details */}
                <View style={styles.receiptDetailRow}>
                  <Text style={styles.receiptDetailLabel}>Invoice #:</Text>
                  <Text style={styles.receiptDetailVal}>{receiptInvoice.invoiceNumber}</Text>
                </View>
                <View style={styles.receiptDetailRow}>
                  <Text style={styles.receiptDetailLabel}>Date:</Text>
                  <Text style={styles.receiptDetailVal}>
                    {receiptInvoice.date || formatDate(receiptInvoice.createdAt, 'dd MMM yyyy')}
                  </Text>
                </View>
                <View style={styles.receiptDetailRow}>
                  <Text style={styles.receiptDetailLabel}>Client:</Text>
                  <Text style={styles.receiptDetailVal}>{receiptInvoice.clientName}</Text>
                </View>
                {receiptInvoice.clientPhone ? (
                  <View style={styles.receiptDetailRow}>
                    <Text style={styles.receiptDetailLabel}>Phone:</Text>
                    <Text style={styles.receiptDetailVal}>{receiptInvoice.clientPhone}</Text>
                  </View>
                ) : null}
                <View style={styles.receiptDetailRow}>
                  <Text style={styles.receiptDetailLabel}>Payment Method:</Text>
                  <Text style={styles.receiptDetailVal}>
                    {formatPaymentMethod(receiptInvoice.paymentMethod)}
                  </Text>
                </View>

                <View style={styles.receiptDivider} />

                {/* Line Items */}
                {receiptInvoice.items.map((item, idx) => (
                  <View key={idx} style={styles.receiptItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.receiptItemName}>{item.name}</Text>
                      {item.technicianName ? (
                        <Text style={styles.receiptItemTech}>Tech: {item.technicianName}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.receiptItemPrice}>{formatFCFA(item.price)}</Text>
                  </View>
                ))}

                <View style={styles.receiptDivider} />

                {/* Total */}
                <View style={styles.receiptTotalRow}>
                  <Text style={styles.receiptTotalLabel}>TOTAL PAID</Text>
                  <Text style={styles.receiptTotalVal}>{formatFCFA(receiptInvoice.total)}</Text>
                </View>
                <Text style={styles.receiptPaidPill}>STATUS: PAID IN FULL</Text>
                <Text style={styles.receiptThankYou}>Thank you for your visit to Omega Spa!</Text>
              </ScrollView>
            )}

            <View style={styles.receiptActions}>
              <TouchableOpacity
                onPress={() => {
                  if (receiptInvoice) handlePrintReceipt(receiptInvoice);
                }}
                style={[
                  styles.printReceiptModalBtn,
                  Boolean(receiptInvoice && downloadingPdfId === receiptInvoice.id) && { opacity: 0.7 },
                ]}
                disabled={Boolean(receiptInvoice && downloadingPdfId === receiptInvoice.id)}
                activeOpacity={0.8}
              >
                {receiptInvoice && downloadingPdfId === receiptInvoice.id ? (
                  <ActivityIndicator size="small" color="#2D2D2A" />
                ) : (
                  <Printer size={16} color="#2D2D2A" />
                )}
                <Text style={styles.printReceiptModalBtnText}>
                  {receiptInvoice && downloadingPdfId === receiptInvoice.id
                    ? 'Opening PDF...'
                    : 'Print / Download Official PDF'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (receiptInvoice) handleSendWhatsApp(receiptInvoice);
                }}
                style={[
                  styles.whatsAppReceiptModalBtn,
                  Boolean(receiptInvoice && sendingWhatsAppId === receiptInvoice.id) && { opacity: 0.7 },
                ]}
                disabled={Boolean(receiptInvoice && sendingWhatsAppId === receiptInvoice.id)}
                activeOpacity={0.8}
              >
                {receiptInvoice && sendingWhatsAppId === receiptInvoice.id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <MessageCircle size={16} color="#FFFFFF" />
                )}
                <Text style={styles.whatsAppReceiptModalBtnText}>
                  {receiptInvoice && sendingWhatsAppId === receiptInvoice.id
                    ? 'Sending PDF Receipt...'
                    : 'Send to Client via WhatsApp'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: WhatsApp Phone Number Prompt Modal (for Walk-in clients) */}
      {/* ========================================================================= */}
      <Modal visible={!!phonePromptInvoice} transparent animationType="fade">
        <View style={styles.phonePromptOverlay}>
          <View style={styles.phonePromptCard}>
            <View style={styles.modalHeader}>
              <View style={styles.phonePromptHeaderLeft}>
                <View style={styles.whatsAppIconCircle}>
                  <MessageCircle size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Send WhatsApp Receipt</Text>
                  <Text style={styles.phonePromptSubtitle} numberOfLines={1}>
                    {phonePromptInvoice?.clientName || 'Walk-in Client'} · #{phonePromptInvoice?.invoiceNumber}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setPhonePromptInvoice(null)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#737373" />
              </TouchableOpacity>
            </View>

            <View style={styles.phonePromptBody}>
              <Text style={styles.phonePromptNotice}>
                No phone number on file for {phonePromptInvoice?.clientName || 'this walk-in client'}. Please enter WhatsApp number to send the official PDF receipt:
              </Text>

              <Text style={styles.fieldLabel}>WHATSAPP NUMBER (E.G. +2376XXXXXXXX)</Text>
              <TextInput
                value={promptPhoneNumber}
                onChangeText={setPromptPhoneNumber}
                keyboardType="phone-pad"
                autoFocus
                style={styles.phonePromptInput}
                placeholder="+237 6XXXXXXXX"
                placeholderTextColor="#9CA3AF"
              />

              <View style={styles.phonePromptActionsRow}>
                <TouchableOpacity
                  onPress={() => setPhonePromptInvoice(null)}
                  style={styles.phonePromptCancelBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.phonePromptCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleConfirmPhonePrompt}
                  style={styles.phonePromptSendBtn}
                  activeOpacity={0.8}
                >
                  <MessageCircle size={16} color="#FFFFFF" />
                  <Text style={styles.phonePromptSendText}>Send Receipt</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: New Retail Sale Modal */}
      <NewRetailSaleModal
        visible={showRetailSaleModal}
        onClose={() => setShowRetailSaleModal(false)}
        onSuccess={(invoice) => {
          setShowRetailSaleModal(false);
          setActiveTab('PAID_TODAY');
          if (invoice?.id) {
            setExpandedId(invoice.id);
            setReceiptInvoice(invoice);
          }
          refreshInvoices();
        }}
      />

      {/* MODAL 4: New Walk-In / Service Invoice Modal */}
      <NewWalkInServiceModal
        visible={showNewServiceModal}
        onClose={() => setShowNewServiceModal(false)}
        onSuccess={(invoice, isPaid) => {
          setShowNewServiceModal(false);
          refreshInvoices();
          if (isPaid) {
            setActiveTab('PAID_TODAY');
            if (invoice?.id) {
              setExpandedId(invoice.id);
              setReceiptInvoice(invoice);
            }
          } else {
            setActiveTab('PENDING');
            if (invoice?.id) {
              setExpandedId(invoice.id);
            }
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF7F2',
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  topActionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    ...THEME.shadows.sm,
  },
  topActionBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  topActionBtnPrimary: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#4F6748',
    borderWidth: 1,
    borderColor: '#43573E',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    ...THEME.shadows.sm,
  },
  topActionBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    width: '100%',
    justifyContent: 'center',
  },
  headerRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    ...THEME.shadows.sm,
  },
  headerRefreshText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  // Top 3 Metric Cards
  metricCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    paddingVertical: 12,
    paddingHorizontal: 12,
    ...THEME.shadows.sm,
  },
  metricCardActiveWarning: {
    borderColor: '#D97706',
    borderWidth: 1.5,
  },
  metricCardActiveSuccess: {
    borderColor: '#16A34A',
    borderWidth: 1.5,
  },
  metricCardActiveCharcoal: {
    borderColor: '#4F6748',
    borderWidth: 1.5,
  },
  metricCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#737373',
    letterSpacing: 0.5,
  },
  metricCardValue: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D9',
    marginBottom: 12,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#4F6748',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#737373',
  },
  tabTextActive: {
    color: '#2D2D2A',
    fontWeight: '700',
  },
  tabBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeInactive: {
    backgroundColor: '#F6F1EB',
  },
  tabBadgePendingActive: {
    backgroundColor: '#FEF3C7',
  },
  tabBadgeSuccessActive: {
    backgroundColor: '#DCFCE7',
  },
  tabBadgeHistoryActive: {
    backgroundColor: '#E8F2E6',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tabBadgeTextInactive: {
    color: '#737373',
  },
  tabBadgeTextPendingActive: {
    color: '#B45309',
  },
  tabBadgeTextSuccessActive: {
    color: '#15803D',
  },
  tabBadgeTextHistoryActive: {
    color: '#2C422E',
  },
  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#2D2D2A',
    paddingVertical: 4,
  },
  // Invoice List Container
  invoicesListContainer: {
    gap: 10,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#737373',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  // Accordion Card
  invoiceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    overflow: 'hidden',
    ...THEME.shadows.sm,
  },
  cardHeaderTouchable: {
    padding: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCirclePaid: {
    backgroundColor: '#DCFCE7',
  },
  iconCirclePending: {
    backgroundColor: '#FEF3C7',
  },
  cardHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardHeaderMainInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  cardHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  invNumberBadge: {
    backgroundColor: '#F6F1EB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  invNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D2D2A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  clientNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
    flexShrink: 1,
  },
  cardHeaderSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  servicesText: {
    fontSize: 11,
    color: '#737373',
    fontWeight: '500',
    flexShrink: 1,
    maxWidth: '65%',
  },
  techPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  techPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  cardHeaderBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5EFE6',
    gap: 8,
  },
  cardHeaderBottomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timeText: {
    fontSize: 10,
    color: '#737373',
    fontWeight: '500',
  },
  paymentMethodPill: {
    backgroundColor: '#F0EBE3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  paymentMethodPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4F6748',
    textTransform: 'uppercase',
  },
  cardHeaderBottomRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  amountText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2D2D2A',
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgePaid: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.25)',
  },
  statusBadgePending: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.25)',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadgeTextPaid: {
    color: '#15803D',
  },
  statusBadgeTextPending: {
    color: '#B45309',
  },
  paymentInfoBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    gap: 4,
  },
  paymentInfoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE3',
    paddingBottom: 4,
  },
  paymentInfoTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paymentInfoTotal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
  },
  paymentLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  paymentLineMethod: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  paymentLineAmount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
  },
  // Expanded Accordion Section
  expandedSection: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0EBE3',
    backgroundColor: '#FAF7F3',
    gap: 10,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  metaCol: {
    minWidth: '45%',
    flex: 1,
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#737373',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
    marginTop: 2,
  },
  metaValueMono: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D2D2A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  // Items Breakdown Box
  itemsBreakdownBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    overflow: 'hidden',
  },
  itemsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F6F1EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  itemsHeaderTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#737373',
    letterSpacing: 0.5,
  },
  itemsHeaderCount: {
    fontSize: 9,
    fontWeight: '700',
    color: '#737373',
  },
  breakdownItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE3',
  },
  breakdownItemName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  breakdownItemTech: {
    fontSize: 10,
    color: '#737373',
    marginTop: 2,
  },
  breakdownItemPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  expandedActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  printReceiptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    paddingVertical: 9,
    ...THEME.shadows.sm,
  },
  printReceiptBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  whatsAppReceiptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#25D366',
    borderRadius: 8,
    paddingVertical: 9,
  },
  whatsAppReceiptBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  collectPaymentActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#4F6748',
    borderRadius: 8,
    paddingVertical: 10,
  },
  collectPaymentActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  awaitingPaymentBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  awaitingPaymentText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
    flex: 1,
  },
  // Settle Payment Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D9',
    paddingBottom: 12,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#737373',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#737373',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  methodPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  methodPill: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  methodPillActive: {
    backgroundColor: '#DCE7D7',
    borderColor: '#4F6748',
  },
  methodPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#737373',
  },
  methodPillTextActive: {
    color: '#4F6748',
  },
  formInput: {
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#2D2D2A',
  },
  summaryBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: 'rgba(251, 247, 242, 0.6)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    gap: 6,
  },
  sumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sumRowTotal: {
    borderTopWidth: 1,
    borderTopColor: '#E8E2D9',
    paddingTop: 8,
    marginTop: 4,
  },
  sumLabel: {
    fontSize: 11,
    color: '#737373',
  },
  sumVal: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  settleModeToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  settleModeTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  settleModeTabActive: {
    backgroundColor: '#4F6748',
    borderColor: '#4F6748',
  },
  settleModeTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#737373',
  },
  settleModeTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  splitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 6,
  },
  quickSplitActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickSplitActionBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  quickSplitActionBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  clearSplitActionBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  clearSplitActionBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#DC2626',
  },
  splitInputBlock: {
    backgroundColor: '#FBF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  splitInputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  splitPercentBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F6748',
  },
  splitInputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#525252',
    marginBottom: 4,
  },
  splitReconciliationBar: {
    marginTop: 6,
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reconciliationStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reconciliationSubLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reconciliationVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
  },
  reconciliationBadgeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeExact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  badgeExactText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  badgeRemaining: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  badgeRemainingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  badgeOver: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  badgeOverText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#BE123C',
  },
  totalLabelBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  totalValBold: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4F6748',
  },
  confirmSettleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#4F6748',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  confirmSettleBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  confirmSettleBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Receipt Sheet
  receiptSheet: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 16,
    padding: 16,
    maxHeight: '90%',
  },
  receiptPaper: {
    backgroundColor: '#FBF7F2',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  receiptBrand: {
    alignItems: 'center',
  },
  receiptBrandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2D2D2A',
    letterSpacing: 1,
  },
  receiptBrandSub: {
    fontSize: 12,
    color: '#737373',
    marginTop: 2,
  },
  receiptDivider: {
    height: 1,
    backgroundColor: '#E8E2D9',
    marginVertical: 10,
    width: '100%',
  },
  receiptDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  receiptDetailLabel: {
    fontSize: 13,
    color: '#737373',
  },
  receiptDetailVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D2D2A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  receiptItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  receiptItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  receiptItemTech: {
    fontSize: 12,
    color: '#737373',
  },
  receiptItemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  receiptTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2D2D2A',
  },
  receiptTotalVal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#4F6748',
  },
  receiptPaidPill: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065F46',
    backgroundColor: '#D1FAE5',
    textAlign: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  receiptThankYou: {
    fontSize: 13,
    color: '#737373',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  receiptActions: {
    marginTop: 12,
  },
  printReceiptModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F3EFEA',
    borderWidth: 1,
    borderColor: '#D4CDC3',
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  printReceiptModalBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  whatsAppReceiptModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#25D366',
    paddingVertical: 10,
    borderRadius: 10,
  },
  whatsAppReceiptModalBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // WhatsApp Phone Number Prompt Modal
  phonePromptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  phonePromptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    width: '100%',
    maxWidth: 420,
    ...THEME.shadows.md,
  },
  phonePromptHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  whatsAppIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phonePromptSubtitle: {
    fontSize: 11,
    color: '#737373',
    fontWeight: '500',
    marginTop: 2,
  },
  phonePromptBody: {
    marginTop: 14,
  },
  phonePromptNotice: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 14,
  },
  phonePromptInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  phonePromptActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  phonePromptCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  phonePromptCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  phonePromptSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#25D366',
  },
  phonePromptSendText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  feedbackReceiptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 8,
    paddingVertical: 8,
  },
  feedbackReceiptBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  whatsAppFeedbackModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#D97706',
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 8,
  },
  feedbackModalSheet: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 16,
    maxHeight: 520,
    overflow: 'hidden',
  },
  feedbackStarBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackSummaryBox: {
    backgroundColor: '#FBF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  feedbackClientName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  feedbackInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
    marginBottom: 6,
  },
  feedbackInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#2D2D2A',
    fontWeight: '600',
  },
  feedbackInputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  feedbackErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  feedbackErrorText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },
  feedbackHelpText: {
    fontSize: 11,
    color: '#737373',
    marginTop: 6,
  },
  feedbackModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E8E2D9',
    backgroundColor: '#FAF8F5',
  },
  feedbackCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    backgroundColor: '#FFFFFF',
  },
  feedbackCancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#525252',
  },
  feedbackSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#25D366',
  },
  feedbackSendBtnDisabled: {
    opacity: 0.5,
  },
  feedbackSendBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default PendingInvoicesScreen;
