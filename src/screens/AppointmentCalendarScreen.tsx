/**
 * AppointmentCalendarScreen — 1-to-1 Match with Omega Spa POS Web Software
 * Matches frontend/src/pages/AppointmentCalendar.jsx and user's Mobile Web View:
 * - Header: "Appointments" | Button: "📅 Appointment"
 * - Date Navigation Toolbar: [<] [ 04-11-2026 📅 ] [>] | "04 Nov 2026 — No appointments scheduled" | [Today]
 * - Staff Filter Chips: "All Staff (9)", "Samira Djouwa · Nail Tech", "Fortune Fotso · Body Massage", etc.
 * - Status Legend: STATUS: ● Completed  ● Scheduled  ● No-Show  ● Late
 * - Full Master Time Table Grid:
 *   - Column 1: TIME (10:00 to 21:00 in 30-min slots)
 *   - Columns 2..N: Each Technician "[Name] (TECHNICIAN)"
 *   - Appointment cards in cells with client name, service, status colors
 *   - Empty cells tappable to instantly book into that technician's slot!
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  RefreshControl,
  Platform,
} from 'react-native';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  User,
  Users,
  CalendarPlus,
  Clock,
  Check,
  Plus,
} from 'lucide-react-native';
import THEME from '../constants/theme';
import Header from '../components/Header';
import { useAppointments, Appointment } from '../context/AppointmentsContext';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/date';

const TIME_SLOTS = [
  '09:00', '09:30',
  '10:00', '10:30',
  '11:00', '11:30',
  '12:00', '12:30',
  '13:00', '13:30',
  '14:00', '14:30',
  '15:00', '15:30',
  '16:00', '16:30',
  '17:00', '17:30',
  '18:00', '18:30',
  '19:00', '19:30',
  '20:00', '20:30',
  '21:00',
];

function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function shiftDate(dateStr: string, days: number): string {
  const current = dateStr || new Date().toISOString().split('T')[0];
  const [y, m, d] = current.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const nextY = date.getFullYear();
  const nextM = String(date.getMonth() + 1).padStart(2, '0');
  const nextD = String(date.getDate()).padStart(2, '0');
  return `${nextY}-${nextM}-${nextD}`;
}

function snapToSlot(timeStr: string): string {
  if (!timeStr) return '09:00';
  const [h, m] = timeStr.split(':').map(Number);
  const slotMin = m < 30 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${slotMin}`;
}

interface AppointmentCalendarScreenProps {
  onOpenMenu?: () => void;
  onSelectAppointment?: (appointment: Appointment) => void;
  onCreateAppointment?: (prefill?: { technicianId?: string; date?: string; time?: string }) => void;
}

export const AppointmentCalendarScreen: React.FC<AppointmentCalendarScreenProps> = ({
  onOpenMenu,
  onSelectAppointment,
  onCreateAppointment,
}) => {
  const { user, allUsers } = useAuth();
  const { appointments, loading, refreshAppointments } = useAppointments();

  const todayStr = new Date().toISOString().split('T')[0];
  const [currentDate, setCurrentDate] = useState<string>(todayStr);
  const [selectedTechFilter, setSelectedTechFilter] = useState<string>('all');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);

  const isTechnician = user?.role === 'technician';

  // Technicians from backend or fallback to demo
  const technicians = useMemo(() => {
    const list = allUsers.filter((u) => u.role === 'technician' && u.active !== false);
    if (list.length > 0) return list;
    return [
      { id: 'tech-1', name: 'Samira Djouwa', role: 'technician', specialties: ['Nail Tech'], active: true, email: '' },
      { id: 'tech-2', name: 'Fortune Fotso', role: 'technician', specialties: ['Body Massage'], active: true, email: '' },
      { id: 'tech-3', name: 'Justice B', role: 'technician', specialties: ['BARBER'], active: true, email: '' },
      { id: 'tech-4', name: 'Celia Whapi', role: 'technician', specialties: ['Facial'], active: true, email: '' },
      { id: 'tech-5', name: 'Jimmy Guessele', role: 'technician', specialties: ['BARBER'], active: true, email: '' },
      { id: 'tech-6', name: 'Falone Metsadeng', role: 'technician', specialties: ['Facial'], active: true, email: '' },
      { id: 'tech-7', name: 'Kobe Celestin', role: 'technician', specialties: ['Nail Tech'], active: true, email: '' },
      { id: 'tech-8', name: 'Omgba Francis', role: 'technician', specialties: ['BARBER'], active: true, email: '' },
      { id: 'tech-9', name: 'Enoh praises', role: 'technician', specialties: ['Technician'], active: true, email: '' },
    ];
  }, [allUsers]);

  const availableTechnicians = useMemo(() => {
    if (isTechnician) {
      return technicians.filter(
        (t) =>
          t.name.toLowerCase() === (user?.name || '').toLowerCase() ||
          String(t.id) === String(user?.id)
      );
    }
    return technicians;
  }, [isTechnician, technicians, user]);

  const visibleTechnicians = useMemo(() => {
    if (selectedTechFilter === 'all' || isTechnician) {
      return availableTechnicians;
    }
    return availableTechnicians.filter((t) => String(t.id) === String(selectedTechFilter));
  }, [selectedTechFilter, isTechnician, availableTechnicians]);

  const dayAppointments = useMemo(() => {
    return appointments.filter((a) => a.date === currentDate && a.status !== 'CANCELLED');
  }, [appointments, currentDate]);

  // Build grid map: techId -> { slot -> Appointment }
  const gridMap = useMemo(() => {
    const map: Record<string, Record<string, { appointment: Appointment; isStart: boolean; duration: number }>> = {};
    availableTechnicians.forEach((t) => {
      map[t.id] = {};
    });

    dayAppointments.forEach((apt) => {
      const techId = apt.mainTechnicianId || availableTechnicians[0]?.id;
      if (!techId || !map[techId]) {
        // Find matching tech by name
        const foundTech = availableTechnicians.find(
          (t) => t.name.toLowerCase() === (apt.mainTechnicianName || '').toLowerCase()
        );
        if (foundTech && map[foundTech.id]) {
          const slot = snapToSlot(apt.time);
          map[foundTech.id][slot] = { appointment: apt, isStart: true, duration: 60 };
        }
        return;
      }

      const slot = snapToSlot(apt.time);
      map[techId][slot] = { appointment: apt, isStart: true, duration: 60 };
    });

    return map;
  }, [availableTechnicians, dayAppointments]);

  const isToday = currentDate === todayStr;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return {
          bg: '#F2F7F0',
          border: '#4F6748',
          cardBorder: '#CFDEC9',
          text: '#2F4E29',
          dot: '#4F6748',
          label: 'Completed',
        };
      case 'CANCELLED':
        return {
          bg: '#F3F4F6',
          border: '#9CA3AF',
          cardBorder: '#E5E7EB',
          text: '#4B5563',
          dot: '#9CA3AF',
          label: 'Cancelled',
        };
      case 'NO_SHOW':
        return {
          bg: '#FEF2F2',
          border: '#DC2626',
          cardBorder: '#FECACA',
          text: '#991B1B',
          dot: '#DC2626',
          label: 'No-Show',
        };
      case 'LATE':
        return {
          bg: '#FFFDF5',
          border: '#D97706',
          cardBorder: '#FDE68A',
          text: '#92400E',
          dot: '#D97706',
          label: 'Late',
        };
      default:
        return {
          bg: '#F8FAFC',
          border: '#3B82F6',
          cardBorder: '#CBD5E1',
          text: '#1D4ED8',
          dot: '#3B82F6',
          label: 'Scheduled',
        };
    }
  };

  return (
    <View style={styles.container}>
      {/* Page Header */}
      <Header
        title={isTechnician ? 'My Appointments' : 'Appointments'}
        onOpenMenu={onOpenMenu}
        rightAction={
          <TouchableOpacity
            onPress={() => onCreateAppointment?.({ date: currentDate })}
            style={styles.appointmentBtn}
            activeOpacity={0.8}
          >
            <CalendarPlus size={16} color="#FFFFFF" />
            <Text style={styles.appointmentBtnText}>
              {isTechnician ? 'Book Appointment' : 'Appointment'}
            </Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainScrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refreshAppointments}
            tintColor={THEME.colors.primaryDark}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Date Navigation Toolbar — Exact match with Web Software */}
        <View style={styles.dateToolbarCard}>
          <View style={styles.dateToolbarTop}>
            {/* Prev Day */}
            <TouchableOpacity
              onPress={() => setCurrentDate((d) => shiftDate(d, -1))}
              style={styles.dateStepperBtn}
              activeOpacity={0.7}
            >
              <ChevronLeft size={16} color={THEME.colors.text} />
            </TouchableOpacity>

            {/* Date Display Input with Calendar Icon */}
            <TouchableOpacity
              onPress={() => setIsDatePickerOpen(true)}
              style={styles.datePickerInput}
              activeOpacity={0.8}
            >
              <CalendarIcon size={14} color="#4F6748" style={{ marginRight: 8 }} />
              <Text style={styles.datePickerInputText}>
                {formatDate(currentDate, 'dd-MM-yyyy')}
              </Text>
              <CalendarIcon size={14} color={THEME.colors.textMuted} style={{ marginLeft: 8 }} />
            </TouchableOpacity>

            {/* Next Day */}
            <TouchableOpacity
              onPress={() => setCurrentDate((d) => shiftDate(d, 1))}
              style={styles.dateStepperBtn}
              activeOpacity={0.7}
            >
              <ChevronRight size={16} color={THEME.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Subtitle & Return to Today */}
          <View style={styles.dateToolbarBottom}>
            <Text style={styles.dateDisplaySubtitle}>
              {formatDate(currentDate, 'dd MMM yyyy')}
              {dayAppointments.length === 0 ? (
                <Text style={styles.noApptText}> — No appointments scheduled</Text>
              ) : (
                <Text style={styles.apptCountText}> — {dayAppointments.length} scheduled</Text>
              )}
            </Text>

            {!isToday && (
              <TouchableOpacity
                onPress={() => setCurrentDate(todayStr)}
                style={styles.todayBtn}
                activeOpacity={0.7}
              >
                <RotateCcw size={12} color="#4F6748" />
                <Text style={styles.todayBtnText}>Today</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Staff Filter Chips — Exact match with Web Software */}
        {!isTechnician && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.staffChipsScroll}
            contentContainerStyle={styles.staffChipsContainer}
          >
            <TouchableOpacity
              onPress={() => setSelectedTechFilter('all')}
              style={[
                styles.staffChip,
                selectedTechFilter === 'all' && styles.staffChipActive,
              ]}
              activeOpacity={0.7}
            >
              <Users size={13} color={selectedTechFilter === 'all' ? '#2D2D2A' : '#737373'} />
              <Text
                style={[
                  styles.staffChipText,
                  selectedTechFilter === 'all' && styles.staffChipTextActive,
                ]}
              >
                All Staff ({technicians.length})
              </Text>
            </TouchableOpacity>

            {technicians.map((t) => {
              const isSelected = selectedTechFilter === String(t.id);
              const specialty = (t.specialties || []).join(', ') || 'Technician';
              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setSelectedTechFilter(String(t.id))}
                  style={[styles.staffChip, isSelected && styles.staffChipActive]}
                  activeOpacity={0.7}
                >
                  <User size={13} color={isSelected ? '#2D2D2A' : '#737373'} />
                  <Text
                    style={[
                      styles.staffChipText,
                      isSelected && styles.staffChipTextActive,
                    ]}
                  >
                    {t.name} · {specialty}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Status Legend Bar — Exact match with Web Software */}
        <View style={styles.statusLegendBar}>
          <Text style={styles.statusLegendTitle}>STATUS:</Text>
          <View style={[styles.statusBadgeItem, { backgroundColor: '#F2F7F0', borderColor: '#CFDEC9' }]}>
            <View style={[styles.statusDot, { backgroundColor: '#4F6748' }]} />
            <Text style={[styles.statusBadgeText, { color: '#2F4E29' }]}>Completed</Text>
          </View>
          <View style={[styles.statusBadgeItem, { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' }]}>
            <View style={[styles.statusDot, { backgroundColor: '#3B82F6' }]} />
            <Text style={[styles.statusBadgeText, { color: '#1D4ED8' }]}>Scheduled</Text>
          </View>
          <View style={[styles.statusBadgeItem, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
            <View style={[styles.statusDot, { backgroundColor: '#DC2626' }]} />
            <Text style={[styles.statusBadgeText, { color: '#991B1B' }]}>No-Show</Text>
          </View>
          <View style={[styles.statusBadgeItem, { backgroundColor: '#FFFDF5', borderColor: '#FDE68A' }]}>
            <View style={[styles.statusDot, { backgroundColor: '#D97706' }]} />
            <Text style={[styles.statusBadgeText, { color: '#92400E' }]}>Late</Text>
          </View>
        </View>

        {/* Calendar Master Grid Table Card — Exact match with Web Software */}
        <View style={styles.gridTableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              {/* Header Row: Time + Each Technician */}
              <View style={styles.gridHeaderRow}>
                <View style={styles.timeHeaderCell}>
                  <Text style={styles.headerCellText}>TIME</Text>
                </View>

                {visibleTechnicians.map((tech) => (
                  <View key={tech.id} style={styles.techHeaderCell}>
                    <Text style={styles.techNameText} numberOfLines={1}>
                      {tech.name}
                    </Text>
                    <Text style={styles.techRoleText} numberOfLines={1}>
                      (TECHNICIAN)
                    </Text>
                  </View>
                ))}
              </View>

              {/* Grid Rows for each Time Slot */}
              {TIME_SLOTS.map((slot) => (
                <View key={slot} style={styles.gridDataRow}>
                  {/* Time Label */}
                  <View style={styles.timeSlotCell}>
                    <Text style={styles.timeSlotText}>{slot}</Text>
                  </View>

                  {/* Technician Columns */}
                  {visibleTechnicians.map((tech) => {
                    const slotData = gridMap[tech.id]?.[slot];

                    if (slotData?.appointment) {
                      const apt = slotData.appointment;
                      const statusConfig = getStatusColor(apt.status);
                      const serviceText =
                        apt.services?.map((s) => s.serviceName).join(', ') || 'Spa Treatment';

                      return (
                        <TouchableOpacity
                          key={tech.id}
                          style={[
                            styles.appointmentSlotCell,
                            {
                              backgroundColor: statusConfig.bg,
                              borderColor: statusConfig.cardBorder,
                              borderLeftColor: statusConfig.border,
                            },
                          ]}
                          onPress={() => onSelectAppointment?.(apt)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.aptClientName} numberOfLines={1}>
                            {apt.clientName}
                          </Text>
                          <Text style={styles.aptServiceSummary} numberOfLines={2}>
                            {serviceText}
                          </Text>
                          <View style={styles.aptTimeRow}>
                            <Clock size={10} color={statusConfig.text} />
                            <Text style={[styles.aptTimeLabel, { color: statusConfig.text }]}>
                              {apt.time}
                            </Text>
                            <View
                              style={[
                                styles.slotStatusBadge,
                                { backgroundColor: statusConfig.cardBorder },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.slotStatusBadgeText,
                                  { color: statusConfig.text },
                                ]}
                              >
                                {statusConfig.label}
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    }

                    // Empty Slot (Tappable to Book)
                    return (
                      <TouchableOpacity
                        key={tech.id}
                        style={styles.emptySlotCell}
                        onPress={() =>
                          onCreateAppointment?.({
                            technicianId: tech.id,
                            date: currentDate,
                            time: slot,
                          })
                        }
                        activeOpacity={0.5}
                      >
                        <Plus size={11} color="transparent" />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      {/* Date Picker Modal */}
      <Modal
        visible={isDatePickerOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsDatePickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsDatePickerOpen(false)}
        >
          <View style={styles.datePickerModalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Select Schedule Date</Text>
            <View style={styles.quickDaysRow}>
              {[-2, -1, 0, 1, 2, 3, 4].map((diff) => {
                const dStr = shiftDate(todayStr, diff);
                const isSelected = currentDate === dStr;
                return (
                  <TouchableOpacity
                    key={diff}
                    style={[styles.quickDayBtn, isSelected && styles.quickDayBtnActive]}
                    onPress={() => {
                      setCurrentDate(dStr);
                      setIsDatePickerOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.quickDayText,
                        isSelected && styles.quickDayTextActive,
                      ]}
                    >
                      {formatDate(dStr, 'EEE dd')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={() => {
                setCurrentDate(todayStr);
                setIsDatePickerOpen(false);
              }}
              style={styles.resetTodayModalBtn}
            >
              <Text style={styles.resetTodayModalText}>Jump to Today</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF7F2', // Warm Ivory (#FBF7F2) matching web app body
  },
  appointmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#8B9E82', // Sage Green (#8B9E82) matching Image 2 "📅 Appointment"
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 11,
    ...THEME.shadows.sm,
  },
  appointmentBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    padding: 12,
    paddingBottom: 32,
    gap: 12,
  },
  dateToolbarCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 16,
    padding: 12,
    ...THEME.shadows.sm,
  },
  dateToolbarTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dateStepperBtn: {
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerInput: {
    flex: 1,
    height: 38,
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  datePickerInputText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  dateToolbarBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F4EFEA',
  },
  dateDisplaySubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  noApptText: {
    fontWeight: '400',
    color: '#737373',
  },
  apptCountText: {
    fontWeight: '600',
    color: '#4F6748',
  },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCE7D7',
    borderWidth: 1,
    borderColor: '#A7B89A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  todayBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F6748',
  },
  staffChipsScroll: {
    marginHorizontal: -4,
  },
  staffChipsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  staffChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    backgroundColor: '#FFFFFF',
  },
  staffChipActive: {
    backgroundColor: '#DCE7D7', // Sage green matching Image 2
    borderColor: '#8B9E82',
  },
  staffChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#737373',
  },
  staffChipTextActive: {
    color: '#2D2D2A',
    fontWeight: '700',
  },
  statusLegendBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 2,
  },
  statusLegendTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#737373',
    letterSpacing: 0.5,
    marginRight: 4,
  },
  statusBadgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  gridTableCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 16,
    overflow: 'hidden',
    ...THEME.shadows.sm,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F6F1EB',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D9',
  },
  timeHeaderCell: {
    width: 68,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: '#E8E2D9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCellText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#737373',
  },
  techHeaderCell: {
    width: 160,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: '#E8E2D9',
    justifyContent: 'center',
  },
  techNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  techRoleText: {
    fontSize: 10,
    color: '#737373',
    marginTop: 1,
  },
  gridDataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F4EFEA',
    minHeight: 52,
  },
  timeSlotCell: {
    width: 68,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E8E2D9',
    backgroundColor: '#FAF7F2',
  },
  timeSlotText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  emptySlotCell: {
    width: 160,
    borderRightWidth: 1,
    borderRightColor: '#F4EFEA',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appointmentSlotCell: {
    width: 160,
    borderRightWidth: 1,
    borderLeftWidth: 4, // 4px colored border left matching web app!
    padding: 6,
    justifyContent: 'center',
  },
  aptClientName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2D2D2A',
  },
  aptServiceSummary: {
    fontSize: 10,
    color: '#555555',
    marginTop: 2,
    lineHeight: 13,
  },
  aptTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  aptTimeLabel: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  slotStatusBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  slotStatusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  datePickerModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    ...THEME.shadows.md,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D2D2A',
    marginBottom: 12,
    textAlign: 'center',
  },
  quickDaysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 16,
  },
  quickDayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  quickDayBtnActive: {
    backgroundColor: '#8B9E82',
    borderColor: '#8B9E82',
  },
  quickDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  quickDayTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  resetTodayModalBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E8E2D9',
  },
  resetTodayModalText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F6748',
  },
});

export default AppointmentCalendarScreen;
