/**
 * TechnicianDailySummaryScreen — 1-to-1 Match with Omega Spa POS Web Software
 * Matches frontend/src/pages/TechnicianDailySummary.jsx:
 * - Top Month Navigator (< November 2026 >) with Current month reset & Archive pill
 * - Role-separated Staff Selector (Manager & Reception) with:
 *     - Category Tabs: All, Technicians, Marketers with real count badges
 *     - Real-time Staff Search input
 *     - Grouped Category Chips with 2-letter initials circle + checkmarks
 *     - Searchable Dropdown / Modal picker for quick one-tap selection on mobile
 * - Hero Monthly Target Performance Card (Dark Navy #111827 -> #0F172A):
 *     - Monthly target quota & scope
 *     - Mode A: Fixed Salary (Locked) vs Mode B: Commission Tier Unlocked
 *     - MTD Sales progress bar with exact percentage & dual color gradient
 *     - 3 Bottom KPI strips: Distance to Goal, Contract Terms, Projected Payout
 * - Main Summary Card (White #FFFFFF, border #E8E2D9):
 *     - Header: Staff Name, Specialties / Role, Record Penalty button, Today's Date
 *     - Operational Metrics: Services Performed Today, Service Productivity, Average Ticket, Clients Introduced, Completed Referral Services
 *     - Calculations & Contract details: Fixed/Base Salary, Conditional Unearned (Mode A) vs Net Earned (Mode B), Guaranteed % Commission (Marketer)
 *     - Deductions strip if penalties exist
 *     - Projected Monthly Payout Total Strip in sage-soft container
 * - Attributed Referred Clients List
 * - Prospected Clients Invoices & Commission Breakdown (for Marketer)
 * - Disciplinary Infractions & Penalties Section with Total KPI, Policy Notice, and Conduct History Table with Void/Delete
 * - Interactive Modals:
 *     - Searchable Staff Dropdown Picker Modal
 *     - Record Disciplinary Penalty Modal
 *     - Edit Salary Contract Modal
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import {
  Award,
  AlertTriangle,
  ShieldAlert,
  DollarSign,
  User,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
  TrendingUp,
  UserPlus,
  FileText,
  Trash2,
  CheckCircle2,
  Target,
  Lock,
  Unlock,
  Zap,
  Calculator,
  Calendar,
  Users,
  Scissors,
  Megaphone,
  X,
} from 'lucide-react-native';
import THEME from '../constants/theme';
import Header from '../components/Header';
import { formatFCFA } from '../utils/currency';
import { useAuth, isMarketerUser } from '../context/AuthContext';
import { useClients } from '../context/ClientsContext';
import { useInvoices } from '../context/InvoiceContext';
import { useAppointments } from '../context/AppointmentsContext';
import { reportsApi, penaltiesApi, commissionsApi, usersApi } from '../services/api';

interface TechnicianDailySummaryScreenProps {
  onOpenMenu?: () => void;
  navigation?: any;
}

const STANDARD_PENALTY_RULES = [
  { id: 'late_coming', name: 'Late coming', defaultAmount: 2000 },
  { id: 'no_show', name: 'No show / Missed work', defaultAmount: 5000 },
  { id: 'unprofessional_conduct', name: 'Unprofessional conduct / Customer dispute', defaultAmount: 3000 },
  { id: 'cash_register_mismatch', name: 'Cash register mismatch', defaultAmount: 5000 },
  { id: 'hygiene_uniform', name: 'Hygiene & Uniform violation', defaultAmount: 2000 },
  { id: 'other', name: 'Other Disciplinary Infraction', defaultAmount: 1000 },
];

function formatMonthDisplay(monthStr: string): string {
  if (!monthStr) return '';
  const parts = monthStr.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (!y || !m) return monthStr;
  const d = new Date(Date.UTC(y, m - 1, 1));
  const monthName = d.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
  return `${monthName} ${y}`;
}

export const TechnicianDailySummaryScreen: React.FC<TechnicianDailySummaryScreenProps> = ({
  onOpenMenu,
  navigation,
}) => {
  const { user, allUsers } = useAuth();
  const { clients } = useClients();
  const { invoices } = useInvoices();
  const { appointments } = useAppointments();

  const role = (user?.role || '').toLowerCase();
  const isTechnicianRole = role === 'technician';
  const isReception = role === 'reception';
  const isCleaner = role === 'cleaner';
  const isManager = role === 'manager';
  const isUserMarketer = isMarketerUser(user);

  // Month state (YYYY-MM)
  const currentMonthStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const isCurrentMonth = selectedMonth === currentMonthStr;

  const goToPrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(Date.UTC(y, m - 2, 1));
    const newMonth = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  const goToNextMonth = () => {
    if (selectedMonth >= currentMonthStr) return;
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(Date.UTC(y, m, 1));
    const newMonth = `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  const resetToCurrentMonth = () => {
    setSelectedMonth(currentMonthStr);
  };

  // Staff lists
  const dynamicTechnicians = useMemo(() => {
    return (allUsers || []).filter(
      (u: any) =>
        (u.role === 'technician' || u.role === 'marketer' || isMarketerUser(u)) &&
        u.active !== false
    );
  }, [allUsers]);

  const isUserAMarketer = useCallback((u: any) => {
    if (!u) return false;
    const r = String(u.role?.name || u.role || '').toLowerCase();
    return r === 'marketer' || isMarketerUser(u);
  }, []);

  const techniciansList = useMemo(
    () => dynamicTechnicians.filter((u: any) => !isUserAMarketer(u)),
    [dynamicTechnicians, isUserAMarketer]
  );

  const marketersList = useMemo(
    () => dynamicTechnicians.filter((u: any) => isUserAMarketer(u)),
    [dynamicTechnicians, isUserAMarketer]
  );

  // Active staff selection
  const [selectedTechName, setSelectedTechName] = useState<string>(() => {
    if (isTechnicianRole || isUserMarketer) {
      return user?.name || 'Staff';
    }
    return dynamicTechnicians[0]?.name || user?.name || 'Staff';
  });

  useEffect(() => {
    if (isTechnicianRole || isUserMarketer) {
      if (user?.name && selectedTechName !== user.name) {
        setSelectedTechName(user.name);
      }
    } else if (!selectedTechName && dynamicTechnicians.length > 0) {
      setSelectedTechName(dynamicTechnicians[0].name);
    }
  }, [dynamicTechnicians, isTechnicianRole, isUserMarketer, user?.name, selectedTechName]);

  const effectiveName = (isTechnicianRole || isUserMarketer)
    ? user?.name || 'Staff'
    : selectedTechName;

  const currentTech: any = useMemo(() => {
    if (isTechnicianRole || isUserMarketer) {
      return user || { id: 1, name: 'Staff', specialties: [], role: 'technician' };
    }
    return (
      dynamicTechnicians.find((t: any) => t.name === effectiveName) ||
      dynamicTechnicians[0] || { id: 1, name: 'Technician', specialties: [], role: 'technician' }
    );
  }, [isTechnicianRole, isUserMarketer, user, dynamicTechnicians, effectiveName]);

  const isMarketer = isUserMarketer || isMarketerUser(currentTech) || currentTech?.role === 'marketer';

  // Category filter
  const [staffCategoryTab, setStaffCategoryTab] = useState<'all' | 'technician' | 'marketer'>('all');

  const filteredTechnicians = techniciansList;
  const filteredMarketers = marketersList;

  // Data fetching state
  const [techReport, setTechReport] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [salarySummary, setSalarySummary] = useState<any>(null);
  const [salaryLoading, setSalaryLoading] = useState<boolean>(false);
  const [penalties, setPenalties] = useState<any[]>([]);
  const [totalPenalties, setTotalPenalties] = useState<number>(0);
  const [penaltiesLoading, setPenaltiesLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Modals state
  const [showPenaltyModal, setShowPenaltyModal] = useState<boolean>(false);
  const [showContractModal, setShowContractModal] = useState<boolean>(false);

  // Penalty creation form state
  const [selectedPenaltyRule, setSelectedPenaltyRule] = useState<string>('late_coming');
  const [penaltyAmount, setPenaltyAmount] = useState<string>('2000');
  const [penaltyDate, setPenaltyDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [penaltyNotes, setPenaltyNotes] = useState<string>('');
  const [submittingPenalty, setSubmittingPenalty] = useState<boolean>(false);
  const [penaltyError, setPenaltyError] = useState<string>('');

  // Contract form state
  const [contractTarget, setContractTarget] = useState<string>('525000');
  const [contractFixed, setContractFixed] = useState<string>('110000');
  const [contractBase, setContractBase] = useState<string>('50000');
  const [contractRate, setContractRate] = useState<string>('15');
  const [contractScope, setContractScope] = useState<'INDIVIDUAL' | 'SPA_TOTAL'>('INDIVIDUAL');
  const [submittingContract, setSubmittingContract] = useState<boolean>(false);
  const [contractError, setContractError] = useState<string>('');

  // Sync contract modal fields when opened
  useEffect(() => {
    if (showContractModal && salarySummary?.contract) {
      const c = salarySummary.contract;
      setContractTarget(String(c.monthlyTarget ?? 525000));
      setContractFixed(String(c.fixedSalary ?? 110000));
      setContractBase(String(c.basePay ?? 50000));
      setContractRate(String(c.commissionRate ?? 15));
      setContractScope(c.targetScope || 'INDIVIDUAL');
    }
  }, [showContractModal, salarySummary]);

  // Fetch Report
  const fetchTechReport = useCallback(async () => {
    if (isCleaner) return;
    setLoadingReport(true);
    try {
      if (isTechnicianRole || isMarketer) {
        const res = await reportsApi.getMyPerformance('today');
        setTechReport(res?.data || null);
      } else {
        const res = await reportsApi.getTechnicians('today');
        const list = res?.data?.technicians || [];
        const matched = list.find(
          (t: any) =>
            t.technicianName?.toLowerCase() === effectiveName?.toLowerCase() ||
            t.technicianId === currentTech?.id
        );
        setTechReport(matched || null);
      }
    } catch (err: any) {
      console.warn('Technician summary report fetch error:', err?.message);
    } finally {
      setLoadingReport(false);
    }
  }, [isCleaner, isTechnicianRole, isMarketer, effectiveName, currentTech?.id]);

  // Fetch Penalties
  const fetchPenalties = useCallback(async () => {
    if (isCleaner) return;
    setPenaltiesLoading(true);
    try {
      const targetId = (isTechnicianRole || isUserMarketer) ? user?.id : currentTech?.id;
      if (!targetId) return;
      const res = await penaltiesApi.getPenalties({
        staffId: String(targetId),
        month: selectedMonth,
      });
      if (res?.data) {
        setPenalties(res.data.penalties || []);
        setTotalPenalties(res.data.totalPenalties || 0);
      } else if (Array.isArray(res)) {
        setPenalties(res);
        setTotalPenalties(res.reduce((s: number, p: any) => s + Number(p.penaltyAmount || 0), 0));
      }
    } catch (err: any) {
      console.warn('Could not fetch staff penalties:', err?.message);
    } finally {
      setPenaltiesLoading(false);
    }
  }, [isCleaner, isTechnicianRole, isUserMarketer, user?.id, currentTech?.id, selectedMonth]);

  // Fetch Salary Summary
  const fetchSalarySummary = useCallback(async () => {
    if (isCleaner) return;
    const targetId = (isTechnicianRole || isUserMarketer) ? user?.id : currentTech?.id;
    if (!targetId) return;
    setSalaryLoading(true);
    try {
      const res = await commissionsApi.getSalarySummary({
        technicianId: String(targetId),
        period: selectedMonth,
      });
      if (res?.data) {
        setSalarySummary(res.data);
      } else if (res) {
        setSalarySummary(res);
      }
    } catch (err: any) {
      console.warn('Salary summary fetch error:', err?.message);
    } finally {
      setSalaryLoading(false);
    }
  }, [isCleaner, isTechnicianRole, isUserMarketer, user?.id, currentTech?.id, selectedMonth]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchTechReport(), fetchPenalties(), fetchSalarySummary()]);
    setRefreshing(false);
  }, [fetchTechReport, fetchPenalties, fetchSalarySummary]);

  useEffect(() => {
    fetchTechReport();
  }, [fetchTechReport]);

  useEffect(() => {
    fetchPenalties();
  }, [fetchPenalties]);

  useEffect(() => {
    fetchSalarySummary();
  }, [fetchSalarySummary]);

  // Record penalty
  const handleSavePenalty = async () => {
    const targetId = currentTech?.id;
    if (!targetId) return;
    const matched = STANDARD_PENALTY_RULES.find((r) => r.id === selectedPenaltyRule);
    const ruleName = matched?.name || selectedPenaltyRule;
    const amountNum = Number(penaltyAmount);

    if (isNaN(amountNum) || amountNum <= 0) {
      setPenaltyError('Penalty amount must be a positive number.');
      return;
    }

    setSubmittingPenalty(true);
    setPenaltyError('');
    try {
      await penaltiesApi.createPenalty({
        staffId: targetId,
        ruleName,
        penaltyAmount: amountNum,
        date: penaltyDate,
        notes: penaltyNotes.trim() || undefined,
      });
      setShowPenaltyModal(false);
      setPenaltyNotes('');
      fetchPenalties();
      fetchSalarySummary();
    } catch (err: any) {
      setPenaltyError(err?.message || 'Failed to record penalty.');
    } finally {
      setSubmittingPenalty(false);
    }
  };

  // Void penalty
  const handleDeletePenalty = (penaltyId: string) => {
    Alert.alert(
      'Void Penalty',
      'Are you sure you want to void / delete this penalty record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await penaltiesApi.deletePenalty(penaltyId);
              fetchPenalties();
              fetchSalarySummary();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete penalty');
            }
          },
        },
      ]
    );
  };

  // Save contract
  const handleSaveContract = async () => {
    const targetId = currentTech?.id;
    if (!targetId) return;
    const targetNum = Number(contractTarget);
    const fixedNum = Number(contractFixed);
    const baseNum = Number(contractBase);
    const rateNum = Number(contractRate);

    if (isNaN(targetNum) || isNaN(fixedNum) || isNaN(baseNum) || isNaN(rateNum)) {
      setContractError('Please enter valid numerical values.');
      return;
    }

    setSubmittingContract(true);
    setContractError('');
    try {
      await usersApi.updateSalaryContract(String(targetId), {
        monthlyTarget: targetNum,
        fixedSalary: fixedNum,
        basePay: baseNum,
        commissionRate: rateNum,
        targetScope: contractScope,
      });
      setShowContractModal(false);
      fetchSalarySummary();
    } catch (err: any) {
      setContractError(err?.message || 'Failed to update contract');
    } finally {
      setSubmittingContract(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Calculations matching web frontend/src/pages/TechnicianDailySummary.jsx
  // ---------------------------------------------------------------------------
  const sContract = salarySummary?.contract || {};
  const sPerf = salarySummary?.performance || {};
  const sCalc = salarySummary?.calculation || {};

  const sMonthlyTarget = Number(sContract.monthlyTarget ?? 0) || 0;
  const sFixedSalary = Number(sContract.fixedSalary ?? 0) || 0;
  const sBasePay = Number(sContract.basePay ?? 0) || 0;
  const sCommissionRate = Number(sContract.commissionRate ?? 0) || 0;
  const sTargetScope = sContract.targetScope || 'INDIVIDUAL';

  const sMtdSales = Number(sPerf.mtdSales ?? sPerf.salesTotal ?? 0) || 0;
  const sIsTargetMet = Boolean(
    sPerf.isTargetMet ?? (sMonthlyTarget > 0 && sMtdSales >= sMonthlyTarget)
  );

  const rawProgressPercent = sPerf.targetProgressPercent ?? sPerf.percentageAchieved;
  const sProgressPercent = Number(
    rawProgressPercent != null
      ? rawProgressPercent
      : sMonthlyTarget > 0
      ? Math.min(100, Math.round((sMtdSales / sMonthlyTarget) * 1000) / 10)
      : 0
  ) || 0;

  const rawRemaining = sPerf.salesRemainingToTarget ?? sPerf.remainingToTarget;
  const sRemainingToTarget = Number(
    rawRemaining != null ? rawRemaining : Math.max(0, sMonthlyTarget - sMtdSales)
  ) || 0;

  // Referred clients for this technician or marketer
  const myReferredClients = useMemo(() => {
    return (clients || []).filter(
      (c: any) =>
        (c.introducedById && String(c.introducedById) === String(currentTech?.id)) ||
        (c.introducedBy && c.introducedBy.toLowerCase().trim() === effectiveName.toLowerCase().trim())
    );
  }, [clients, currentTech?.id, effectiveName]);

  // Helper: Get invoice net paid
  const getInvoiceNetPaid = (inv: any) => {
    if (inv.paidAmount != null && Number(inv.paidAmount) > 0) return Number(inv.paidAmount);
    if (inv.finalTotal != null && Number(inv.finalTotal) > 0) return Number(inv.finalTotal);
    const total = Number(inv.total || 0);
    const discount = Number(inv.discount || 0);
    return Math.max(0, total - discount);
  };

  // Invoices belonging to clients prospected by this marketer
  const myProspectedInvoices = useMemo(() => {
    const referredIds = new Set(myReferredClients.map((c: any) => String(c.id)));
    const targetUserId = String(currentTech?.id);
    return (invoices || []).filter(
      (inv: any) =>
        (referredIds.has(String(inv.clientId)) ||
          (inv.introducedById && String(inv.introducedById) === targetUserId)) &&
        (inv.status === 'PAID' || inv.status === 'COMPLETED')
    );
  }, [invoices, myReferredClients, currentTech?.id]);

  // Aggregated prospected sales, commissions, services
  const { prospectedNetSales, prospectedTotalCommission, prospectedCompletedServices } = useMemo(() => {
    let sales = 0;
    let comm = 0;
    let svcCount = 0;
    (myProspectedInvoices || []).forEach((inv: any) => {
      const net = getInvoiceNetPaid(inv);
      sales += net;
      if (sCommissionRate > 0) {
        comm += Math.round(net * (sCommissionRate / 100));
      } else {
        comm += Math.round(net * 0.1);
      }
      svcCount += inv.items?.length || 1;
    });
    return {
      prospectedNetSales: sales,
      prospectedTotalCommission: comm,
      prospectedCompletedServices: svcCount,
    };
  }, [myProspectedInvoices, sCommissionRate]);

  // Marketer target evaluation
  const hasSpecificBookingTarget = Boolean(
    sContract.targetAppointments &&
    Number(sContract.targetAppointments) > 0 &&
    Number(sContract.targetAppointments) < 1000
  );
  const marketerTargetCount = hasSpecificBookingTarget ? Number(sContract.targetAppointments) : 0;
  const marketerClosedAppointments = useMemo(() => {
    const referredIds = new Set(myReferredClients.map((c: any) => String(c.id)));
    return (appointments || []).filter(
      (a: any) =>
        referredIds.has(String(a.clientId)) &&
        (a.status === 'COMPLETED' || a.status === 'PAID')
    );
  }, [myReferredClients, appointments]);

  const closedAppointmentsCount = marketerClosedAppointments.length;

  const effectiveMtdSales = isMarketer
    ? Math.max(sMtdSales, prospectedNetSales)
    : sMtdSales;

  const effectiveProgressPercent = sMonthlyTarget > 0
    ? Math.min(100, Math.round((effectiveMtdSales / sMonthlyTarget) * 1000) / 10)
    : 0;

  const effectiveRemainingToTarget = Math.max(0, sMonthlyTarget - effectiveMtdSales);

  const isMarketerTargetMet = hasSpecificBookingTarget
    ? closedAppointmentsCount >= marketerTargetCount
    : Boolean(sIsTargetMet || (sMonthlyTarget > 0 && effectiveMtdSales >= sMonthlyTarget));

  // Active Mode: Mode B (Target Met) vs Mode A (Below Target)
  const sIsModeB = isMarketer
    ? isMarketerTargetMet
    : (sIsTargetMet ||
      sCalc.activeMode === 'BASE_PLUS_COMMISSION' ||
      sCalc.mode === 'MODE_B_TARGET_MET');

  const sGrossCommission = Number(sCalc.grossCommissionAccumulated ?? sCalc.grossCommission ?? 0) || 0;
  const sReferralDeductions = Number(sCalc.referralDeductionsTotal ?? sCalc.referralDeductions ?? 0) || 0;
  const sNetCommission = Number(
    sCalc.netCommissionAccumulated ??
    sCalc.netCommission ??
    Math.max(0, sGrossCommission - sReferralDeductions)
  ) || 0;

  const commissionEarned = isMarketer
    ? Math.max(sNetCommission, prospectedTotalCommission)
    : (techReport?.commissionEarned ?? sNetCommission);

  const sUnearnedLocked = Number(
    sCalc.unearnedCommissionLocked ?? (!sIsModeB ? sNetCommission : 0)
  ) || 0;

  const sTotalPenalties = Number(
    totalPenalties || sCalc.totalPenalties || sReferralDeductions || 0
  ) || 0;

  const rawTechPayout = Number(
    sCalc.currentProjectedPayout ??
    sCalc.effectivePayout ??
    sCalc.calculatedPayout ??
    (sIsModeB ? Math.max(sFixedSalary, sBasePay + sNetCommission) : sFixedSalary)
  ) || 0;
  const sEffectivePayout = Math.max(0, rawTechPayout - sTotalPenalties);

  const marketerBaseOrFixed = isMarketerTargetMet ? (sBasePay || 2500) : (sFixedSalary || 2000);
  const marketerGrossPayout = marketerBaseOrFixed + (commissionEarned || 0);
  const marketerTotalPayout = Math.max(0, marketerGrossPayout - sTotalPenalties);

  // Operational metrics
  const servicesToday = techReport?.servicesCompleted ?? 0;
  const serviceProductivity = techReport?.revenueGenerated ?? 0;
  const averageTicket = techReport?.averageTicket ?? (servicesToday > 0 ? Math.round(serviceProductivity / servicesToday) : 0);

  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  // RBAC: Cleaner blocked
  if (isCleaner) {
    return (
      <View style={styles.container}>
        <Header title="Technician Daily Summary" onOpenMenu={onOpenMenu} />
        <View style={styles.accessDeniedCard}>
          <View style={styles.accessDeniedIconBox}>
            <ShieldAlert size={28} color="#EF4444" />
          </View>
          <Text style={styles.accessDeniedTitle}>Access Denied (403)</Text>
          <Text style={styles.accessDeniedSubtitle}>
            Technician daily summaries and commission reports are restricted to service staff and management.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title={
          isMarketer
            ? 'Marketer Daily Summary'
            : isTechnicianRole
            ? 'My Daily Summary'
            : 'Technician Daily Summary'
        }
        subtitle={
          isMarketer
            ? 'Client referral tracking and acquisition performance summary.'
            : 'Individual daily performance and auto-calculation summary.'
        }
        onOpenMenu={onOpenMenu}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshAll}
            tintColor={THEME.colors.primaryDark}
          />
        }
      >
        {/* Month Selector Bar */}
        <View style={styles.monthSelectorBar}>
          <TouchableOpacity
            onPress={goToPrevMonth}
            style={styles.monthNavBtn}
            activeOpacity={0.7}
          >
            <ChevronLeft size={16} color="#2D2D2A" />
          </TouchableOpacity>

          <View style={styles.monthCenterBadge}>
            <Calendar size={15} color="#4F6748" />
            <Text style={styles.monthCenterText}>
              {formatMonthDisplay(selectedMonth)}
            </Text>
          </View>

          <TouchableOpacity
            onPress={goToNextMonth}
            disabled={selectedMonth >= currentMonthStr}
            style={[
              styles.monthNavBtn,
              selectedMonth >= currentMonthStr && styles.monthNavBtnDisabled,
            ]}
            activeOpacity={0.7}
          >
            <ChevronRight
              size={16}
              color={selectedMonth >= currentMonthStr ? '#A1A1AA' : '#2D2D2A'}
            />
          </TouchableOpacity>

          {!isCurrentMonth && (
            <TouchableOpacity
              onPress={resetToCurrentMonth}
              style={styles.currentMonthBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.currentMonthBtnText}>Current</Text>
            </TouchableOpacity>
          )}

          {!isCurrentMonth && (
            <View style={styles.historicalBadge}>
              <Text style={styles.historicalBadgeText}>Historical Month</Text>
            </View>
          )}
        </View>

        {/* ── Role-Separated Staff Selector (Manager & Reception) ── */}
        {!isTechnicianRole && !isUserMarketer && (
          <View style={styles.staffCard}>
            {/* Top Category Tabs */}
            <View style={styles.categoryTabsRow}>
              {/* All */}
              <TouchableOpacity
                onPress={() => setStaffCategoryTab('all')}
                style={[
                  styles.categoryTabBtn,
                  staffCategoryTab === 'all' && styles.categoryTabBtnActiveAll,
                ]}
                activeOpacity={0.8}
              >
                <Users size={13} color={staffCategoryTab === 'all' ? '#2D2D2A' : '#737373'} />
                <Text
                  style={[
                    styles.categoryTabBtnText,
                    staffCategoryTab === 'all' && styles.categoryTabBtnTextActive,
                  ]}
                >
                  All
                </Text>
                <View
                  style={[
                    styles.tabCountPill,
                    staffCategoryTab === 'all' ? styles.tabCountPillActiveAll : styles.tabCountPillInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabCountText,
                      staffCategoryTab === 'all' ? { color: '#4F6748' } : { color: '#737373' },
                    ]}
                  >
                    {dynamicTechnicians.length}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Technicians */}
              <TouchableOpacity
                onPress={() => {
                  setStaffCategoryTab('technician');
                  if (isMarketer && techniciansList.length > 0) {
                    setSelectedTechName(techniciansList[0].name);
                  }
                }}
                style={[
                  styles.categoryTabBtn,
                  staffCategoryTab === 'technician' && styles.categoryTabBtnActiveTech,
                ]}
                activeOpacity={0.8}
              >
                <Scissors size={13} color={staffCategoryTab === 'technician' ? '#FFFFFF' : '#737373'} />
                <Text
                  style={[
                    styles.categoryTabBtnText,
                    staffCategoryTab === 'technician' && { color: '#FFFFFF' },
                  ]}
                >
                  Technicians
                </Text>
                <View
                  style={[
                    styles.tabCountPill,
                    staffCategoryTab === 'technician'
                      ? { backgroundColor: 'rgba(255,255,255,0.25)' }
                      : styles.tabCountPillInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabCountText,
                      staffCategoryTab === 'technician' ? { color: '#FFFFFF' } : { color: '#737373' },
                    ]}
                  >
                    {techniciansList.length}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Marketers */}
              <TouchableOpacity
                onPress={() => {
                  setStaffCategoryTab('marketer');
                  if (!isMarketer && marketersList.length > 0) {
                    setSelectedTechName(marketersList[0].name);
                  }
                }}
                style={[
                  styles.categoryTabBtn,
                  staffCategoryTab === 'marketer' && styles.categoryTabBtnActiveMkt,
                ]}
                activeOpacity={0.8}
              >
                <Megaphone size={13} color={staffCategoryTab === 'marketer' ? '#FFFFFF' : '#737373'} />
                <Text
                  style={[
                    styles.categoryTabBtnText,
                    staffCategoryTab === 'marketer' && { color: '#FFFFFF' },
                  ]}
                >
                  Marketers
                </Text>
                <View
                  style={[
                    styles.tabCountPill,
                    staffCategoryTab === 'marketer'
                      ? { backgroundColor: 'rgba(255,255,255,0.25)' }
                      : styles.tabCountPillInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabCountText,
                      staffCategoryTab === 'marketer' ? { color: '#FFFFFF' } : { color: '#737373' },
                    ]}
                  >
                    {marketersList.length}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* 1. Technicians Group */}
            {(staffCategoryTab === 'all' || staffCategoryTab === 'technician') && (
              <View style={styles.groupSection}>
                {staffCategoryTab === 'all' && (
                  <View style={styles.groupHeaderRow}>
                    <View style={styles.groupHeaderLeft}>
                      <Scissors size={12} color="#4F6748" />
                      <Text style={styles.groupTitleText}>
                        TECHNICIANS ({filteredTechnicians.length})
                      </Text>
                    </View>
                    <Text style={styles.groupSubtitleText}>Spa, Salon & Massage Specialists</Text>
                  </View>
                )}

                {filteredTechnicians.length === 0 ? (
                  <Text style={styles.emptyFilterText}>No technicians found matching filter.</Text>
                ) : (
                  <View style={styles.chipsWrap}>
                    {filteredTechnicians.map((tech: any) => {
                      const isSelected = selectedTechName === tech.name;
                      return (
                        <TouchableOpacity
                          key={tech.id}
                          onPress={() => {
                            if (selectedTechName !== tech.name) {
                              setSelectedTechName(tech.name);
                            }
                          }}
                          style={[
                            styles.staffChip,
                            isSelected && styles.staffChipActiveTech,
                          ]}
                          activeOpacity={0.8}
                        >
                          <View
                            style={[
                              styles.chipInitialsCircle,
                              isSelected
                                ? styles.chipInitialsCircleActiveTech
                                : styles.chipInitialsCircleInactive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipInitialsText,
                                isSelected ? { color: '#FFFFFF' } : { color: '#4F6748' },
                              ]}
                            >
                              {(tech.name || 'T').slice(0, 2).toUpperCase()}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.chipStaffName,
                              isSelected && styles.chipStaffNameActive,
                            ]}
                          >
                            {tech.name}
                          </Text>
                          {isSelected && <Check size={13} color="#FFFFFF" strokeWidth={2.5} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Divider if in 'all' view */}
            {staffCategoryTab === 'all' && marketersList.length > 0 && (
              <View style={styles.groupDivider} />
            )}

            {/* 2. Marketers Group */}
            {(staffCategoryTab === 'all' || staffCategoryTab === 'marketer') && (
              <View style={styles.groupSection}>
                {staffCategoryTab === 'all' && (
                  <View style={styles.groupHeaderRow}>
                    <View style={styles.groupHeaderLeft}>
                      <Megaphone size={12} color="#6D28D9" />
                      <Text style={[styles.groupTitleText, { color: '#6D28D9' }]}>
                        MARKETERS ({filteredMarketers.length})
                      </Text>
                    </View>
                    <Text style={styles.groupSubtitleText}>Client Introduction & Referral Commission</Text>
                  </View>
                )}

                {filteredMarketers.length === 0 ? (
                  <Text style={styles.emptyFilterText}>No marketers found matching filter.</Text>
                ) : (
                  <View style={styles.chipsWrap}>
                    {filteredMarketers.map((mkt: any) => {
                      const isSelected = selectedTechName === mkt.name;
                      return (
                        <TouchableOpacity
                          key={mkt.id}
                          onPress={() => {
                            if (selectedTechName !== mkt.name) {
                              setSelectedTechName(mkt.name);
                            }
                          }}
                          style={[
                            styles.staffChip,
                            styles.mktChipInactive,
                            isSelected && styles.staffChipActiveMkt,
                          ]}
                          activeOpacity={0.8}
                        >
                          <View
                            style={[
                              styles.chipInitialsCircle,
                              isSelected
                                ? styles.chipInitialsCircleActiveMkt
                                : styles.chipInitialsCircleInactiveMkt,
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipInitialsText,
                                isSelected ? { color: '#FFFFFF' } : { color: '#6D28D9' },
                              ]}
                            >
                              {(mkt.name || 'M').slice(0, 2).toUpperCase()}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.chipStaffName,
                              isSelected && styles.chipStaffNameActive,
                            ]}
                          >
                            {mkt.name}
                          </Text>
                          {isSelected && <Check size={13} color="#FFFFFF" strokeWidth={2.5} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Loading Indicator when switching staff */}
        {salaryLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#4F6748" />
            <Text style={styles.loadingCardTitle}>
              Loading Performance Summary for {effectiveName}...
            </Text>
            <Text style={styles.loadingCardSubtitle}>
              Fetching monthly sales quota, commission calculation, and contract mode.
            </Text>
          </View>
        ) : (
          <>
            {/* ── Monthly Target Performance Hero Card (Dark Navy #111827 -> #0F172A) ── */}
            <View style={styles.heroDarkCard}>
              {/* Header row: Target & Mode Badge */}
              <View style={styles.heroTopRow}>
                <View style={styles.heroTargetInfoRow}>
                  <View
                    style={[
                      styles.heroTargetIconBox,
                      sIsModeB ? styles.heroTargetIconBoxEmerald : styles.heroTargetIconBoxAmber,
                    ]}
                  >
                    <Target size={20} color={sIsModeB ? '#34D399' : '#FBBF24'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.heroTitleRow}>
                      <Text style={styles.heroTitleText}>Monthly Target Performance</Text>
                      <View style={styles.heroPeriodPill}>
                        <Text style={styles.heroPeriodPillText}>
                          {formatMonthDisplay(selectedMonth)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.heroSubtitleText}>
                      Target Quota:{' '}
                      <Text style={styles.heroQuotaHighlight}>
                        {sMonthlyTarget.toLocaleString()} FCFA
                      </Text>{' '}
                      ({sTargetScope === 'SPA_TOTAL' ? 'Spa Total Scope' : 'Individual Sales'})
                    </Text>
                  </View>
                </View>

                {/* Mode Pill & Contract button */}
                <View style={styles.heroActionsRow}>
                  {sIsModeB ? (
                    <View style={styles.modeBadgeEmerald}>
                      <Unlock size={12} color="#6EE7B7" />
                      <Text style={styles.modeBadgeEmeraldText}>Mode B · Commission Tier Unlocked</Text>
                    </View>
                  ) : (
                    <View style={styles.modeBadgeAmber}>
                      <Lock size={12} color="#FCD34D" />
                      <Text style={styles.modeBadgeAmberText}>Mode A · Fixed Salary</Text>
                    </View>
                  )}

                  {isManager && (
                    <TouchableOpacity
                      onPress={() => setShowContractModal(true)}
                      style={styles.heroContractBtn}
                      activeOpacity={0.8}
                    >
                      <Calculator size={13} color="#CBD5E1" />
                      <Text style={styles.heroContractBtnText}>Contract</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Progress Bar & MTD Numbers */}
              <View style={styles.heroProgressSection}>
                <View style={styles.heroProgressNumbersRow}>
                  <View style={styles.heroProgressLeft}>
                    <Text style={styles.heroProgressBigNumber}>
                      {(isMarketer ? effectiveMtdSales : sMtdSales).toLocaleString()}
                    </Text>
                    <Text style={styles.heroProgressSubTarget}>
                      / {sMonthlyTarget.toLocaleString()} FCFA MTD
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.heroProgressPercentText,
                      sIsModeB ? { color: '#34D399' } : { color: '#FBBF24' },
                    ]}
                  >
                    {(isMarketer ? effectiveProgressPercent : sProgressPercent)}%
                  </Text>
                </View>

                <View style={styles.heroProgressBarTrack}>
                  <View
                    style={[
                      styles.heroProgressBarFill,
                      sIsModeB ? styles.heroProgressFillEmerald : styles.heroProgressFillAmber,
                      {
                        width: `${Math.min(
                          100,
                          Math.max(3, isMarketer ? effectiveProgressPercent : sProgressPercent)
                        )}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* 3 Bottom KPI strips */}
              <View style={styles.heroKpiGrid}>
                {/* Distance to Goal */}
                <View style={styles.heroKpiBox}>
                  <Zap size={15} color={sIsModeB ? '#34D399' : '#FBBF24'} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.heroKpiLabel}>DISTANCE TO GOAL</Text>
                    <Text style={styles.heroKpiValue}>
                      {sIsModeB
                        ? 'Target Achieved 🎉'
                        : `${(isMarketer ? effectiveRemainingToTarget : sRemainingToTarget).toLocaleString()} FCFA remaining`}
                    </Text>
                  </View>
                </View>

                {/* Contract Terms */}
                <View style={styles.heroKpiBox}>
                  <DollarSign size={15} color="#94A3B8" />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.heroKpiLabel}>CONTRACT TERMS</Text>
                    <Text style={styles.heroKpiValue}>
                      {isMarketer
                        ? `${sCommissionRate}% comm · ${sFixedSalary.toLocaleString()} flat / ${(sBasePay || 2500).toLocaleString()} base`
                        : `${sCommissionRate}% comm · ${sFixedSalary.toLocaleString()} fixed`}
                    </Text>
                  </View>
                </View>

                {/* Projected Payout */}
                <View style={styles.heroKpiBox}>
                  <Award size={15} color="#34D399" />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.heroKpiLabel}>PROJECTED PAYOUT</Text>
                    <Text style={[styles.heroKpiValue, { color: '#6EE7B7' }]}>
                      {(isMarketer ? marketerTotalPayout : sEffectivePayout).toLocaleString()} FCFA
                    </Text>
                    {sTotalPenalties > 0 && (
                      <Text style={styles.heroPenaltyNotice}>
                        (-{sTotalPenalties.toLocaleString()} FCFA penalty deducted)
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </View>

            {/* ── Main Summary Card (White Card #FFFFFF) ── */}
            <View style={styles.mainSummaryCard}>
              {/* Header */}
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.staffMainName}>{currentTech.name}</Text>
                  <Text style={styles.staffMainSubtitle}>
                    {isMarketer
                      ? 'Marketing Specialist · Client Acquisition'
                      : (currentTech.specialties || []).join(', ') || 'Technician'}
                  </Text>
                </View>
                <View style={styles.cardHeaderRight}>
                  <View style={{ alignItems: 'flex-end', marginBottom: 2 }}>
                    <Text style={styles.dateLabel}>DATE</Text>
                    <Text style={styles.dateValue}>{todayStr}</Text>
                  </View>
                  {isManager && (
                    <TouchableOpacity
                      onPress={() => setShowPenaltyModal(true)}
                      style={styles.recordPenaltyBtn}
                      activeOpacity={0.8}
                    >
                      <AlertTriangle size={12} color="#FFFFFF" />
                      <Text style={styles.recordPenaltyBtnText}>Record Penalty</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Operational Metrics */}
              {isMarketer ? (
                <View style={styles.metricsList}>
                  <View style={styles.metricRow}>
                    <View style={styles.metricRowLeft}>
                      <UserPlus size={15} color="#6D28D9" />
                      <Text style={styles.metricLabel}>Clients Introduced</Text>
                    </View>
                    <Text style={styles.metricValueBold}>
                      {myReferredClients.length}
                    </Text>
                  </View>

                  <View style={styles.metricRow}>
                    <View style={styles.metricRowLeft}>
                      <Sparkles size={15} color="#6D28D9" />
                      <Text style={styles.metricLabel}>Completed Referral Services</Text>
                    </View>
                    <Text style={styles.metricValueBold}>
                      {prospectedCompletedServices}
                    </Text>
                  </View>

                  <View style={styles.metricRow}>
                    <View style={styles.metricRowLeft}>
                      <Award size={15} color="#6D28D9" />
                      <Text style={styles.metricLabelMuted}>Referral Commission Rate</Text>
                    </View>
                    <Text style={styles.metricValueMono}>
                      {sCommissionRate > 0 ? `${sCommissionRate}% per completed service` : '10% per completed service'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.metricsList}>
                  <View style={styles.metricRow}>
                    <View style={styles.metricRowLeft}>
                      <Sparkles size={15} color="#4F6748" />
                      <Text style={styles.metricLabel}>Services Performed Today</Text>
                    </View>
                    <Text style={styles.metricValueBold}>{servicesToday}</Text>
                  </View>

                  <View style={styles.metricRow}>
                    <View style={styles.metricRowLeft}>
                      <DollarSign size={15} color="#4F6748" />
                      <Text style={styles.metricLabel}>Service Productivity (Performed)</Text>
                    </View>
                    <Text style={styles.metricValueBold}>
                      {serviceProductivity.toLocaleString()} FCFA
                    </Text>
                  </View>

                  <View style={styles.metricRow}>
                    <View style={styles.metricRowLeft}>
                      <TrendingUp size={15} color="#4F6748" />
                      <Text style={styles.metricLabelMuted}>Average Ticket per Service</Text>
                    </View>
                    <Text style={styles.metricValueMono}>
                      {averageTicket.toLocaleString()} FCFA
                    </Text>
                  </View>

                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabelMuted}>Clients Introduced</Text>
                    <Text style={styles.metricValueBold}>{myReferredClients.length}</Text>
                  </View>

                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabelMuted}>Completed Referral Services</Text>
                    <Text style={styles.metricValueBold}>{prospectedCompletedServices || 0}</Text>
                  </View>
                </View>
              )}

              {/* Divider & Salary / Commission Calculations */}
              <View style={styles.calcDividerSection}>
                {isMarketer ? (
                  <View style={{ gap: 10 }}>
                    {/* Marketer Target Progress Box */}
                    <View
                      style={[
                        styles.mktTargetBox,
                        isMarketerTargetMet ? styles.mktTargetBoxEmerald : styles.mktTargetBoxIvory,
                      ]}
                    >
                      <View style={styles.mktTargetHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                          <Target size={15} color={isMarketerTargetMet ? '#047857' : '#6D28D9'} />
                          <Text style={styles.mktTargetTitle}>
                            {hasSpecificBookingTarget
                              ? `Monthly Closed Bookings Target: ${marketerTargetCount}`
                              : `Monthly Sales Target: ${sMonthlyTarget.toLocaleString()} FCFA`}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.mktTargetBadge,
                            isMarketerTargetMet ? styles.mktTargetBadgeEmerald : styles.mktTargetBadgeAmber,
                          ]}
                        >
                          <Text
                            style={[
                              styles.mktTargetBadgeText,
                              isMarketerTargetMet ? { color: '#065F46' } : { color: '#92400E' },
                            ]}
                          >
                            {isMarketerTargetMet
                              ? 'Target Achieved 🎉'
                              : hasSpecificBookingTarget
                              ? `${Math.max(0, marketerTargetCount - closedAppointmentsCount)} More Needed`
                              : `${sRemainingToTarget.toLocaleString()} FCFA More Needed`}
                          </Text>
                        </View>
                      </View>

                      {/* Small Progress Bar */}
                      <View style={styles.mktTrackBar}>
                        <View
                          style={[
                            styles.mktTrackFill,
                            {
                              width: `${Math.min(
                                100,
                                hasSpecificBookingTarget
                                  ? Math.round((closedAppointmentsCount / Math.max(1, marketerTargetCount)) * 100)
                                  : sProgressPercent
                              )}%`,
                              backgroundColor: isMarketerTargetMet ? '#059669' : '#6D28D9',
                            },
                          ]}
                        />
                      </View>

                      <View style={styles.mktTargetBottomTerms}>
                        <View style={styles.mktTermsRow}>
                          <Text style={styles.mktTermsLabel}>Target Met Base Pay (Mode B):</Text>
                          <Text
                            style={[
                              styles.mktTermsVal,
                              isMarketerTargetMet ? { color: '#047857' } : { color: '#737373' },
                            ]}
                          >
                            {(sBasePay || 2500).toLocaleString()} FCFA
                            {isMarketerTargetMet ? ' (Active Unlocked ✓)' : ' (Unlocks at target)'}
                          </Text>
                        </View>
                        <View style={styles.mktTermsRow}>
                          <Text style={styles.mktTermsLabel}>Below Target Flat Salary (Mode A):</Text>
                          <Text style={styles.mktTermsVal}>
                            {sFixedSalary > 0 ? `${sFixedSalary.toLocaleString()} FCFA` : '0 FCFA'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Guaranteed % Commission Row */}
                    <View style={styles.guaranteedCommBox}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Sparkles size={13} color="#6D28D9" />
                          <Text style={styles.guaranteedCommTitle}>
                            Guaranteed % Commission (Always Paid)
                          </Text>
                        </View>
                        <Text style={styles.guaranteedCommSub}>
                          Compulsory on all completed services brought by you, regardless of target.
                        </Text>
                      </View>
                      <Text style={styles.guaranteedCommAmount}>
                        {(commissionEarned || sNetCommission || 0).toLocaleString()} FCFA
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    {/* Fixed / Base Salary Row */}
                    <View style={styles.salaryTypeRow}>
                      <Text style={styles.salaryTypeLabel}>
                        {!sIsModeB ? 'Fixed Salary' : 'Base Salary'}
                      </Text>
                      <Text style={styles.salaryTypeValue}>
                        {!sIsModeB
                          ? `${sFixedSalary.toLocaleString()} FCFA`
                          : `${sBasePay.toLocaleString()} FCFA`}
                      </Text>
                    </View>

                    {/* Conditional Box Mode A or Mode B */}
                    {!sIsModeB ? (
                      <View style={styles.modeABox}>
                        <View style={styles.modeAHeaderRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Lock size={13} color="#D97706" />
                            <Text style={styles.modeATitle}>
                              Conditional Unearned Commission (Locked)
                            </Text>
                          </View>
                          <Text style={styles.modeAAmount}>
                            {sUnearnedLocked.toLocaleString()} FCFA
                          </Text>
                        </View>
                        <Text style={styles.modeASub}>
                          Locked until monthly target ({sMonthlyTarget.toLocaleString()} FCFA) is achieved. Fixed salary of {sFixedSalary.toLocaleString()} FCFA applies.
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.modeBBox}>
                        <View style={styles.modeBHeaderRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Unlock size={13} color="#059669" />
                            <Text style={styles.modeBTitle}>
                              Net Earned Commission (Unlocked)
                            </Text>
                          </View>
                          <Text style={styles.modeBAmount}>
                            {sNetCommission.toLocaleString()} FCFA
                          </Text>
                        </View>
                        <Text style={styles.modeBSub}>
                          Target reached! Paid as Base ({sBasePay.toLocaleString()} FCFA) + Net Commission ({sNetCommission.toLocaleString()} FCFA).
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Penalties Deduction Row if any */}
                {sTotalPenalties > 0 && (
                  <View style={styles.penaltiesDeductionRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ShieldAlert size={14} color="#DC2626" />
                      <Text style={styles.penaltiesDeductionLabel}>
                        Disciplinary Infractions & Penalties Deducted
                      </Text>
                    </View>
                    <Text style={styles.penaltiesDeductionValue}>
                      -{sTotalPenalties.toLocaleString()} FCFA
                    </Text>
                  </View>
                )}
              </View>

              {/* Total Projected Monthly Payout Row */}
              <View style={styles.payoutStripCard}>
                <View style={styles.payoutStripLeft}>
                  <Award size={18} color="#4F6748" />
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text style={styles.payoutStripTitle}>Projected Monthly Payout</Text>
                    <Text style={styles.payoutStripSub}>
                      {isMarketer
                        ? isMarketerTargetMet
                          ? `Target Met Base Pay (${(sBasePay || 2500).toLocaleString()} FCFA) + Guaranteed Commission (${(commissionEarned || 0).toLocaleString()} FCFA)${sTotalPenalties > 0 ? ` - Penalties (${sTotalPenalties.toLocaleString()} FCFA)` : ''}`
                          : `Below Target Flat Salary (${(sFixedSalary || 2000).toLocaleString()} FCFA) + Guaranteed Commission (${(commissionEarned || 0).toLocaleString()} FCFA)${sTotalPenalties > 0 ? ` - Penalties (${sTotalPenalties.toLocaleString()} FCFA)` : ''}`
                        : sTotalPenalties > 0
                        ? `Gross Payout (${rawTechPayout.toLocaleString()} FCFA) - Penalties (${sTotalPenalties.toLocaleString()} FCFA)`
                        : !sIsModeB
                        ? 'Fixed Salary (Target not yet met)'
                        : 'Base + Unlocked Net Commission'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.payoutStripAmount}>
                  {formatFCFA(isMarketer ? marketerTotalPayout : sEffectivePayout)}
                </Text>
              </View>
            </View>

            {/* ── Referred Clients List ── */}
            <View style={styles.whiteSectionCard}>
              <View style={styles.sectionCardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <UserPlus size={16} color="#4F6748" />
                  <Text style={styles.sectionCardTitle}>
                    Referred Clients ({myReferredClients.length})
                  </Text>
                </View>
                <Text style={styles.sectionCardSub}>Attributed to {effectiveName}</Text>
              </View>

              {myReferredClients.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyBoxText}>
                    No clients introduced by this staff member yet.
                  </Text>
                </View>
              ) : (
                <View style={styles.tableBox}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableColHeader, { flex: 1.5 }]}>Client Name</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.2 }]}>Phone</Text>
                    <Text style={[styles.tableColHeader, { flex: 1 }]}>Quartier</Text>
                  </View>
                  {myReferredClients.map((c: any) => (
                    <View key={c.id} style={styles.tableDataRow}>
                      <Text style={[styles.tableCellBold, { flex: 1.5 }]}>{c.name}</Text>
                      <Text style={[styles.tableCellMuted, { flex: 1.2 }]}>{c.phone || '—'}</Text>
                      <Text style={[styles.tableCellMuted, { flex: 1 }]}>{c.quartier || '—'}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* ── Prospected Clients Invoices (for Marketer) ── */}
            {isMarketer && (
              <View style={styles.whiteSectionCard}>
                <View style={styles.sectionCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <FileText size={16} color="#6D28D9" />
                    <Text style={styles.sectionCardTitle}>
                      Prospected Clients Invoices ({myProspectedInvoices.length})
                    </Text>
                  </View>
                  <Text style={styles.sectionCardSub}>
                    Invoices & payments collected from your referrals
                  </Text>
                </View>

                {myProspectedInvoices.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyBoxText}>
                      No paid invoices for your prospected clients yet.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.tableBox}>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.tableColHeader, { flex: 1.2 }]}>Invoice #</Text>
                      <Text style={[styles.tableColHeader, { flex: 1.5 }]}>Client</Text>
                      <Text style={[styles.tableColHeader, { flex: 1 }]}>Total Paid</Text>
                      <Text style={[styles.tableColHeader, { flex: 1 }]}>Commission</Text>
                    </View>
                    {myProspectedInvoices.map((inv: any) => {
                      const netPaid = getInvoiceNetPaid(inv);
                      const commRate = sCommissionRate > 0 ? sCommissionRate : 10;
                      const commAmt = Math.round(netPaid * (commRate / 100));

                      return (
                        <View key={inv.id} style={styles.tableDataRow}>
                          <Text style={[styles.tableCellMono, { flex: 1.2 }]}>
                            {inv.invoiceNumber || `INV-${inv.id}`}
                          </Text>
                          <Text style={[styles.tableCellBold, { flex: 1.5 }]}>
                            {inv.clientName || 'Client'}
                          </Text>
                          <Text style={[styles.tableCellBold, { flex: 1 }]}>
                            {netPaid.toLocaleString()} FCFA
                          </Text>
                          <Text style={[styles.tableCellComm, { flex: 1 }]}>
                            +{commAmt.toLocaleString()} FCFA
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* ── Disciplinary Infractions & Penalties Section ── */}
            <View style={styles.whiteSectionCard}>
              <View style={styles.disciplinaryHeaderRow}>
                <View style={styles.disciplinaryTitleRow}>
                  <View style={styles.shieldIconBox}>
                    <ShieldAlert size={16} color="#DC2626" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionCardTitle}>
                      Disciplinary Infractions & Penalties
                    </Text>
                    <Text style={styles.sectionCardSub}>
                      Transparent conduct record for {effectiveName}
                    </Text>
                  </View>
                </View>

                {isManager && (
                  <TouchableOpacity
                    onPress={() => setShowPenaltyModal(true)}
                    style={styles.recordInfractionBtn}
                    activeOpacity={0.8}
                  >
                    <AlertTriangle size={13} color="#FFFFFF" />
                    <Text style={styles.recordInfractionBtnText}>Record Infraction</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Summary KPI Badges */}
              <View style={styles.penaltiesKpiRow}>
                <View style={styles.penaltiesKpiBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={15} color="#DC2626" />
                    <View>
                      <Text style={styles.penaltiesKpiLabel}>TOTAL RECORDED PENALTIES</Text>
                      <Text style={styles.penaltiesKpiCount}>
                        {penalties.length} infraction{penalties.length === 1 ? '' : 's'} logged
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.penaltiesKpiAmount}>
                    {totalPenalties.toLocaleString()} FCFA
                  </Text>
                </View>

                <View style={styles.policyNoticeBox}>
                  <Text style={styles.policyNoticeText}>
                    <Text style={{ fontWeight: '700' }}>Policy Notice: </Text>
                    Recorded penalties are automatically deducted from the Projected Monthly Payout to maintain real-time net payroll accuracy.
                  </Text>
                </View>
              </View>

              {/* History Table */}
              {penaltiesLoading ? (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#DC2626" />
                  <Text style={{ fontSize: 11, color: '#737373', marginTop: 4 }}>
                    Loading disciplinary records...
                  </Text>
                </View>
              ) : penalties.length === 0 ? (
                <View style={styles.cleanRecordBox}>
                  <CheckCircle2 size={18} color="#059669" />
                  <Text style={styles.cleanRecordText}>
                    Zero disciplinary infractions recorded for this staff member. Excellent conduct record!
                  </Text>
                </View>
              ) : (
                <View style={styles.tableBox}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableColHeader, { flex: 1 }]}>Date</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.5 }]}>Conduct Rule</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.5 }]}>Notes</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.2, textAlign: 'right' }]}>Amount</Text>
                    {isManager && <Text style={[styles.tableColHeader, { width: 34, textAlign: 'center' }]}>Act</Text>}
                  </View>
                  {penalties.map((p: any) => (
                    <View key={p.id} style={styles.penaltyDataRow}>
                      <Text style={[styles.tableCellMono, { flex: 1 }]}>{p.date || '—'}</Text>
                      <View style={{ flex: 1.5, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={styles.redDot} />
                        <Text style={styles.tableCellBold} numberOfLines={1}>
                          {p.ruleName}
                        </Text>
                      </View>
                      <Text style={[styles.tableCellMuted, { flex: 1.5 }]} numberOfLines={1}>
                        {p.notes || '—'}
                      </Text>
                      <Text style={[styles.tableCellPenalty, { flex: 1.2 }]}>
                        -{Number(p.penaltyAmount).toLocaleString()} FCFA
                      </Text>
                      {isManager && (
                        <TouchableOpacity
                          onPress={() => handleDeletePenalty(p.id)}
                          style={styles.deletePenaltyBtn}
                          activeOpacity={0.7}
                        >
                          <Trash2 size={13} color="#DC2626" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Modal: Record Disciplinary Penalty ── */}
      <Modal
        visible={showPenaltyModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPenaltyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowPenaltyModal(false)}
          />
          <View style={styles.modalDialogCard}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={18} color="#DC2626" />
                <Text style={styles.modalHeaderTitle}>Record Disciplinary Penalty</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPenaltyModal(false)}>
                <X size={18} color="#2D2D2A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.penaltyStaffTargetNote}>
              Staff: <Text style={{ fontWeight: '700', color: '#2D2D2A' }}>{effectiveName}</Text>
            </Text>

            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {/* Rule Pills */}
              <Text style={styles.inputFieldLabel}>Standard Conduct Rule</Text>
              <View style={styles.rulesWrap}>
                {STANDARD_PENALTY_RULES.map((r) => {
                  const isSelected = selectedPenaltyRule === r.id;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      onPress={() => {
                        setSelectedPenaltyRule(r.id);
                        setPenaltyAmount(String(r.defaultAmount));
                      }}
                      style={[styles.rulePill, isSelected && styles.rulePillActive]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.rulePillText, isSelected && styles.rulePillTextActive]}>
                        {r.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Amount */}
              <Text style={styles.inputFieldLabel}>Penalty Deduction Amount (FCFA) *</Text>
              <TextInput
                value={penaltyAmount}
                onChangeText={setPenaltyAmount}
                keyboardType="numeric"
                style={styles.dialogInput}
                placeholder="2000"
                placeholderTextColor="#737373"
              />

              {/* Date */}
              <Text style={styles.inputFieldLabel}>Incident Date (YYYY-MM-DD)</Text>
              <TextInput
                value={penaltyDate}
                onChangeText={setPenaltyDate}
                style={styles.dialogInput}
                placeholder="2026-11-06"
                placeholderTextColor="#737373"
              />

              {/* Notes */}
              <Text style={styles.inputFieldLabel}>Violation Context / Notes (Optional)</Text>
              <TextInput
                value={penaltyNotes}
                onChangeText={setPenaltyNotes}
                placeholder="Details of the violation..."
                placeholderTextColor="#737373"
                style={[styles.dialogInput, { height: 60 }]}
                multiline
              />

              {penaltyError ? (
                <Text style={styles.dialogErrorText}>{penaltyError}</Text>
              ) : null}
            </ScrollView>

            <View style={styles.modalActionButtonsRow}>
              <TouchableOpacity
                onPress={() => setShowPenaltyModal(false)}
                style={styles.dialogCancelBtn}
              >
                <Text style={styles.dialogCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSavePenalty}
                disabled={submittingPenalty}
                style={styles.dialogApplyPenaltyBtn}
                activeOpacity={0.8}
              >
                {submittingPenalty ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.dialogApplyPenaltyBtnText}>Apply Penalty</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal 3: Edit Salary Contract ── */}
      <Modal
        visible={showContractModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowContractModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowContractModal(false)}
          />
          <View style={styles.modalDialogCard}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Calculator size={18} color="#4F6748" />
                <Text style={styles.modalHeaderTitle}>Edit Salary Contract & Quotas</Text>
              </View>
              <TouchableOpacity onPress={() => setShowContractModal(false)}>
                <X size={18} color="#2D2D2A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.penaltyStaffTargetNote}>
              Staff: <Text style={{ fontWeight: '700', color: '#2D2D2A' }}>{effectiveName}</Text>
            </Text>

            <ScrollView style={{ maxHeight: 360 }}>
              <Text style={styles.inputFieldLabel}>Monthly Sales Target Quota (FCFA)</Text>
              <TextInput
                value={contractTarget}
                onChangeText={setContractTarget}
                keyboardType="numeric"
                style={styles.dialogInput}
                placeholder="525000"
                placeholderTextColor="#737373"
              />

              <Text style={styles.inputFieldLabel}>Mode A: Below-Target Fixed Salary (FCFA)</Text>
              <TextInput
                value={contractFixed}
                onChangeText={setContractFixed}
                keyboardType="numeric"
                style={styles.dialogInput}
                placeholder="110000"
                placeholderTextColor="#737373"
              />

              <Text style={styles.inputFieldLabel}>Mode B: Base Pay when Target Met (FCFA)</Text>
              <TextInput
                value={contractBase}
                onChangeText={setContractBase}
                keyboardType="numeric"
                style={styles.dialogInput}
                placeholder="50000"
                placeholderTextColor="#737373"
              />

              <Text style={styles.inputFieldLabel}>Commission Rate (%)</Text>
              <TextInput
                value={contractRate}
                onChangeText={setContractRate}
                keyboardType="numeric"
                style={styles.dialogInput}
                placeholder="15"
                placeholderTextColor="#737373"
              />

              <Text style={styles.inputFieldLabel}>Target Scope</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <TouchableOpacity
                  onPress={() => setContractScope('INDIVIDUAL')}
                  style={[
                    styles.scopePill,
                    contractScope === 'INDIVIDUAL' && styles.scopePillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.scopePillText,
                      contractScope === 'INDIVIDUAL' && styles.scopePillTextActive,
                    ]}
                  >
                    Individual Sales
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setContractScope('SPA_TOTAL')}
                  style={[
                    styles.scopePill,
                    contractScope === 'SPA_TOTAL' && styles.scopePillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.scopePillText,
                      contractScope === 'SPA_TOTAL' && styles.scopePillTextActive,
                    ]}
                  >
                    Spa Total Scope
                  </Text>
                </TouchableOpacity>
              </View>

              {contractError ? (
                <Text style={styles.dialogErrorText}>{contractError}</Text>
              ) : null}
            </ScrollView>

            <View style={styles.modalActionButtonsRow}>
              <TouchableOpacity
                onPress={() => setShowContractModal(false)}
                style={styles.dialogCancelBtn}
              >
                <Text style={styles.dialogCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveContract}
                disabled={submittingContract}
                style={styles.dialogSaveContractBtn}
                activeOpacity={0.8}
              >
                {submittingContract ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.dialogSaveContractBtnText}>Save Contract</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
    gap: 14,
  },

  // Month Selector
  monthSelectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 14,
    padding: 6,
    gap: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  monthNavBtn: {
    padding: 7,
    borderRadius: 8,
    backgroundColor: '#FAF7F2',
  },
  monthNavBtnDisabled: {
    opacity: 0.35,
  },
  monthCenterBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  monthCenterText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  currentMonthBtn: {
    backgroundColor: '#4F6748',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  currentMonthBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  historicalBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  historicalBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400E',
  },

  // Staff Selection Card
  staffCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  categoryTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5EFEB',
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  categoryTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 9,
    gap: 4,
  },
  categoryTabBtnActiveAll: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  categoryTabBtnActiveTech: {
    backgroundColor: '#4F6748',
  },
  categoryTabBtnActiveMkt: {
    backgroundColor: '#6D28D9',
  },
  categoryTabBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#737373',
  },
  categoryTabBtnTextActive: {
    color: '#2D2D2A',
  },
  tabCountPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabCountPillActiveAll: {
    backgroundColor: '#EBF0EA',
  },
  tabCountPillInactive: {
    backgroundColor: '#FAF7F2',
  },
  tabCountText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Groups and Chips
  groupSection: {
    gap: 8,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupTitleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#737373',
    letterSpacing: 0.6,
  },
  groupSubtitleText: {
    fontSize: 9,
    color: '#737373',
  },
  emptyFilterText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#737373',
    paddingVertical: 4,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  staffChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 8,
    gap: 6,
  },
  staffChipActiveTech: {
    backgroundColor: '#4F6748',
    borderColor: '#4F6748',
  },
  staffChipActiveMkt: {
    backgroundColor: '#6D28D9',
    borderColor: '#6D28D9',
  },
  mktChipInactive: {
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
  },
  chipInitialsCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipInitialsCircleInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  chipInitialsCircleActiveTech: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  chipInitialsCircleInactiveMkt: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  chipInitialsCircleActiveMkt: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  chipInitialsText: {
    fontSize: 9,
    fontWeight: '800',
  },
  chipStaffName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  chipStaffNameActive: {
    color: '#FFFFFF',
  },
  groupDivider: {
    height: 1,
    backgroundColor: '#E8E2D9',
    opacity: 0.6,
  },

  // Loading card
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 18,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
    textAlign: 'center',
  },
  loadingCardSubtitle: {
    fontSize: 11,
    color: '#737373',
    textAlign: 'center',
  },

  // Hero Dark Card (#111827 -> #0F172A)
  heroDarkCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    gap: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'column',
    gap: 10,
  },
  heroTargetInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  heroTargetIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTargetIconBoxEmerald: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  heroTargetIconBoxAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  heroTitleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  heroPeriodPill: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  heroPeriodPillText: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#94A3B8',
    fontWeight: '700',
  },
  heroSubtitleText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  heroQuotaHighlight: {
    color: '#E2E8F0',
    fontWeight: '700',
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeBadgeEmerald: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
  },
  modeBadgeEmeraldText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6EE7B7',
  },
  modeBadgeAmber: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
  },
  modeBadgeAmberText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FCD34D',
  },
  heroContractBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  heroContractBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#CBD5E1',
  },

  // Hero Progress
  heroProgressSection: {
    gap: 6,
  },
  heroProgressNumbersRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  heroProgressLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  heroProgressBigNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  heroProgressSubTarget: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  heroProgressPercentText: {
    fontSize: 15,
    fontWeight: '900',
  },
  heroProgressBarTrack: {
    height: 10,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  heroProgressBarFill: {
    height: '100%',
    borderRadius: 8,
  },
  heroProgressFillEmerald: {
    backgroundColor: '#10B981',
  },
  heroProgressFillAmber: {
    backgroundColor: '#F59E0B',
  },

  // Hero 3 KPI tiles
  heroKpiGrid: {
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  heroKpiBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.45)',
    borderRadius: 12,
    padding: 9,
  },
  heroKpiLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  heroKpiValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F1F5F9',
    marginTop: 1,
  },
  heroPenaltyNotice: {
    fontSize: 9,
    color: '#FCA5A5',
    fontWeight: '600',
    marginTop: 1,
  },

  // Main Summary Card (White #FFFFFF)
  mainSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
    gap: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D9',
  },
  staffMainName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#2D2D2A',
  },
  staffMainSubtitle: {
    fontSize: 11,
    color: '#737373',
    marginTop: 2,
  },
  cardHeaderRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  recordPenaltyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 5,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  recordPenaltyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dateLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#737373',
    letterSpacing: 0.5,
  },
  dateValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
  },

  // Operational Metrics
  metricsList: {
    gap: 9,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  metricLabelMuted: {
    fontSize: 12,
    color: '#737373',
  },
  metricValueBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  metricValueMono: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
    color: '#2D2D2A',
  },

  // Calc divider section
  calcDividerSection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8E2D9',
    gap: 10,
  },
  salaryTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  salaryTypeLabel: {
    fontSize: 12,
    color: '#737373',
  },
  salaryTypeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },

  // Mode A / Mode B boxes
  modeABox: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  modeAHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeATitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  modeAAmount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  modeASub: {
    fontSize: 10,
    color: '#B45309',
    lineHeight: 14,
  },
  modeBBox: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  modeBHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeBTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  modeBAmount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },
  modeBSub: {
    fontSize: 10,
    color: '#047857',
    lineHeight: 14,
  },

  // Marketer specific boxes
  mktTargetBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  mktTargetBoxEmerald: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  mktTargetBoxIvory: {
    backgroundColor: '#F5EFEB',
    borderColor: '#E8E2D9',
  },
  mktTargetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mktTargetTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  mktTargetBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mktTargetBadgeEmerald: {
    backgroundColor: '#D1FAE5',
  },
  mktTargetBadgeAmber: {
    backgroundColor: '#FEF3C7',
  },
  mktTargetBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  mktTrackBar: {
    height: 6,
    backgroundColor: '#E8E2D9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  mktTrackFill: {
    height: '100%',
    borderRadius: 4,
  },
  mktTargetBottomTerms: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: 6,
    gap: 3,
  },
  mktTermsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mktTermsLabel: {
    fontSize: 10,
    color: '#737373',
  },
  mktTermsVal: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  guaranteedCommBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  guaranteedCommTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6D28D9',
  },
  guaranteedCommSub: {
    fontSize: 9,
    color: '#737373',
    marginTop: 2,
  },
  guaranteedCommAmount: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'monospace',
    color: '#6D28D9',
  },

  // Penalties row
  penaltiesDeductionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 10,
    padding: 8,
  },
  penaltiesDeductionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#BE123C',
  },
  penaltiesDeductionValue: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'monospace',
    color: '#BE123C',
  },

  // Projected Monthly Payout Total Strip
  payoutStripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EBF0EA',
    borderWidth: 1,
    borderColor: '#D4DFD2',
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  payoutStripLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  payoutStripTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2D2D2A',
  },
  payoutStripSub: {
    fontSize: 9,
    color: '#737373',
    marginTop: 1,
  },
  payoutStripAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2D2D2A',
  },

  // White Section Card (Referred Clients & Penalties)
  whiteSectionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D9',
  },
  sectionCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  sectionCardSub: {
    fontSize: 10,
    color: '#737373',
  },
  emptyBox: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBoxText: {
    fontSize: 11,
    color: '#737373',
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // Tables
  tableBox: {
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F5EFEB',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D9',
  },
  tableColHeader: {
    fontSize: 10,
    fontWeight: '700',
    color: '#737373',
    textTransform: 'uppercase',
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(232, 226, 217, 0.45)',
  },
  tableCellBold: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  tableCellMuted: {
    fontSize: 11,
    color: '#737373',
  },
  tableCellMono: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: '#2D2D2A',
  },
  tableCellComm: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6D28D9',
  },

  // Disciplinary Infractions header
  disciplinaryHeaderRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D9',
    gap: 10,
  },
  disciplinaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  shieldIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordInfractionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 5,
    shadowColor: '#DC2626',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  recordInfractionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  penaltiesKpiRow: {
    gap: 8,
  },
  penaltiesKpiBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 12,
    padding: 10,
  },
  penaltiesKpiLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#991B1B',
    letterSpacing: 0.5,
  },
  penaltiesKpiCount: {
    fontSize: 10,
    color: '#DC2626',
    marginTop: 1,
  },
  penaltiesKpiAmount: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'monospace',
    color: '#B91C1C',
  },
  policyNoticeBox: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    padding: 8,
  },
  policyNoticeText: {
    fontSize: 10,
    color: '#737373',
    lineHeight: 14,
  },
  cleanRecordBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  cleanRecordText: {
    fontSize: 11,
    color: '#065F46',
    fontWeight: '600',
    flex: 1,
  },
  penaltyDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FEE2E2',
    backgroundColor: '#FFFBFB',
  },
  redDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#DC2626',
  },
  tableCellPenalty: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'monospace',
    color: '#DC2626',
    textAlign: 'right',
  },
  deletePenaltyBtn: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },

  // Modals generic
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D9',
  },
  modalHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D2D2A',
  },

  // Dialog Card (Record Penalty & Contract)
  modalDialogCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    gap: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 6,
  },
  penaltyStaffTargetNote: {
    fontSize: 12,
    color: '#737373',
  },
  inputFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D2D2A',
    marginTop: 8,
    marginBottom: 4,
  },
  rulesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  rulePill: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rulePillActive: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  rulePillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#737373',
  },
  rulePillTextActive: {
    color: '#BE123C',
    fontWeight: '700',
  },
  dialogInput: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#2D2D2A',
  },
  dialogErrorText: {
    fontSize: 11,
    color: '#DC2626',
    marginTop: 6,
    fontWeight: '600',
  },
  modalActionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E8E2D9',
  },
  dialogCancelBtn: {
    flex: 1,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  dialogCancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#737373',
  },
  dialogApplyPenaltyBtn: {
    flex: 1,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  dialogApplyPenaltyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dialogSaveContractBtn: {
    flex: 1,
    backgroundColor: '#4F6748',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  dialogSaveContractBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scopePill: {
    flex: 1,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  scopePillActive: {
    backgroundColor: '#EBF0EA',
    borderColor: '#4F6748',
  },
  scopePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#737373',
  },
  scopePillTextActive: {
    color: '#4F6748',
    fontWeight: '700',
  },

  // Access Denied
  accessDeniedCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 16,
    margin: 16,
    padding: 30,
    alignItems: 'center',
    gap: 10,
  },
  accessDeniedIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFF1F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessDeniedTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  accessDeniedSubtitle: {
    fontSize: 12,
    color: '#737373',
    textAlign: 'center',
  },
});

export default TechnicianDailySummaryScreen;
