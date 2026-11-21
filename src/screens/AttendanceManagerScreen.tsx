/**
 * AttendanceManagerScreen — 1-to-1 Match with Omega Spa POS Web Software
 * Matches frontend/src/pages/AttendanceManager.jsx & Image 1:
 * - Header: "Employee Attendance", "Daily staff presence and verification records"
 * - Date Bar: Calendar icon, formatted date (Thu, 05 Nov 2026), "Cameroon (WAT, UTC+1)" badge
 * - Button: "+ Add Manual Attendance" (solid primary green button)
 * - Main Container Card:
 *     - Title: Users icon "Today's Attendance Roster (X of Y)"
 *     - Filter Pills: All X, Present Y, Absent Z, Completed W
 *     - Sub-tabs: Today's Attendance & Attendance History
 *     - Responsive Table Layout: EMPLOYEE, CLOCK IN, CLOCK OUT
 *     - Circular avatars with camera overlay badges for selfie-verified clock-ins
 * - Interactive Calendar Date Picker Modal for selecting Attendance History date & Manual Entry date!
 * - Interactive Staff Selector Modal for filtering History by employee!
 * - Photo Preview Modal: View verified clock-in selfies
 * - Add Manual Attendance Modal: Select employee, date, times, status & reason
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {
  Clock,
  Users,
  Camera,
  CheckCircle,
  AlertCircle,
  Calendar,
  X,
  Plus,
  LogIn,
  LogOut,
  RotateCcw,
  Coffee,
  History,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react-native';
import THEME from '../constants/theme';
import Header from '../components/Header';
import Card from '../components/Card';
import { attendanceApi, usersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface ActiveEmployee {
  id: string;
  name: string;
  role: string;
}

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole?: string;
  date: string;
  clockIn?: string;
  clockInTime?: string;
  clockInPhoto?: string;
  photo?: string;
  clockOut?: string;
  clockOutTime?: string;
  clockOutPhoto?: string;
  workingHours?: string;
  status: 'working' | 'completed' | 'not_started' | 'absent';
  isManual?: boolean;
  isManualEntry?: boolean;
  reason?: string;
  addedByManager?: string;
}

const QUICK_REASONS = [
  'Employee device issue',
  'Camera not working',
  'Forgot to clock in',
  'Emergency situation',
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export const AttendanceManagerScreen: React.FC<{ onOpenMenu?: () => void }> = ({ onOpenMenu }) => {
  const { user } = useAuth();
  const isManager = (user?.role || '').toLowerCase() === 'manager';

  // Sub-tabs: 'today' | 'history'
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');

  // Today's filter pill: 'all' | 'present' | 'absent' | 'completed'
  const [todayFilter, setTodayFilter] = useState<'all' | 'present' | 'absent' | 'completed'>('all');

  // Raw data from APIs
  const [employees, setEmployees] = useState<ActiveEmployee[]>([]);
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // History filters
  const [historyDate, setHistoryDate] = useState<string>('');
  const [historyEmployee, setHistoryEmployee] = useState<string>('');
  const [historyStatus, setHistoryStatus] = useState<string>('');

  // Modals
  const [viewingPhoto, setViewingPhoto] = useState<{
    photo: string;
    name: string;
    role: string;
    clockIn?: string;
    date?: string;
  } | null>(null);

  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [manualEmployeeId, setManualEmployeeId] = useState<string>('');
  const [manualDate, setManualDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [manualClockIn, setManualClockIn] = useState<string>('09:00');
  const [manualClockOut, setManualClockOut] = useState<string>('18:00');
  const [manualStatus, setManualStatus] = useState<'completed' | 'working'>('completed');
  const [manualReason, setManualReason] = useState<string>('Employee device issue');
  const [submittingManual, setSubmittingManual] = useState<boolean>(false);

  // Interactive Date Picker Modal State
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const [datePickerTarget, setDatePickerTarget] = useState<'history' | 'manual'>('history');
  const [calendarYear, setCalendarYear] = useState<number>(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(() => new Date().getMonth());

  // Interactive Employee Picker Modal State
  const [isEmployeePickerOpen, setIsEmployeePickerOpen] = useState<boolean>(false);

  // Date formatted in Cameroon timezone (WAT, UTC+1)
  const todayFormatted = useMemo(() => {
    try {
      const opts: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Africa/Douala',
      };
      return new Intl.DateTimeFormat('en-GB', opts).format(new Date());
    } catch {
      return new Date().toLocaleDateString('en-GB');
    }
  }, []);

  // Fetch all active staff & attendance
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [todayRes, allRes, staffRes] = await Promise.all([
        attendanceApi.getToday().catch(() => null),
        attendanceApi.getAll().catch(() => null),
        usersApi.getAll().catch(() => null),
      ]);

      // 1. Parse active employees (exclude manager and cleaner, exactly like web frontend line 106-108)
      if (staffRes) {
        const rawStaff = staffRes.data?.users || (Array.isArray(staffRes.data) ? staffRes.data : Array.isArray(staffRes) ? staffRes : []);
        const validEmployees: ActiveEmployee[] = rawStaff
          .filter((u: any) => u.active !== false && u.role !== 'manager' && u.role !== 'cleaner')
          .map((u: any) => ({
            id: String(u.id),
            name: u.staffProfile?.name || u.name || 'Staff Member',
            role: u.staffProfile?.role || u.role || 'technician',
          }));

        setEmployees(validEmployees);
        if (validEmployees.length > 0 && !manualEmployeeId) {
          setManualEmployeeId(validEmployees[0].id);
        }
      }

      // 2. Parse today's attendance records
      if (todayRes) {
        const rawToday =
          todayRes.data?.records ||
          (Array.isArray(todayRes.data) ? todayRes.data : Array.isArray(todayRes) ? todayRes : []);

        setTodayRecords(
          rawToday.map((r: any) => ({
            id: String(r.id),
            employeeId: String(r.employeeId),
            employeeName: r.employeeName || r.employee?.staffProfile?.name || 'Staff',
            employeeRole: r.employeeRole || r.employee?.role || 'technician',
            date: r.date || '',
            clockIn: r.clockIn || r.clockInTime,
            clockInTime: r.clockIn || r.clockInTime,
            clockInPhoto: r.clockInPhoto || r.photo,
            photo: r.photo || r.clockInPhoto,
            clockOut: r.clockOut || r.clockOutTime,
            clockOutTime: r.clockOut || r.clockOutTime,
            clockOutPhoto: r.clockOutPhoto,
            workingHours: r.workingHours,
            status: (r.status || (r.clockOut ? 'completed' : 'working')).toLowerCase() as any,
            isManual: Boolean(r.isManual || r.isManualEntry),
            isManualEntry: Boolean(r.isManual || r.isManualEntry),
            reason: r.reason,
            addedByManager: r.addedByManager,
          }))
        );
      }

      // 3. Parse attendance history records
      if (allRes) {
        const rawHistory = allRes.data || (Array.isArray(allRes) ? allRes : []);
        setHistoryRecords(
          rawHistory.map((r: any) => ({
            id: String(r.id),
            employeeId: String(r.employeeId),
            employeeName: r.employeeName || r.employee?.staffProfile?.name || 'Staff',
            employeeRole: r.employeeRole || r.employee?.role || 'technician',
            date: r.date || '',
            clockIn: r.clockIn || r.clockInTime,
            clockOut: r.clockOut || r.clockOutTime,
            clockInPhoto: r.clockInPhoto || r.photo,
            status: (r.status || 'completed').toLowerCase() as any,
            isManual: Boolean(r.isManual || r.isManualEntry),
            reason: r.reason,
          }))
        );
      }
    } catch (e) {
      console.warn('Failed to load employee attendance roster', e);
    } finally {
      setLoading(false);
    }
  }, [manualEmployeeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build employee attendance map for today
  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    todayRecords.forEach((rec) => {
      map.set(String(rec.employeeId), rec);
    });
    return map;
  }, [todayRecords]);

  // Stats calculation
  const totalEmployees = employees.length;
  const workingCount = employees.filter((e) => attendanceMap.get(e.id)?.status === 'working').length;
  const completedCount = employees.filter((e) => attendanceMap.get(e.id)?.status === 'completed').length;
  const notStartedCount = Math.max(0, totalEmployees - workingCount - completedCount);

  // Filtered employees for today's roster: All, Present, Absent, Completed
  const filteredTodayEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const rec = attendanceMap.get(emp.id);
      const status = rec?.status || 'not_started';
      if (todayFilter === 'all') return true;
      if (todayFilter === 'present') return status === 'working';
      if (todayFilter === 'absent') return status === 'not_started';
      if (todayFilter === 'completed') return status === 'completed';
      return true;
    });
  }, [employees, attendanceMap, todayFilter]);

  // Filtered history records
  const filteredHistory = useMemo(() => {
    return historyRecords.filter((rec) => {
      if (historyDate && rec.date !== historyDate) return false;
      if (historyEmployee && !rec.employeeName.toLowerCase().includes(historyEmployee.toLowerCase())) return false;
      if (historyStatus && rec.status !== historyStatus) return false;
      return true;
    });
  }, [historyRecords, historyDate, historyEmployee, historyStatus]);

  // Calendar days grid generator
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    // Monday as first day of week: (day + 6) % 7
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

  // Date selection handlers
  const handleSelectDay = (day: number) => {
    const m = String(calendarMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const iso = `${calendarYear}-${m}-${d}`;
    if (datePickerTarget === 'history') {
      setHistoryDate(iso);
    } else {
      setManualDate(iso);
    }
    setIsDatePickerOpen(false);
  };

  const handleSelectToday = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const iso = `${y}-${m}-${d}`;
    if (datePickerTarget === 'history') {
      setHistoryDate(iso);
    } else {
      setManualDate(iso);
    }
    setIsDatePickerOpen(false);
  };

  const handleClearDate = () => {
    if (datePickerTarget === 'history') {
      setHistoryDate('');
    }
    setIsDatePickerOpen(false);
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

  // Open calendar date picker
  const openDatePicker = (target: 'history' | 'manual') => {
    setDatePickerTarget(target);
    const currentDateVal = target === 'history' ? historyDate : manualDate;
    if (currentDateVal && /^\d{4}-\d{2}-\d{2}$/.test(currentDateVal)) {
      const parts = currentDateVal.split('-');
      setCalendarYear(parseInt(parts[0], 10));
      setCalendarMonth(parseInt(parts[1], 10) - 1);
    } else {
      const now = new Date();
      setCalendarYear(now.getFullYear());
      setCalendarMonth(now.getMonth());
    }
    setIsDatePickerOpen(true);
  };

  // Handle Manual Attendance Submission
  const handleManualSubmit = async () => {
    if (!manualEmployeeId) {
      Alert.alert('Required', 'Please select an employee.');
      return;
    }
    setSubmittingManual(true);
    try {
      await attendanceApi.manualEntry({
        employeeId: manualEmployeeId,
        date: manualDate,
        clockInTime: manualClockIn,
        clockOutTime: manualStatus === 'completed' ? manualClockOut : undefined,
        status: manualStatus,
        reason: manualReason,
        isManual: true,
      });
      setShowManualModal(false);
      Alert.alert('Success', 'Manual attendance record entered successfully.');
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to submit manual attendance.');
    } finally {
      setSubmittingManual(false);
    }
  };

  const openManualForEmployee = (empId: string, status: 'completed' | 'working' = 'completed') => {
    setManualEmployeeId(empId);
    setManualStatus(status);
    setShowManualModal(true);
  };

  return (
    <View style={styles.container}>
      {/* 1. Page Header — Exact match with Image 1 Web View */}
      <Header
        title="Employee Attendance"
        subtitle="Daily staff presence and verification records"
        onOpenMenu={onOpenMenu}
        rightAction={
          <TouchableOpacity onPress={loadData} style={styles.refreshBtn} activeOpacity={0.8}>
            <RotateCcw size={14} color="#4F6748" />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadData} tintColor="#4F6748" />
        }
      >
        {/* 2. Top Action Row: Date Box & "+ Add Manual Attendance" Button */}
        <View style={styles.topActionRow}>
          {/* Left: Date Display & Cameroon Timezone Badge */}
          <View style={styles.dateBox}>
            <Calendar size={13} color="#71717A" />
            <Text style={styles.dateText}>{todayFormatted}</Text>
            <View style={styles.timezoneBadge}>
              <Text style={styles.timezoneBadgeText}>Cameroon (WAT, UTC+1)</Text>
            </View>
          </View>

          {/* Right: + Add Manual Attendance Button (Primary Green) */}
          {isManager && (
            <TouchableOpacity
              onPress={() => setShowManualModal(true)}
              style={styles.addManualBtn}
              activeOpacity={0.8}
            >
              <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.addManualBtnText}>Add Manual Attendance</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 3. Main Container Card — Today's Attendance Roster & Sub-tabs */}
        <Card style={styles.rosterCard}>
          {/* Toolbar: Title, Filter Pills, Sub-tabs (Today vs History) */}
          <View style={styles.toolbar}>
            {/* Title: Today's Attendance Roster (X of Y) */}
            <View style={styles.rosterTitleRow}>
              <Users size={16} color="#4F6748" />
              <Text style={styles.rosterTitle}>Today's Attendance Roster</Text>
              <Text style={styles.rosterSubtitle}>
                ({filteredTodayEmployees.length} of {totalEmployees})
              </Text>
            </View>

            {/* Filter Pills: All 14, Present 5, Absent 9, Completed 0 */}
            {activeTab === 'today' && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterPillsRow}
              >
                {[
                  { id: 'all', label: 'All', count: totalEmployees },
                  { id: 'present', label: 'Present', count: workingCount },
                  { id: 'absent', label: 'Absent', count: notStartedCount },
                  { id: 'completed', label: 'Completed', count: completedCount },
                ].map((f) => {
                  const isActive = todayFilter === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      onPress={() => setTodayFilter(f.id as any)}
                      style={[styles.filterPill, isActive && styles.filterPillActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                        {f.label}
                      </Text>
                      <View style={[styles.pillCountBadge, isActive && styles.pillCountBadgeActive]}>
                        <Text style={[styles.pillCountText, isActive && styles.pillCountTextActive]}>
                          {f.count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Sub-tabs: Today's Attendance & Attendance History */}
            <View style={styles.subTabsContainer}>
              <TouchableOpacity
                onPress={() => setActiveTab('today')}
                style={[styles.subTabBtn, activeTab === 'today' && styles.subTabBtnActive]}
                activeOpacity={0.7}
              >
                <Clock
                  size={13}
                  color={activeTab === 'today' ? '#4F6748' : '#71717A'}
                  strokeWidth={activeTab === 'today' ? 2.2 : 1.6}
                />
                <Text style={[styles.subTabText, activeTab === 'today' && styles.subTabTextActive]}>
                  Today's Attendance
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab('history')}
                style={[styles.subTabBtn, activeTab === 'history' && styles.subTabBtnActive]}
                activeOpacity={0.7}
              >
                <History
                  size={13}
                  color={activeTab === 'history' ? '#4F6748' : '#71717A'}
                  strokeWidth={activeTab === 'history' ? 2.2 : 1.6}
                />
                <Text style={[styles.subTabText, activeTab === 'history' && styles.subTabTextActive]}>
                  Attendance History
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 4. Tab 1: Today's Attendance Table (Exact match with Image 1) */}
          {activeTab === 'today' && (
            <View>
              {/* Table Column Headers */}
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCol, { flex: 1.5 }]}>EMPLOYEE</Text>
                <Text style={[styles.tableHeaderCol, { flex: 1, textAlign: 'left' }]}>CLOCK IN</Text>
                <Text style={[styles.tableHeaderCol, { flex: 1, textAlign: 'left' }]}>CLOCK OUT</Text>
              </View>

              {loading && employees.length === 0 ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color="#4F6748" />
                  <Text style={styles.loadingText}>Loading attendance roster...</Text>
                </View>
              ) : filteredTodayEmployees.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Users size={30} color="#A1A1AA" />
                  <Text style={styles.emptyTitle}>No Staff in this Filter</Text>
                  <TouchableOpacity onPress={() => setTodayFilter('all')}>
                    <Text style={styles.viewAllLink}>View all staff</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                filteredTodayEmployees.map((emp) => {
                  const rec = attendanceMap.get(emp.id);
                  const isPresent = rec?.status === 'working' || rec?.status === 'completed';
                  const hasPhoto = Boolean(rec?.photo || rec?.clockInPhoto);
                  const photoUrl = rec?.photo || rec?.clockInPhoto;

                  return (
                    <TouchableOpacity
                      key={emp.id}
                      onPress={() => {
                        if (hasPhoto && photoUrl) {
                          setViewingPhoto({
                            photo: photoUrl,
                            name: emp.name,
                            role: emp.role,
                            clockIn: rec?.clockIn,
                            date: todayFormatted,
                          });
                        } else if (!isPresent && isManager) {
                          openManualForEmployee(emp.id, 'working');
                        }
                      }}
                      style={styles.tableRow}
                      activeOpacity={0.7}
                    >
                      {/* Column 1: EMPLOYEE (Avatar with camera badge + Name + Role) */}
                      <View style={[styles.tableCol, { flex: 1.5 }]}>
                        {hasPhoto && photoUrl ? (
                          <View style={styles.avatarWrapper}>
                            <Image source={{ uri: photoUrl }} style={styles.avatarPhoto} />
                            <View style={styles.avatarCameraBadge}>
                              <Camera size={7} color="#FFFFFF" />
                            </View>
                          </View>
                        ) : (
                          <View style={styles.avatarInitial}>
                            <Text style={styles.avatarInitialText}>
                              {(emp.name || '?')[0].toUpperCase()}
                            </Text>
                          </View>
                        )}

                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={styles.employeeName} numberOfLines={1}>
                            {emp.name}
                          </Text>
                          <Text style={styles.employeeRole}>{emp.role}</Text>
                        </View>
                      </View>

                      {/* Column 2: CLOCK IN */}
                      <View style={[styles.tableCol, { flex: 1 }]}>
                        {rec?.clockIn ? (
                          <View style={styles.timeWithIconRow}>
                            <LogIn size={13} color="#16A34A" />
                            <Text style={styles.clockInText}>{rec.clockIn}</Text>
                          </View>
                        ) : (
                          <Text style={styles.dashText}>—</Text>
                        )}
                      </View>

                      {/* Column 3: CLOCK OUT */}
                      <View style={[styles.tableCol, { flex: 1 }]}>
                        {rec?.clockOut ? (
                          <View style={styles.timeWithIconRow}>
                            <LogOut size={13} color="#DC2626" />
                            <Text style={styles.clockOutText}>{rec.clockOut}</Text>
                          </View>
                        ) : (
                          <Text style={styles.dashText}>—</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {/* 5. Tab 2: Attendance History Table with Interactive Date & Employee Selectors */}
          {activeTab === 'history' && (
            <View style={{ padding: 12, gap: 10 }}>
              {/* History Filters: Employee Selector + Interactive Date Selector */}
              <View style={styles.historyFiltersRow}>
                {/* Employee Selector Button */}
                <TouchableOpacity
                  onPress={() => setIsEmployeePickerOpen(true)}
                  style={styles.historySelectorBtn}
                  activeOpacity={0.7}
                >
                  <Users size={13} color="#4F6748" />
                  <Text style={[styles.historySelectorBtnText, !historyEmployee && styles.placeholderText]} numberOfLines={1}>
                    {historyEmployee || 'Filter employee...'}
                  </Text>
                  {historyEmployee ? (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        setHistoryEmployee('');
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X size={13} color="#71717A" />
                    </TouchableOpacity>
                  ) : (
                    <ChevronDown size={13} color="#71717A" />
                  )}
                </TouchableOpacity>

                {/* Date Selector Button (Interactive Calendar Picker) */}
                <TouchableOpacity
                  onPress={() => openDatePicker('history')}
                  style={styles.historyDateSelectorBtn}
                  activeOpacity={0.7}
                >
                  <Calendar size={13} color="#4F6748" />
                  <Text style={[styles.historyDateBtnText, !historyDate && styles.placeholderText]} numberOfLines={1}>
                    {historyDate ? historyDate : 'Select Date'}
                  </Text>
                  {historyDate ? (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        setHistoryDate('');
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X size={13} color="#71717A" />
                    </TouchableOpacity>
                  ) : (
                    <ChevronDown size={13} color="#71717A" />
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.historyCountText}>
                {filteredHistory.length} record{filteredHistory.length !== 1 ? 's' : ''} found
                {(historyDate || historyEmployee) ? ' (filtered)' : ''}
              </Text>

              {filteredHistory.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Clock size={30} color="#A1A1AA" />
                  <Text style={styles.emptyTitle}>No attendance records found</Text>
                  {(historyDate || historyEmployee) && (
                    <TouchableOpacity onPress={() => { setHistoryDate(''); setHistoryEmployee(''); }}>
                      <Text style={styles.viewAllLink}>Clear filters</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                filteredHistory.map((rec) => (
                  <View key={rec.id} style={styles.historyCard}>
                    <View style={styles.historyCardTop}>
                      <View>
                        <Text style={styles.historyEmpName}>{rec.employeeName}</Text>
                        <Text style={styles.historyDate}>{rec.date}</Text>
                      </View>

                      <View
                        style={[
                          styles.historyStatusPill,
                          {
                            backgroundColor:
                              rec.status === 'completed'
                                ? '#EBF3EC'
                                : rec.status === 'working'
                                ? '#EFF6FF'
                                : '#F4F4F5',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.historyStatusText,
                            {
                              color:
                                rec.status === 'completed'
                                  ? '#4F6748'
                                  : rec.status === 'working'
                                  ? '#1D4ED8'
                                  : '#71717A',
                            },
                          ]}
                        >
                          {rec.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.historyTimesRow}>
                      <Text style={styles.historyTimeLabel}>
                        In: <Text style={styles.historyTimeVal}>{rec.clockIn || '—'}</Text>
                      </Text>
                      <Text style={styles.historyTimeLabel}>
                        Out: <Text style={styles.historyTimeVal}>{rec.clockOut || '—'}</Text>
                      </Text>
                      {rec.clockInPhoto && (
                        <TouchableOpacity
                          onPress={() =>
                            setViewingPhoto({
                              photo: rec.clockInPhoto!,
                              name: rec.employeeName,
                              role: rec.employeeRole || 'Technician',
                              clockIn: rec.clockIn,
                              date: rec.date,
                            })
                          }
                          style={styles.viewPhotoLink}
                        >
                          <Camera size={11} color="#4F6748" />
                          <Text style={styles.viewPhotoLinkText}>Photo</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </Card>
      </ScrollView>

      {/* 6. Photo Preview Modal (Selfie Verified) */}
      <Modal visible={Boolean(viewingPhoto)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.photoModalContent}>
            <View style={styles.photoModalHeader}>
              <View>
                <Text style={styles.photoModalName}>{viewingPhoto?.name}</Text>
                <Text style={styles.photoModalRole}>
                  {viewingPhoto?.role} • {viewingPhoto?.date}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setViewingPhoto(null)} style={styles.closeBtn}>
                <X size={18} color="#2E2F31" />
              </TouchableOpacity>
            </View>

            {viewingPhoto?.photo && (
              <Image source={{ uri: viewingPhoto.photo }} style={styles.fullSelfieImage} />
            )}

            <View style={styles.selfieVerifiedBar}>
              <CheckCircle size={14} color="#16A34A" />
              <Text style={styles.selfieVerifiedText}>
                Selfie Verified • Clock In {viewingPhoto?.clockIn || '09:57 AM'}
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* 7. Interactive Calendar Date Picker Modal (Full month calendar grid) */}
      <Modal visible={isDatePickerOpen} transparent animationType="fade" onRequestClose={() => setIsDatePickerOpen(false)}>
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
                const targetIso = datePickerTarget === 'history' ? historyDate : manualDate;
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

            {/* Shortcut Buttons: Today & Clear */}
            <View style={styles.calendarActionRow}>
              <TouchableOpacity
                onPress={handleSelectToday}
                style={styles.calActionBtn}
                activeOpacity={0.8}
              >
                <Clock size={13} color="#4F6748" />
                <Text style={styles.calActionBtnText}>Today</Text>
              </TouchableOpacity>

              {datePickerTarget === 'history' && (
                <TouchableOpacity
                  onPress={handleClearDate}
                  style={[styles.calActionBtn, { borderColor: '#E4E4E7' }]}
                  activeOpacity={0.8}
                >
                  <X size={13} color="#71717A" />
                  <Text style={[styles.calActionBtnText, { color: '#71717A' }]}>Clear Filter</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 8. Interactive Employee Picker Modal */}
      <Modal visible={isEmployeePickerOpen} transparent animationType="fade" onRequestClose={() => setIsEmployeePickerOpen(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsEmployeePickerOpen(false)}
        >
          <View style={styles.employeeModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.photoModalHeader}>
              <View>
                <Text style={styles.modalTitle}>Filter by Employee</Text>
                <Text style={styles.modalSubtitle}>Choose a staff member to view history</Text>
              </View>
              <TouchableOpacity onPress={() => setIsEmployeePickerOpen(false)} style={styles.closeBtn}>
                <X size={18} color="#2E2F31" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 350 }}>
              <TouchableOpacity
                onPress={() => {
                  setHistoryEmployee('');
                  setIsEmployeePickerOpen(false);
                }}
                style={[styles.empPickItem, !historyEmployee && styles.empPickItemActive]}
              >
                <Text style={[styles.empPickItemText, !historyEmployee && styles.empPickItemTextActive]}>
                  All Employees ({employees.length})
                </Text>
              </TouchableOpacity>

              {employees.map((emp) => {
                const isSelected = historyEmployee === emp.name;
                return (
                  <TouchableOpacity
                    key={emp.id}
                    onPress={() => {
                      setHistoryEmployee(emp.name);
                      setIsEmployeePickerOpen(false);
                    }}
                    style={[styles.empPickItem, isSelected && styles.empPickItemActive]}
                  >
                    <Text style={[styles.empPickItemText, isSelected && styles.empPickItemTextActive]}>
                      {emp.name} ({emp.role})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 9. Add Manual Attendance Modal (Exact fields & quick reasons) */}
      <Modal visible={showManualModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.manualModalContent}>
            <View style={styles.photoModalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add Manual Attendance</Text>
                <Text style={styles.modalSubtitle}>Record staff attendance for exceptional cases</Text>
              </View>
              <TouchableOpacity onPress={() => setShowManualModal(false)} style={styles.closeBtn}>
                <X size={18} color="#2E2F31" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 10 }}>
              {/* Employee Selection */}
              <Text style={styles.inputLabel}>Select Employee</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                {employees.map((emp) => (
                  <TouchableOpacity
                    key={emp.id}
                    onPress={() => setManualEmployeeId(emp.id)}
                    style={[styles.staffSelectPill, manualEmployeeId === emp.id && styles.staffSelectPillActive]}
                  >
                    <Text
                      style={[
                        styles.staffSelectPillText,
                        manualEmployeeId === emp.id && styles.staffSelectPillTextActive,
                      ]}
                    >
                      {emp.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Date with Calendar Picker Trigger */}
              <Text style={styles.inputLabel}>Date</Text>
              <TouchableOpacity
                onPress={() => openDatePicker('manual')}
                style={styles.modalDateSelectorBtn}
                activeOpacity={0.7}
              >
                <Calendar size={14} color="#4F6748" />
                <Text style={styles.modalDateSelectorText}>{manualDate || 'Select Date'}</Text>
                <ChevronDown size={14} color="#71717A" />
              </TouchableOpacity>

              {/* Status Selector */}
              <Text style={styles.inputLabel}>Status</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setManualStatus('completed')}
                  style={[styles.statusToggleBtn, manualStatus === 'completed' && styles.statusToggleBtnActive]}
                >
                  <Text style={[styles.statusToggleText, manualStatus === 'completed' && styles.statusToggleTextActive]}>
                    Completed Shift
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setManualStatus('working')}
                  style={[styles.statusToggleBtn, manualStatus === 'working' && styles.statusToggleBtnActive]}
                >
                  <Text style={[styles.statusToggleText, manualStatus === 'working' && styles.statusToggleTextActive]}>
                    Working Now
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Clock In / Out Times */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Clock In</Text>
                  <TextInput
                    value={manualClockIn}
                    onChangeText={setManualClockIn}
                    placeholder="09:00"
                    style={styles.modalInput}
                  />
                </View>

                {manualStatus === 'completed' && (
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Clock Out</Text>
                    <TextInput
                      value={manualClockOut}
                      onChangeText={setManualClockOut}
                      placeholder="18:00"
                      style={styles.modalInput}
                    />
                  </View>
                )}
              </View>

              {/* Reason Suggestions */}
              <Text style={styles.inputLabel}>Reason</Text>
              <TextInput
                value={manualReason}
                onChangeText={setManualReason}
                placeholder="Reason for manual entry..."
                style={styles.modalInput}
              />
              <View style={styles.quickReasonsRow}>
                {QUICK_REASONS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setManualReason(r)}
                    style={[styles.quickReasonPill, manualReason === r && styles.quickReasonPillActive]}
                  >
                    <Text
                      style={[
                        styles.quickReasonText,
                        manualReason === r && styles.quickReasonTextActive,
                      ]}
                    >
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleManualSubmit}
                disabled={submittingManual}
                style={styles.submitBtn}
                activeOpacity={0.8}
              >
                {submittingManual ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Record Attendance</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  refreshBtn: {
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  topActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  timezoneBadge: {
    backgroundColor: '#EBF3EC',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  timezoneBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4F6748',
  },
  addManualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4F6748',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 11,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  addManualBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rosterCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 16,
    overflow: 'hidden',
    padding: 0,
  },
  toolbar: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D9',
    backgroundColor: '#FBF9F5',
    gap: 10,
  },
  rosterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rosterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  rosterSubtitle: {
    fontSize: 12,
    color: '#71717A',
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  filterPillActive: {
    backgroundColor: '#2D2D2A',
    borderColor: '#2D2D2A',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#71717A',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  pillCountBadge: {
    backgroundColor: '#F3F0EC',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  pillCountBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  pillCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  pillCountTextActive: {
    color: '#FFFFFF',
  },
  subTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3EFEA',
    borderRadius: 10,
    padding: 3,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  subTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  subTabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  subTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#71717A',
  },
  subTabTextActive: {
    color: '#2D2D2A',
    fontWeight: '700',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBF9F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D9',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  tableHeaderCol: {
    fontSize: 10,
    fontWeight: '700',
    color: '#71717A',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3EFEA',
    backgroundColor: '#FFFFFF',
  },
  tableCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    width: 32,
    height: 32,
  },
  avatarPhoto: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  avatarInitial: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EBF3EC',
    borderWidth: 1,
    borderColor: '#C5D8C1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F6748',
  },
  employeeName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  employeeRole: {
    fontSize: 10,
    color: '#71717A',
    textTransform: 'capitalize',
    marginTop: 1,
  },
  timeWithIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  clockInText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  clockOutText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  dashText: {
    fontSize: 12,
    color: '#A1A1AA',
  },
  loadingBox: {
    padding: 30,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    color: '#71717A',
  },
  emptyBox: {
    padding: 30,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#71717A',
  },
  viewAllLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F6748',
  },
  historyFiltersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  historySelectorBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FBF9F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  historySelectorBtnText: {
    flex: 1,
    fontSize: 12,
    color: '#2D2D2A',
    fontWeight: '600',
  },
  historyDateSelectorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FBF9F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  historyDateBtnText: {
    flex: 1,
    fontSize: 12,
    color: '#2D2D2A',
    fontWeight: '600',
  },
  placeholderText: {
    color: '#A1A1AA',
    fontWeight: '400',
  },
  historyCountText: {
    fontSize: 11,
    color: '#71717A',
    fontWeight: '600',
  },
  historyCard: {
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  historyCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  historyEmpName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  historyDate: {
    fontSize: 10,
    color: '#71717A',
    marginTop: 1,
  },
  historyStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  historyStatusText: {
    fontSize: 9,
    fontWeight: '700',
  },
  historyTimesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyTimeLabel: {
    fontSize: 10,
    color: '#71717A',
  },
  historyTimeVal: {
    fontWeight: '700',
    color: '#2D2D2A',
  },
  viewPhotoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  viewPhotoLinkText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F6748',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 18,
  },
  photoModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  photoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  photoModalName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  photoModalRole: {
    fontSize: 11,
    color: '#71717A',
    textTransform: 'capitalize',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  fullSelfieImage: {
    width: '100%',
    height: 320,
    borderRadius: 12,
    backgroundColor: '#000000',
  },
  selfieVerifiedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EBF3EC',
    padding: 10,
    borderRadius: 8,
  },
  selfieVerifiedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
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
    borderColor: '#4F6748',
    backgroundColor: '#EBF3EC',
  },
  calDayCellSelected: {
    backgroundColor: '#4F6748',
    borderColor: '#4F6748',
  },
  calDayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  calDayTextToday: {
    color: '#4F6748',
    fontWeight: '700',
  },
  calDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  calendarActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F0EAE1',
    paddingTop: 10,
    gap: 8,
  },
  calActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FBF9F5',
    borderWidth: 1,
    borderColor: '#4F6748',
    borderRadius: 8,
    paddingVertical: 8,
  },
  calActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F6748',
  },
  employeeModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  empPickItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FBF9F5',
    marginVertical: 2,
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  empPickItemActive: {
    backgroundColor: '#EBF3EC',
    borderColor: '#7FA285',
  },
  empPickItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  empPickItemTextActive: {
    color: '#4F6748',
    fontWeight: '800',
  },
  manualModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#71717A',
    marginTop: 6,
  },
  modalInput: {
    backgroundColor: '#FBF9F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: '#2D2D2A',
  },
  modalDateSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FBF9F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modalDateSelectorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  staffSelectPill: {
    backgroundColor: '#FBF9F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
  },
  staffSelectPillActive: {
    backgroundColor: '#4F6748',
    borderColor: '#4F6748',
  },
  staffSelectPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#71717A',
  },
  staffSelectPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  statusToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FBF9F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    alignItems: 'center',
  },
  statusToggleBtnActive: {
    backgroundColor: '#4F6748',
    borderColor: '#4F6748',
  },
  statusToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#71717A',
  },
  statusToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  quickReasonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 4,
  },
  quickReasonPill: {
    backgroundColor: '#FBF9F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  quickReasonPillActive: {
    backgroundColor: '#EBF3EC',
    borderColor: '#7FA285',
  },
  quickReasonText: {
    fontSize: 10,
    color: '#71717A',
  },
  quickReasonTextActive: {
    color: '#4F6748',
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: '#4F6748',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default AttendanceManagerScreen;
