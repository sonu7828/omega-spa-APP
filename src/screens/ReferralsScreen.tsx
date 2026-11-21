/**
 * ReferralsScreen — 1-to-1 Exact Match with Omega Spa POS Web Software
 * Matches frontend/src/pages/Referrals.jsx & Web POS Screenshot:
 * - Header: Title "Employee Referrals & Commissions" (or "My Commissions" for Tech), Subtitle
 * - Section 1: Referral Commission Rule (Manager only):
 *     - Reward Mode Switcher: [ Percentage (%) ] vs [ Fixed Amount (FCFA) ]
 *     - Percentage Mode: Manual numeric input (NOT preset chips) with '%' suffix + [ Save Percentage ] button
 *     - Fixed Mode: Manual numeric input with 'FCFA' suffix + [ Save Fixed Amount ] button
 *     - Real-time save via commissionsApi.saveRule & toast confirmation
 * - Section 2: Employee Commission Performance (Matching Web Screenshot 2):
 *     - Total Commission badge: "Total Commission: 207,020 FCFA"
 *     - Staff Cards for each technician:
 *         - Staff Name, Specialty / Role ("Nail Tech", "Body Massage"), Avatar with 2-letter initials ("SA", "FO")
 *         - Metric Box 1: CLIENTS REFERRED (Counts real clients introduced by this staff)
 *         - Metric Box 2: SERVICES PAID (Counts real paid service commissions)
 *         - Bottom row: "Commission Earned:" with FCFA total
 * - Section 3: Commission History & Audit Ledger:
 *     - Search input + Status filters (ALL, APPROVED, PENDING)
 *     - Record items: Date, Service, Client, Price, Commission Rate, Total Commission, Status badge
 *     - Manager One-click [Approve] action
 * - Technician Personal Mode:
 *     - Personal summary cards & own commission ledger only
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {
  TrendingUp,
  Settings,
  Percent,
  Coins,
  Save,
  CheckCircle2,
  Check,
  Search,
  X,
  Filter,
  ShieldAlert,
} from 'lucide-react-native';
import Header from '../components/Header';
import Card from '../components/Card';
import THEME from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useCommissions, CommissionItem, EmployeeCommissionSummary } from '../context/CommissionContext';
import { formatFCFA } from '../utils/currency';

interface ReferralsScreenProps {
  onOpenMenu?: () => void;
}

export const ReferralsScreen: React.FC<ReferralsScreenProps> = ({ onOpenMenu }) => {
  const { user } = useAuth();
  const role = (user?.role || '').toLowerCase();
  const isManager = role === 'manager';
  const isTechnician = role === 'technician';
  const isCleaner = role === 'cleaner';

  const {
    commissions,
    commissionRate,
    commissionFixedAmount,
    commissionRuleMode,
    summary,
    loading,
    refreshCommissions,
    setCommissionRule,
    approveCommission,
    getAllEmployeeSummaries,
  } = useCommissions();

  // Notice Toast State
  const [notice, setNotice] = useState<string>('');

  const showToast = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3500);
  };

  // Rule Setup State (Manual Input)
  const [ruleMode, setRuleMode] = useState<'percentage' | 'fixed'>(
    commissionRuleMode || (commissionFixedAmount ? 'fixed' : 'percentage')
  );
  const [customPercentInput, setCustomPercentInput] = useState<string>(
    commissionRate ? String(commissionRate) : '10'
  );
  const [customAmountInput, setCustomAmountInput] = useState<string>(
    commissionFixedAmount ? String(commissionFixedAmount) : '2000'
  );
  const [isSavingRule, setIsSavingRule] = useState<boolean>(false);

  // Sync inputs when context updates
  useEffect(() => {
    if (commissionRuleMode) setRuleMode(commissionRuleMode);
    if (commissionRate) setCustomPercentInput(String(commissionRate));
    if (commissionFixedAmount) setCustomAmountInput(String(commissionFixedAmount));
  }, [commissionRuleMode, commissionRate, commissionFixedAmount]);

  // History Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING'>('ALL');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Employee Summaries from real data (identical to web software)
  const employeeSummaries: EmployeeCommissionSummary[] = useMemo(() => {
    if (isTechnician) return [];
    return getAllEmployeeSummaries();
  }, [isTechnician, getAllEmployeeSummaries]);

  // Total Commission Paid across all records
  const totalCommissionPaid = useMemo(() => {
    if (summary?.totalEarned && summary.totalEarned > 0) {
      return summary.totalEarned;
    }
    return commissions.reduce((sum, c) => sum + (c.commissionAmount || 0), 0);
  }, [summary, commissions]);

  // Filtered Commission History
  const filteredCommissions = useMemo(() => {
    let list = commissions;

    // If technician, scope to own only
    if (isTechnician && user?.id) {
      list = list.filter(
        (c) =>
          c.performingTechnicianId === user.id ||
          c.referralEmployeeId === user.id ||
          c.performingTechnician.toLowerCase().includes(user.name.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      list = list.filter((c) => c.rawStatus.toUpperCase() === statusFilter);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.performingTechnician.toLowerCase().includes(q) ||
          c.referralEmployee.toLowerCase().includes(q) ||
          c.client.toLowerCase().includes(q) ||
          c.service.toLowerCase().includes(q) ||
          (c.invoiceNumber && c.invoiceNumber.toLowerCase().includes(q)) ||
          c.date.toLowerCase().includes(q)
      );
    }

    return list;
  }, [commissions, isTechnician, user, statusFilter, searchQuery]);

  // Handle Save Percentage Rule
  const handleApplyPercentage = async () => {
    if (!isManager) return;
    const num = Number(customPercentInput);
    if (isNaN(num) || num < 0) {
      Alert.alert('Invalid Input', 'Please enter a valid percentage between 0 and 100');
      return;
    }
    const parsed = Math.min(100, Math.max(0, num));
    setIsSavingRule(true);
    try {
      const res = await setCommissionRule({
        mode: 'percentage',
        percentage: parsed,
      });
      if (res.success) {
        showToast(`Referral Commission Rule updated to ${parsed}%.`);
      } else {
        Alert.alert('Error', res.error || 'Failed to update commission percentage');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update commission percentage');
    } finally {
      setIsSavingRule(false);
    }
  };

  // Handle Save Fixed Amount Rule
  const handleApplyFixedAmount = async () => {
    if (!isManager) return;
    const num = Number(customAmountInput);
    if (isNaN(num) || num < 0) {
      Alert.alert('Invalid Input', 'Please enter a valid fixed amount in FCFA');
      return;
    }
    const parsed = Math.max(0, Math.round(num));
    setIsSavingRule(true);
    try {
      const res = await setCommissionRule({
        mode: 'fixed',
        fixedAmount: parsed,
      });
      if (res.success) {
        showToast(`Referral Commission Rule updated to ${parsed.toLocaleString('en-US')} FCFA (Fixed).`);
      } else {
        Alert.alert('Error', res.error || 'Failed to update fixed commission');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update fixed commission');
    } finally {
      setIsSavingRule(false);
    }
  };

  // Handle Approve Commission
  const handleApprove = async (commId: string) => {
    if (!isManager) return;
    setApprovingId(commId);
    try {
      const res = await approveCommission(commId);
      if (res.success) {
        showToast('Commission approved successfully.');
      } else {
        Alert.alert('Error', res.error || 'Failed to approve commission');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to approve commission');
    } finally {
      setApprovingId(null);
    }
  };

  // Block Cleaner
  if (isCleaner) {
    return (
      <View style={styles.container}>
        <Header title="Referrals & Commission" onOpenMenu={onOpenMenu} />
        <View style={styles.restrictedBox}>
          <ShieldAlert size={36} color="#DC2626" />
          <Text style={styles.restrictedTitle}>Access Restricted</Text>
          <Text style={styles.restrictedSubtitle}>
            Cleaning staff do not have access to financial referral and commission records.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header — 1-to-1 Web POS Match */}
      <Header
        title={
          isManager
            ? 'Employee Referrals & Commissions'
            : isTechnician
            ? 'My Commissions'
            : 'Employee Commissions'
        }
        subtitle={
          isManager
            ? 'Employee referral commission rules, staff performance reports, and payout ledger.'
            : isTechnician
            ? 'Your personal referral and service commission history.'
            : 'Employee referral performance and commission visibility.'
        }
        onOpenMenu={onOpenMenu}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refreshCommissions}
            tintColor="#4F6748"
          />
        }
      >
        {/* Notice Toast */}
        {!!notice && (
          <View style={styles.noticeToast}>
            <CheckCircle2 size={16} color="#4F6748" />
            <Text style={styles.noticeToastText}>{notice}</Text>
          </View>
        )}

        {/* ========================================================================= */}
        {/* SECTION 1: REFERRAL COMMISSION RULE (Manager Only — Exact Web View Match) */}
        {/* ========================================================================= */}
        {isManager && (
          <Card style={styles.card}>
            {/* Header with Title & Default Rule Pill */}
            <View style={styles.ruleHeaderRow}>
              <View style={styles.ruleTitleLeft}>
                <View style={styles.settingsIconCircle}>
                  <Settings size={18} color="#4F6748" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ruleCardTitle}>Referral Commission Rule</Text>
                  <Text style={styles.ruleCardSubtitle}>
                    Configure how employees are rewarded when referred clients pay for services.
                  </Text>
                </View>
              </View>

              <View style={styles.defaultRulePill}>
                <Text style={styles.defaultRuleLabel}>Default Rule:</Text>
                <Text style={styles.defaultRuleValue}>
                  {ruleMode === 'fixed' && commissionFixedAmount
                    ? `${Number(commissionFixedAmount).toLocaleString('en-US')} FCFA (Fixed)`
                    : `${commissionRate || 10}%`}
                </Text>
              </View>
            </View>

            {/* Mode Switcher Tabs */}
            <View style={styles.rewardModeSection}>
              <Text style={styles.rewardModeLabel}>Commission Reward Mode</Text>
              <View style={styles.modeTabsGrid}>
                {/* 1. Percentage Mode Tab */}
                <TouchableOpacity
                  onPress={() => setRuleMode('percentage')}
                  style={[
                    styles.modeTabButton,
                    ruleMode === 'percentage' && styles.modeTabButtonActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.modeTabIconBox,
                      ruleMode === 'percentage' && styles.modeTabIconBoxActive,
                    ]}
                  >
                    <Percent size={16} color={ruleMode === 'percentage' ? '#FFFFFF' : '#2D2D2A'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.modeTabTitleRow}>
                      <Text style={styles.modeTabTitle}>Percentage Commission (%)</Text>
                      {ruleMode === 'percentage' && (
                        <CheckCircle2 size={13} color="#4F6748" />
                      )}
                    </View>
                    <Text style={styles.modeTabSub}>
                      Calculated as a % share of the client's paid invoice total.
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 2. Fixed Amount Mode Tab */}
                <TouchableOpacity
                  onPress={() => setRuleMode('fixed')}
                  style={[
                    styles.modeTabButton,
                    ruleMode === 'fixed' && styles.modeTabButtonActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.modeTabIconBox,
                      ruleMode === 'fixed' && styles.modeTabIconBoxActive,
                    ]}
                  >
                    <Coins size={16} color={ruleMode === 'fixed' ? '#FFFFFF' : '#2D2D2A'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.modeTabTitleRow}>
                      <Text style={styles.modeTabTitle}>Fixed Amount (FCFA)</Text>
                      {ruleMode === 'fixed' && (
                        <CheckCircle2 size={13} color="#4F6748" />
                      )}
                    </View>
                    <Text style={styles.modeTabSub}>
                      A guaranteed flat cash reward per referred client invoice.
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Manual Parameter Input Row — EXACT WEB MATCH */}
            {ruleMode === 'percentage' ? (
              <View style={styles.ruleInputSection}>
                <Text style={styles.inputLabelText}>Commission Percentage (%)</Text>
                <View style={styles.inputActionRow}>
                  {/* Manual Number TextInput with % Suffix */}
                  <View style={styles.textInputWrapper}>
                    <TextInput
                      style={styles.numericTextInput}
                      value={customPercentInput}
                      onChangeText={setCustomPercentInput}
                      keyboardType="decimal-pad"
                      placeholder="e.g. 1, 5, 10"
                      placeholderTextColor="#A1A1AA"
                    />
                    <Text style={styles.inputSuffix}>%</Text>
                  </View>

                  {/* Save Percentage Button */}
                  <TouchableOpacity
                    onPress={handleApplyPercentage}
                    disabled={isSavingRule || !customPercentInput}
                    style={[
                      styles.saveRuleBtn,
                      (isSavingRule || !customPercentInput) && { opacity: 0.6 },
                    ]}
                    activeOpacity={0.85}
                  >
                    {isSavingRule ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Save size={14} color="#FFFFFF" strokeWidth={2.5} />
                    )}
                    <Text style={styles.saveRuleBtnText}>Save Percentage</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.ruleHelperText}>
                  Calculated automatically on invoice payment. Performing technician productivity remains 100% untouched.
                </Text>
              </View>
            ) : (
              <View style={styles.ruleInputSection}>
                <Text style={styles.inputLabelText}>Fixed Commission Reward Amount (FCFA)</Text>
                <View style={styles.inputActionRow}>
                  {/* Manual Number TextInput with FCFA Suffix */}
                  <View style={styles.textInputWrapper}>
                    <TextInput
                      style={styles.numericTextInput}
                      value={customAmountInput}
                      onChangeText={setCustomAmountInput}
                      keyboardType="numeric"
                      placeholder="e.g. 2000, 5000"
                      placeholderTextColor="#A1A1AA"
                    />
                    <Text style={styles.inputSuffix}>FCFA</Text>
                  </View>

                  {/* Save Fixed Amount Button */}
                  <TouchableOpacity
                    onPress={handleApplyFixedAmount}
                    disabled={isSavingRule || !customAmountInput}
                    style={[
                      styles.saveRuleBtn,
                      (isSavingRule || !customAmountInput) && { opacity: 0.6 },
                    ]}
                    activeOpacity={0.85}
                  >
                    {isSavingRule ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Save size={14} color="#FFFFFF" strokeWidth={2.5} />
                    )}
                    <Text style={styles.saveRuleBtnText}>Save Fixed Amount</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.ruleHelperText}>
                  Awarded as a flat cash commission per paid invoice of clients introduced by this employee, regardless of invoice total.
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* ========================================================================= */}
        {/* SECTION 2: EMPLOYEE COMMISSION PERFORMANCE (Matching Web Screenshot 2)   */}
        {/* ========================================================================= */}
        {!isTechnician && (
          <Card style={styles.card}>
            {/* Header with Title, Subtitle, and Total Commission Pill */}
            <View style={styles.performanceHeaderRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.performanceTitleRow}>
                  <TrendingUp size={18} color="#4F6748" />
                  <Text style={styles.performanceTitle}>Employee Commission Performance</Text>
                </View>
                <Text style={styles.performanceSubtitle}>
                  Overview of services completed and total commission earned per staff member.
                </Text>
              </View>

              <View style={styles.totalCommissionBanner}>
                <Text style={styles.totalCommissionBannerText}>
                  Total Commission:{' '}
                  <Text style={styles.totalCommissionBannerValue}>
                    {formatFCFA(totalCommissionPaid)}
                  </Text>
                </Text>
              </View>
            </View>

            {/* List of Staff Cards — 1-to-1 Web POS Match */}
            <View style={styles.staffCardsList}>
              {employeeSummaries.map((emp) => {
                const initials = emp.name
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                return (
                  <View key={emp.id} style={styles.staffCard}>
                    {/* Top Row: Staff Name, Role/Specialty, Avatar */}
                    <View style={styles.staffCardTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.staffNameText}>{emp.name}</Text>
                        <Text style={styles.staffRoleText}>{emp.role}</Text>
                      </View>
                      <View style={styles.staffAvatarCircle}>
                        <Text style={styles.staffAvatarInitials}>{initials}</Text>
                      </View>
                    </View>

                    {/* Middle Row: 2 Metric Boxes Side-by-Side */}
                    <View style={styles.metricBoxesRow}>
                      {/* Box 1: CLIENTS REFERRED */}
                      <View style={styles.metricBox}>
                        <Text style={styles.metricBoxLabel}>CLIENTS REFERRED</Text>
                        <Text style={styles.metricBoxValue}>{emp.clientsReferred}</Text>
                      </View>

                      {/* Box 2: SERVICES PAID */}
                      <View style={styles.metricBox}>
                        <Text style={styles.metricBoxLabel}>SERVICES PAID</Text>
                        <Text style={styles.metricBoxValue}>{emp.completedServices}</Text>
                      </View>
                    </View>

                    {/* Bottom Row: Commission Earned */}
                    <View style={styles.staffCardBottomRow}>
                      <Text style={styles.earnedLabel}>Commission Earned:</Text>
                      <Text style={styles.earnedValue}>{formatFCFA(emp.commissionEarned)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        {/* ========================================================================= */}
        {/* SECTION 3: COMMISSION HISTORY & AUDIT LEDGER (Matching Web Software)     */}
        {/* ========================================================================= */}
        <Card style={styles.card}>
          <View style={styles.historyHeaderRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.historyTitleRow}>
                <Text style={styles.historyTitle}>
                  {isTechnician ? 'My Commission History' : 'Commission History'}
                </Text>
                <View style={styles.recordsCountPill}>
                  <Text style={styles.recordsCountText}>
                    {filteredCommissions.length}{' '}
                    {filteredCommissions.length === 1 ? 'record' : 'records'}
                  </Text>
                </View>
              </View>
              <Text style={styles.historySubtitle}>
                Ledger of paid services, commission amounts, bonuses, and approval status.
              </Text>
            </View>
          </View>

          {/* Search Bar & Status Filter */}
          <View style={styles.searchFilterRow}>
            <View style={styles.searchBarWrapper}>
              <Search size={14} color="#76766E" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search technician, service, date..."
                placeholderTextColor="#A1A1AA"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {!!searchQuery && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={14} color="#76766E" />
                </TouchableOpacity>
              )}
            </View>

            {/* Status Pills */}
            <View style={styles.statusPillsRow}>
              {(['ALL', 'APPROVED', 'PENDING'] as const).map((st) => (
                <TouchableOpacity
                  key={st}
                  onPress={() => setStatusFilter(st)}
                  style={[
                    styles.statusPillBtn,
                    statusFilter === st && styles.statusPillBtnActive,
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      statusFilter === st && styles.statusPillTextActive,
                    ]}
                  >
                    {st}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Records Table / List */}
          {filteredCommissions.length === 0 ? (
            <View style={styles.emptyHistoryBox}>
              <Text style={styles.emptyHistoryText}>
                {loading ? 'Loading commission records...' : 'No commissions recorded yet.'}
              </Text>
            </View>
          ) : (
            <View style={styles.historyItemsList}>
              {filteredCommissions.map((item) => {
                const isApproved = item.rawStatus === 'APPROVED' || item.rawStatus === 'PAID';
                const isApproving = approvingId === item.id;

                return (
                  <View key={item.id} style={styles.historyItemCard}>
                    {/* Top Row: Date, Service, Status */}
                    <View style={styles.historyItemTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyServiceText} numberOfLines={1}>
                          {item.service}
                        </Text>
                        <Text style={styles.historyClientMeta}>
                          {item.client} • {item.performingTechnician}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          isApproved ? styles.statusBadgeApproved : styles.statusBadgePending,
                        ]}
                      >
                        <Check size={10} color={isApproved ? '#059669' : '#D97706'} strokeWidth={2.5} />
                        <Text
                          style={[
                            styles.statusBadgeText,
                            isApproved ? styles.statusTextApproved : styles.statusTextPending,
                          ]}
                        >
                          {item.status}
                        </Text>
                      </View>
                    </View>

                    {/* Middle Row: Price, Rate, Commission Earned */}
                    <View style={styles.historyMetricsRow}>
                      <View style={styles.historyMetricCol}>
                        <Text style={styles.historyMetricLabel}>SERVICE PRICE</Text>
                        <Text style={styles.historyMetricVal}>{formatFCFA(item.serviceAmount)}</Text>
                      </View>
                      <View style={styles.historyMetricCol}>
                        <Text style={styles.historyMetricLabel}>RATE</Text>
                        <Text style={styles.historyMetricVal}>{item.commissionPercentage}%</Text>
                      </View>
                      <View style={styles.historyMetricColRight}>
                        <Text style={styles.historyMetricLabel}>COMMISSION</Text>
                        <Text style={styles.historyCommissionVal}>
                          {formatFCFA(item.commissionAmount)}
                        </Text>
                      </View>
                    </View>

                    {/* Bottom Row: Timestamp & Manager Approve Button */}
                    <View style={styles.historyItemBottom}>
                      <Text style={styles.historyDateText}>
                        {item.date} {item.invoiceNumber ? `• Inv #${item.invoiceNumber}` : ''}
                      </Text>

                      {isManager && !isApproved && (
                        <TouchableOpacity
                          onPress={() => handleApprove(item.id)}
                          disabled={isApproving}
                          style={styles.approveBtn}
                          activeOpacity={0.8}
                        >
                          {isApproving ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Check size={12} color="#FFFFFF" strokeWidth={2.5} />
                              <Text style={styles.approveBtnText}>Approve</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF7F2',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAE3D9',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  noticeToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF3EA',
    borderWidth: 1,
    borderColor: '#D0DED0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  noticeToastText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F6748',
    flex: 1,
  },

  // Section 1: Referral Commission Rule
  ruleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE4',
  },
  ruleTitleLeft: {
    flexDirection: 'row',
    gap: 10,
    flex: 1,
  },
  settingsIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF3EA',
    borderWidth: 1,
    borderColor: '#D0DED0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  ruleCardSubtitle: {
    fontSize: 11,
    color: '#76766E',
    marginTop: 2,
  },
  defaultRulePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FAF8F5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EAE3D9',
  },
  defaultRuleLabel: {
    fontSize: 11,
    color: '#76766E',
  },
  defaultRuleValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F6748',
  },
  rewardModeSection: {
    marginTop: 14,
  },
  rewardModeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
    marginBottom: 8,
  },
  modeTabsGrid: {
    gap: 8,
  },
  modeTabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAE3D9',
    backgroundColor: '#FFFFFF',
  },
  modeTabButtonActive: {
    backgroundColor: '#EEF3EA',
    borderColor: '#96AA88',
  },
  modeTabIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F6F1EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTabIconBoxActive: {
    backgroundColor: '#4F6748',
  },
  modeTabTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeTabTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  modeTabSub: {
    fontSize: 11,
    color: '#76766E',
    marginTop: 2,
  },
  ruleInputSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0ECE4',
  },
  inputLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
    marginBottom: 8,
  },
  inputActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textInputWrapper: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  numericTextInput: {
    borderWidth: 1,
    borderColor: '#EAE3D9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    paddingRight: 36,
    fontSize: 14,
    fontWeight: '600',
    color: '#2D2D2A',
    backgroundColor: '#FAF8F5',
  },
  inputSuffix: {
    position: 'absolute',
    right: 12,
    fontSize: 13,
    fontWeight: '700',
    color: '#76766E',
  },
  saveRuleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#4F6748',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveRuleBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  ruleHelperText: {
    fontSize: 11,
    color: '#76766E',
    marginTop: 8,
    lineHeight: 16,
  },

  // Section 2: Employee Commission Performance
  performanceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  performanceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  performanceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  performanceSubtitle: {
    fontSize: 11,
    color: '#76766E',
    marginTop: 2,
  },
  totalCommissionBanner: {
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#EAE3D9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  totalCommissionBannerText: {
    fontSize: 11,
    color: '#76766E',
  },
  totalCommissionBannerValue: {
    fontWeight: '800',
    color: '#2D2D2A',
  },
  staffCardsList: {
    gap: 12,
  },
  staffCard: {
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: 'rgba(229, 224, 216, 0.8)',
    borderRadius: 14,
    padding: 14,
  },
  staffCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229, 224, 216, 0.6)',
  },
  staffNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  staffRoleText: {
    fontSize: 11,
    color: '#76766E',
    marginTop: 2,
  },
  staffAvatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EEF3EA',
    borderWidth: 1,
    borderColor: '#D0DED0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffAvatarInitials: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F6748',
  },
  metricBoxesRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(229, 224, 216, 0.6)',
    borderRadius: 10,
    padding: 10,
  },
  metricBoxLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#76766E',
    letterSpacing: 0.3,
  },
  metricBoxValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2D2D2A',
    marginTop: 4,
  },
  staffCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(229, 224, 216, 0.6)',
  },
  earnedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#76766E',
  },
  earnedValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4F6748',
  },

  // Section 3: Commission History
  historyHeaderRow: {
    marginBottom: 12,
  },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  recordsCountPill: {
    backgroundColor: '#EEF3EA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  recordsCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F6748',
  },
  historySubtitle: {
    fontSize: 11,
    color: '#76766E',
    marginTop: 2,
  },
  searchFilterRow: {
    gap: 10,
    marginBottom: 12,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#EAE3D9',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#2D2D2A',
    padding: 0,
  },
  statusPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusPillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#EAE3D9',
  },
  statusPillBtnActive: {
    backgroundColor: '#4F6748',
    borderColor: '#4F6748',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#76766E',
  },
  statusPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emptyHistoryBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF8F5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EAE3D9',
  },
  emptyHistoryText: {
    fontSize: 12,
    color: '#76766E',
  },
  historyItemsList: {
    gap: 10,
  },
  historyItemCard: {
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#EAE3D9',
    borderRadius: 12,
    padding: 12,
  },
  historyItemTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  historyServiceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  historyClientMeta: {
    fontSize: 11,
    color: '#76766E',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  statusBadgeApproved: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusBadgePending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextApproved: {
    color: '#059669',
  },
  statusTextPending: {
    color: '#D97706',
  },
  historyMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(229, 224, 216, 0.6)',
    padding: 8,
    marginTop: 10,
  },
  historyMetricCol: {
    flex: 1,
  },
  historyMetricColRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  historyMetricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#76766E',
  },
  historyMetricVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
    marginTop: 2,
  },
  historyCommissionVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4F6748',
    marginTop: 2,
  },
  historyItemBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(229, 224, 216, 0.5)',
  },
  historyDateText: {
    fontSize: 11,
    color: '#76766E',
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // Restricted Access (Cleaners)
  restrictedBox: {
    margin: 20,
    padding: 30,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE3D9',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  restrictedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  restrictedSubtitle: {
    fontSize: 12,
    color: '#76766E',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default ReferralsScreen;
