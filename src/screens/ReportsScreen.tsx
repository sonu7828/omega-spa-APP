/**
 * ReportsScreen — 1-to-1 Match with Web Service Reports
 *
 * Provides deep insights into services performed by clients:
 *   1. Best Performers (Top selling services)
 *   2. Worst Performers (Low volume services with 1+ bookings)
 *   3. Ignored - 0% (Services nobody ever booked in the period)
 *
 * Shows for each service:
 *   - Service Name (& Category)
 *   - How many times sold
 *   - Total money made (FCFA)
 *   - How many clients bought it (Unique clients)
 *
 * Accessible strictly to MANAGER and RECEPTION.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import {
  TrendingUp,
  TrendingDown,
  AlertOctagon,
  Search,
  Users,
  DollarSign,
  Layers,
  Activity,
  BarChart2,
  Sparkles,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react-native';
import THEME from '../constants/theme';
import Header from '../components/Header';
import Card from '../components/Card';
import { formatFCFA } from '../utils/currency';
import { reportsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

interface ReportsScreenProps {
  onOpenMenu?: () => void;
}

export const ReportsScreen: React.FC<ReportsScreenProps> = ({ onOpenMenu }) => {
  const { user } = useAuth();
  const role = (user?.role || '').toLowerCase();
  const hasAccess = role === 'manager' || role === 'reception';

  const [period, setPeriod] = useState<string>('monthly');
  const [customRange, setCustomRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<'from' | 'to'>('from');
  const [calendarYear, setCalendarYear] = useState<number>(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(() => new Date().getMonth());

  const [activeTab, setActiveTab] = useState<'BEST' | 'WORST' | 'IGNORED'>('BEST');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [data, setData] = useState<any>({
    kpi: {
      totalCatalogServices: 0,
      performingServicesCount: 0,
      ignoredServicesCount: 0,
      totalServiceRevenue: 0,
      totalTimesSold: 0,
      totalUniqueClients: 0,
    },
    bestPerformers: [],
    worstPerformers: [],
    ignoredServices: [],
  });

  const fetchPerformanceReport = useCallback(async () => {
    if (!hasAccess) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const queryParams =
        period === 'custom'
          ? { period: 'custom', startDate: customRange.startDate, endDate: customRange.endDate }
          : period;

      const res = await reportsApi.getServicePerformance(queryParams);
      if (res?.data) {
        setData(res.data);
      }
    } catch (err: any) {
      console.warn('Could not load service performance report:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hasAccess, period, customRange]);

  useEffect(() => {
    fetchPerformanceReport();
  }, [fetchPerformanceReport]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPerformanceReport();
  };

  const openDatePicker = (target: 'from' | 'to') => {
    setDatePickerTarget(target);
    const dateStr = target === 'from' ? customRange.startDate : customRange.endDate;
    if (dateStr && dateStr.includes('-')) {
      const parts = dateStr.split('-');
      setCalendarYear(parseInt(parts[0], 10));
      setCalendarMonth(parseInt(parts[1], 10) - 1);
    } else {
      const now = new Date();
      setCalendarYear(now.getFullYear());
      setCalendarMonth(now.getMonth());
    }
    setIsDatePickerOpen(true);
  };

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const m = String(calendarMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const iso = `${calendarYear}-${m}-${d}`;
    if (datePickerTarget === 'from') {
      setCustomRange((prev) => ({ ...prev, startDate: iso }));
    } else {
      setCustomRange((prev) => ({ ...prev, endDate: iso }));
    }
    setIsDatePickerOpen(false);
  };

  const handleQuickPreset = (days: number) => {
    const end = new Date();
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    setCustomRange({
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    });
  };

  const handleMonthPreset = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    setCustomRange({
      startDate: start.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
    });
  };

  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const firstDayIndex = (new Date(calendarYear, calendarMonth, 1).getDay() + 6) % 7;
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(d);
    }
    return cells;
  }, [calendarYear, calendarMonth]);

  // Filter current active list
  const currentList = useMemo(() => {
    let list: any[] = [];
    if (activeTab === 'BEST') list = data.bestPerformers || [];
    else if (activeTab === 'WORST') list = data.worstPerformers || [];
    else if (activeTab === 'IGNORED') list = data.ignoredServices || [];

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (item) =>
        (item.serviceName && item.serviceName.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q))
    );
  }, [activeTab, data, searchQuery]);

  // Max value for horizontal comparison bars
  const maxChartValue = useMemo(() => {
    const list = activeTab === 'BEST' ? data.bestPerformers : data.worstPerformers;
    if (!list || list.length === 0) return 1;
    return Math.max(...list.slice(0, 5).map((it: any) => it.totalRevenue || 0), 1);
  }, [activeTab, data]);

  if (!hasAccess) {
    return (
      <View style={styles.accessDeniedContainer}>
        <AlertOctagon size={48} color="#EF4444" />
        <Text style={styles.accessDeniedTitle}>Access Restricted</Text>
        <Text style={styles.accessDeniedText}>
          Service Reports are strictly reserved for Manager and Reception staff.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FBF7F2' }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5B6E58" />}
      >
        <Header
          title="Service Reports"
          subtitle="Performance analytics for services performed by clients"
          onOpenMenu={onOpenMenu}
        />

        {/* Quick Period Selector */}
        <View style={styles.periodStripContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.periodStrip}
          >
            <TouchableOpacity
              onPress={() => setPeriod('today')}
              style={[styles.periodBtn, period === 'today' && styles.periodBtnActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.periodText, period === 'today' && styles.periodTextActive]}>
                Today
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPeriod('weekly')}
              style={[styles.periodBtn, (period === 'weekly' || period === '7d') && styles.periodBtnActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.periodText, (period === 'weekly' || period === '7d') && styles.periodTextActive]}>
                Last 7 Days
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPeriod('monthly')}
              style={[styles.periodBtn, (period === 'monthly' || period === '30d') && styles.periodBtnActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.periodText, (period === 'monthly' || period === '30d') && styles.periodTextActive]}>
                ⭐ Last 30 Days
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPeriod('custom')}
              style={[styles.periodBtn, period === 'custom' && styles.periodBtnActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.periodText, period === 'custom' && styles.periodTextActive]}>
                Custom Range
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Custom Date Range Card */}
        {period === 'custom' && (
          <Card style={styles.customRangeCard}>
            <View style={styles.customRangeHeader}>
              <View style={styles.customRangeTitleRow}>
                <Calendar size={14} color="#5B6E58" />
                <Text style={styles.customRangeTitle}>Custom Date Range</Text>
              </View>
              <Text style={styles.customRangeHint}>Tap date to change</Text>
            </View>

            <View style={styles.customRangeInputsRow}>
              {/* From Date */}
              <TouchableOpacity
                style={styles.dateSelectorBox}
                onPress={() => openDatePicker('from')}
                activeOpacity={0.7}
              >
                <Text style={styles.dateSelectorLabel}>FROM</Text>
                <View style={styles.dateSelectorValueRow}>
                  <Calendar size={13} color="#5B6E58" />
                  <Text style={styles.dateSelectorValue}>{customRange.startDate}</Text>
                </View>
              </TouchableOpacity>

              {/* To Date */}
              <TouchableOpacity
                style={styles.dateSelectorBox}
                onPress={() => openDatePicker('to')}
                activeOpacity={0.7}
              >
                <Text style={styles.dateSelectorLabel}>TO</Text>
                <View style={styles.dateSelectorValueRow}>
                  <Calendar size={13} color="#5B6E58" />
                  <Text style={styles.dateSelectorValue}>{customRange.endDate}</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Quick Shortcuts */}
            <View style={styles.presetsRow}>
              <TouchableOpacity
                onPress={() => handleQuickPreset(7)}
                style={styles.presetChip}
                activeOpacity={0.7}
              >
                <Text style={styles.presetChipText}>Past 7d</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleQuickPreset(14)}
                style={styles.presetChip}
                activeOpacity={0.7}
              >
                <Text style={styles.presetChipText}>Past 14d</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleQuickPreset(30)}
                style={styles.presetChip}
                activeOpacity={0.7}
              >
                <Text style={styles.presetChipText}>Past 30d</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleMonthPreset()}
                style={styles.presetChip}
                activeOpacity={0.7}
              >
                <Text style={styles.presetChipText}>This Month</Text>
              </TouchableOpacity>
            </View>

            {/* Apply Filter Button */}
            <TouchableOpacity
              style={styles.applyBtn}
              onPress={fetchPerformanceReport}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.applyBtnText}>Apply Filter</Text>
              )}
            </TouchableOpacity>
          </Card>
        )}

      {/* 4 KPI Summary Cards (2x2 Grid) */}
      <View style={styles.kpiGrid}>
        {/* Catalog Services */}
        <Card style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>CATALOG SERVICES</Text>
            <View style={[styles.kpiIconBox, { backgroundColor: '#F0EBE1' }]}>
              <Layers size={14} color="#5B6E58" />
            </View>
          </View>
          <Text style={styles.kpiValue}>{data.kpi?.totalCatalogServices || 0}</Text>
          <Text style={styles.kpiSub}>Active menu treatments</Text>
        </Card>

        {/* Total Service Revenue */}
        <Card style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>SERVICE REVENUE</Text>
            <View style={[styles.kpiIconBox, { backgroundColor: '#ECFDF5' }]}>
              <DollarSign size={14} color="#10B981" />
            </View>
          </View>
          <Text style={[styles.kpiValue, { color: '#10B981' }]} numberOfLines={1}>
            {formatFCFA(data.kpi?.totalServiceRevenue || 0)}
          </Text>
          <Text style={styles.kpiSub}>{data.kpi?.totalTimesSold || 0} services performed</Text>
        </Card>

        {/* Active Performing */}
        <Card style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>ACTIVE PERFORMING</Text>
            <View style={[styles.kpiIconBox, { backgroundColor: '#EFF6FF' }]}>
              <Activity size={14} color="#3B82F6" />
            </View>
          </View>
          <Text style={styles.kpiValue}>{data.kpi?.performingServicesCount || 0}</Text>
          <Text style={styles.kpiSub}>{data.kpi?.totalUniqueClients || 0} distinct clients</Text>
        </Card>

        {/* Ignored 0% */}
        <Card style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>IGNORED (0 BOOKINGS)</Text>
            <View style={[styles.kpiIconBox, { backgroundColor: '#FEF2F2' }]}>
              <AlertOctagon size={14} color="#EF4444" />
            </View>
          </View>
          <Text style={[styles.kpiValue, { color: '#EF4444' }]}>{data.kpi?.ignoredServicesCount || 0}</Text>
          <Text style={styles.kpiSub}>0 sales in period</Text>
        </Card>
      </View>

      {/* 3 Main Actionable Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'BEST' && styles.tabButtonActiveBest]}
          onPress={() => setActiveTab('BEST')}
          activeOpacity={0.7}
        >
          <TrendingUp size={14} color={activeTab === 'BEST' ? '#10B981' : '#7D7871'} />
          <Text style={[styles.tabText, activeTab === 'BEST' && styles.tabTextActiveBest]}>Best Performers</Text>
          <View style={[styles.tabBadge, activeTab === 'BEST' && styles.tabBadgeActiveBest]}>
            <Text style={[styles.tabBadgeText, activeTab === 'BEST' && styles.tabBadgeTextActiveBest]}>
              {data.bestPerformers?.length || 0}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'WORST' && styles.tabButtonActiveWorst]}
          onPress={() => setActiveTab('WORST')}
          activeOpacity={0.7}
        >
          <TrendingDown size={14} color={activeTab === 'WORST' ? '#F59E0B' : '#7D7871'} />
          <Text style={[styles.tabText, activeTab === 'WORST' && styles.tabTextActiveWorst]}>Worst</Text>
          <View style={[styles.tabBadge, activeTab === 'WORST' && styles.tabBadgeActiveWorst]}>
            <Text style={[styles.tabBadgeText, activeTab === 'WORST' && styles.tabBadgeTextActiveWorst]}>
              {data.worstPerformers?.length || 0}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'IGNORED' && styles.tabButtonActiveIgnored]}
          onPress={() => setActiveTab('IGNORED')}
          activeOpacity={0.7}
        >
          <AlertOctagon size={14} color={activeTab === 'IGNORED' ? '#EF4444' : '#7D7871'} />
          <Text style={[styles.tabText, activeTab === 'IGNORED' && styles.tabTextActiveIgnored]}>Ignored 0%</Text>
          <View style={[styles.tabBadge, activeTab === 'IGNORED' && styles.tabBadgeActiveIgnored]}>
            <Text style={[styles.tabBadgeText, activeTab === 'IGNORED' && styles.tabBadgeTextActiveIgnored]}>
              {data.ignoredServices?.length || 0}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Visual Progress Graph for Best & Worst */}
      {(activeTab === 'BEST' || activeTab === 'WORST') && (
        <Card style={styles.graphCard}>
          <View style={styles.graphHeader}>
            <BarChart2 size={16} color={activeTab === 'BEST' ? '#10B981' : '#F59E0B'} />
            <Text style={styles.graphTitle}>
              {activeTab === 'BEST' ? 'Top Revenue Drivers' : 'Lowest Demand Treatments'}
            </Text>
          </View>

          <View style={styles.graphBarsContainer}>
            {((activeTab === 'BEST' ? data.bestPerformers : data.worstPerformers) || [])
              .slice(0, 5)
              .map((it: any, idx: number) => {
                const pct = Math.min(100, Math.max(12, Math.round((it.totalRevenue / maxChartValue) * 100)));
                const barColor = activeTab === 'BEST' ? '#10B981' : '#F59E0B';

                return (
                  <View key={it.serviceId || idx} style={styles.graphRow}>
                    <View style={styles.graphLabelRow}>
                      <Text style={styles.graphServiceName} numberOfLines={1}>
                        #{idx + 1} {it.serviceName}
                      </Text>
                      <Text style={styles.graphRevenue}>{formatFCFA(it.totalRevenue)}</Text>
                    </View>
                    <View style={styles.graphTrack}>
                      <View style={[styles.graphFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                    </View>
                  </View>
                );
              })}
          </View>
        </Card>
      )}

      {/* Search Input */}
      <View style={styles.searchBox}>
        <Search size={16} color="#7D7871" style={styles.searchIcon} />
        <TextInput
          placeholder="Search service name or category..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          placeholderTextColor="#A8A29E"
        />
      </View>

      {/* List of Services */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#5B6E58" />
          <Text style={styles.loadingText}>Analyzing service sales records...</Text>
        </View>
      ) : currentList.length === 0 ? (
        <View style={styles.emptyBox}>
          <Sparkles size={32} color="#C2BBA8" />
          <Text style={styles.emptyTitle}>No services found in this tier</Text>
          <Text style={styles.emptySub}>No services match the current filter or date range.</Text>
        </View>
      ) : (
        <View style={styles.serviceList}>
          {currentList.map((item: any, index: number) => {
            const isIgnored = activeTab === 'IGNORED';
            const isBest = activeTab === 'BEST';

            return (
              <Card key={item.serviceId || index} style={styles.serviceCard}>
                {/* Top Row: Rank Badge + Title + Category */}
                <View style={styles.cardTopRow}>
                  <View style={styles.titleWrap}>
                    <View style={styles.nameHeader}>
                      {isIgnored ? (
                        <View style={styles.zeroBadge}>
                          <Text style={styles.zeroBadgeText}>0%</Text>
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.rankBadge,
                            index === 0 && isBest && styles.rankGold,
                            index === 1 && isBest && styles.rankSilver,
                            index === 2 && isBest && styles.rankBronze,
                          ]}
                        >
                          <Text style={styles.rankBadgeText}>#{index + 1}</Text>
                        </View>
                      )}
                      <Text style={styles.serviceTitle} numberOfLines={1}>
                        {item.serviceName}
                      </Text>
                    </View>
                    <Text style={styles.categoryText}>{item.category || 'General'}</Text>
                  </View>

                  <View style={styles.pricePill}>
                    <Text style={styles.pricePillText}>{formatFCFA(item.price)}</Text>
                  </View>
                </View>

                {/* 3 Metrics Cards inside the item */}
                <View style={styles.metricsStrip}>
                  {/* Metric 1: How many times sold */}
                  <View style={styles.metricItem}>
                    <Text style={styles.metricItemLabel}>TIMES SOLD</Text>
                    <Text
                      style={[
                        styles.metricItemValue,
                        item.timesSold > 0 ? { color: '#10B981' } : { color: '#7D7871' },
                      ]}
                    >
                      {item.timesSold} {item.timesSold === 1 ? 'time' : 'times'}
                    </Text>
                  </View>

                  {/* Metric 2: Total money made */}
                  <View style={styles.metricItem}>
                    <Text style={styles.metricItemLabel}>TOTAL MONEY</Text>
                    <Text style={[styles.metricItemValue, { color: '#2D2D2A', fontWeight: '800' }]}>
                      {formatFCFA(item.totalRevenue)}
                    </Text>
                  </View>

                  {/* Metric 3: How many clients bought it */}
                  <View style={styles.metricItem}>
                    <Text style={styles.metricItemLabel}>CLIENTS</Text>
                    <View style={styles.clientsRow}>
                      <Users size={12} color="#5B6E58" />
                      <Text style={styles.metricClientsText}>
                        {item.uniqueClients} {item.uniqueClients === 1 ? 'client' : 'clients'}
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      )}
      </ScrollView>

      {/* Calendar Date Picker Modal */}
      <Modal
        visible={isDatePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDatePickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsDatePickerOpen(false)}
        >
          <View style={styles.calendarModalContent} onStartShouldSetResponder={() => true}>
            {/* Header: Prev, Month Year, Next, Close */}
            <View style={styles.calendarHeaderRow}>
              <TouchableOpacity onPress={handlePrevMonth} style={styles.calNavBtn} activeOpacity={0.7}>
                <ChevronLeft size={18} color="#2D2D2A" />
              </TouchableOpacity>

              <Text style={styles.calendarMonthTitle}>
                {MONTH_NAMES[calendarMonth]} {calendarYear}
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity onPress={handleNextMonth} style={styles.calNavBtn} activeOpacity={0.7}>
                  <ChevronRight size={18} color="#2D2D2A" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsDatePickerOpen(false)} style={styles.calCloseBtn}>
                  <X size={16} color="#71717A" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Target indicator */}
            <View style={styles.calTargetIndicator}>
              <Text style={styles.calTargetText}>
                Selecting <Text style={{ fontWeight: '800', color: '#5B6E58' }}>{datePickerTarget.toUpperCase()}</Text> Date
              </Text>
            </View>

            {/* Weekday Names (Mo Tu We Th Fr Sa Su) */}
            <View style={styles.calendarWeekdaysRow}>
              {DAY_LABELS.map((d) => (
                <Text key={d} style={styles.calendarWeekdayText}>
                  {d}
                </Text>
              ))}
            </View>

            {/* Days Grid */}
            <View style={styles.calendarDaysGrid}>
              {calendarDays.map((day, idx) => {
                if (day === null) {
                  return <View key={`empty-${idx}`} style={styles.calDayCellEmpty} />;
                }

                const currentCheckIso = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const targetIso = datePickerTarget === 'from' ? customRange.startDate : customRange.endDate;
                const isSelected = targetIso === currentCheckIso;

                const todayObj = new Date();
                const isToday =
                  todayObj.getFullYear() === calendarYear &&
                  todayObj.getMonth() === calendarMonth &&
                  todayObj.getDate() === day;

                return (
                  <TouchableOpacity
                    key={`day-${day}`}
                    onPress={() => handleSelectDay(day)}
                    style={[
                      styles.calDayCell,
                      isToday && styles.calDayCellToday,
                      isSelected && styles.calDayCellSelected,
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.calDayText,
                        isToday && styles.calDayTextToday,
                        isSelected && styles.calDayTextSelected,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Bottom Shortcuts */}
            <View style={styles.calBottomRow}>
              <TouchableOpacity
                onPress={() => {
                  const todayIso = new Date().toISOString().split('T')[0];
                  if (datePickerTarget === 'from') {
                    setCustomRange((prev) => ({ ...prev, startDate: todayIso }));
                  } else {
                    setCustomRange((prev) => ({ ...prev, endDate: todayIso }));
                  }
                  setIsDatePickerOpen(false);
                }}
                style={styles.calQuickBtn}
              >
                <Text style={styles.calQuickBtnText}>Today</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsDatePickerOpen(false)}
                style={styles.calDoneBtn}
              >
                <Text style={styles.calDoneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF7F2',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  accessDeniedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#FBF7F2',
  },
  accessDeniedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D2D2A',
    marginTop: 16,
  },
  accessDeniedText: {
    fontSize: 13,
    color: '#7D7871',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  periodStripContainer: {
    marginBottom: 14,
  },
  periodStrip: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    gap: 4,
  },
  periodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  periodBtnActive: {
    backgroundColor: '#5B6E58',
  },
  periodText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7D7871',
  },
  periodTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  customRangeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  customRangeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customRangeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customRangeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  customRangeHint: {
    fontSize: 10,
    color: '#7D7871',
  },
  customRangeInputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateSelectorBox: {
    flex: 1,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dateSelectorLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#7D7871',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dateSelectorValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateSelectorValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  presetChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#5B6E58',
  },
  applyBtn: {
    backgroundColor: '#5B6E58',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 18,
  },
  calendarModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F0EAE1',
    paddingBottom: 10,
  },
  calNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FBF9F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FBF9F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  calTargetIndicator: {
    alignItems: 'center',
    paddingVertical: 4,
    backgroundColor: '#FBF9F5',
    borderRadius: 8,
  },
  calTargetText: {
    fontSize: 11,
    color: '#7D7871',
  },
  calendarWeekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  calendarWeekdayText: {
    width: 36,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#71717A',
  },
  calendarDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 4,
  },
  calDayCellEmpty: {
    width: 38,
    height: 38,
  },
  calDayCell: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  calDayCellToday: {
    borderColor: '#5B6E58',
    backgroundColor: '#EBF3EC',
  },
  calDayCellSelected: {
    backgroundColor: '#5B6E58',
    borderColor: '#5B6E58',
  },
  calDayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  calDayTextToday: {
    color: '#5B6E58',
    fontWeight: '700',
  },
  calDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  calBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F0EAE1',
    paddingTop: 10,
  },
  calQuickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F6F1EB',
  },
  calQuickBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5B6E58',
  },
  calDoneBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#5B6E58',
  },
  calDoneBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    width: '48%',
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#7D7871',
    letterSpacing: 0.5,
  },
  kpiIconBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2D2D2A',
    marginTop: 6,
  },
  kpiSub: {
    fontSize: 10,
    color: '#7D7871',
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  tabButtonActiveBest: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  tabButtonActiveWorst: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  tabButtonActiveIgnored: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7D7871',
  },
  tabTextActiveBest: {
    color: '#065F46',
    fontWeight: '800',
  },
  tabTextActiveWorst: {
    color: '#92400E',
    fontWeight: '800',
  },
  tabTextActiveIgnored: {
    color: '#991B1B',
    fontWeight: '800',
  },
  tabBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: '#F0EBE1',
  },
  tabBadgeActiveBest: {
    backgroundColor: '#D1FAE5',
  },
  tabBadgeActiveWorst: {
    backgroundColor: '#FDE68A',
  },
  tabBadgeActiveIgnored: {
    backgroundColor: '#FEE2E2',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7D7871',
  },
  tabBadgeTextActiveBest: {
    color: '#065F46',
  },
  tabBadgeTextActiveWorst: {
    color: '#92400E',
  },
  tabBadgeTextActiveIgnored: {
    color: '#991B1B',
  },
  graphCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    marginBottom: 14,
  },
  graphHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  graphTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
    textTransform: 'uppercase',
  },
  graphBarsContainer: {
    gap: 10,
  },
  graphRow: {
    gap: 4,
  },
  graphLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  graphServiceName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2D2D2A',
    maxWidth: '65%',
  },
  graphRevenue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  graphTrack: {
    height: 7,
    backgroundColor: '#F0EBE1',
    borderRadius: 4,
    overflow: 'hidden',
  },
  graphFill: {
    height: '100%',
    borderRadius: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    paddingHorizontal: 12,
    marginBottom: 14,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#2D2D2A',
  },
  loadingBox: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#7D7871',
  },
  emptyBox: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  emptySub: {
    fontSize: 11,
    color: '#7D7871',
  },
  serviceList: {
    gap: 10,
  },
  serviceCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  titleWrap: {
    flex: 1,
    marginRight: 8,
  },
  nameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rankBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F0EBE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankGold: {
    backgroundColor: '#FEF3C7',
  },
  rankSilver: {
    backgroundColor: '#E2E8F0',
  },
  rankBronze: {
    backgroundColor: '#FFEDD5',
  },
  rankBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2D2D2A',
  },
  zeroBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  zeroBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EF4444',
  },
  serviceTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
    flex: 1,
  },
  categoryText: {
    fontSize: 10,
    color: '#7D7871',
    marginTop: 2,
    marginLeft: 28,
  },
  pricePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#F6F1EB',
  },
  pricePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  metricsStrip: {
    flexDirection: 'row',
    backgroundColor: '#FAF8F5',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricItemLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#7D7871',
    marginBottom: 2,
  },
  metricItemValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  clientsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricClientsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D2D2A',
  },
});

export default ReportsScreen;

