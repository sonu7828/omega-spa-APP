/**
 * CreateAppointmentScreen — 1-to-1 Match with Omega Spa POS Web Software
 * Matches frontend/src/pages/CreateAppointment.jsx:
 * - Header: Back arrow + "Create Appointment"
 * - Client Selection: Universal searchable dropdown with avatar, phone, "Change" button, and "+ New Client"
 * - Multi-Service Selection: Chips of selected services with FCFA price & duration, category filter tabs, full 66 services catalog
 * - Main Technician: Dropdown/Selector with specialties & schedule conflict warning
 * - Date & Time: 30-min slot selector (10:00 to 21:00) with dynamic duration end-time calculation
 * - Prospecting Welcome Promo: 0%, 5%, 10%, 15%, 20% discount chips
 * - Deposit warning banner for clients with >= 2 no-shows
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  ArrowLeft,
  Search,
  Plus,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  TriangleAlert,
  Sparkles,
  Award,
  Calendar,
  Clock,
  User as UserIcon,
  RefreshCw,
} from 'lucide-react-native';
import THEME from '../constants/theme';
import Header from '../components/Header';
import Card from '../components/Card';
import { useClients, Client } from '../context/ClientsContext';
import { useAppointments } from '../context/AppointmentsContext';
import { useServices, ServiceItem } from '../context/ServicesContext';
import { useAuth } from '../context/AuthContext';
import { formatFCFA } from '../utils/currency';
import { formatDate } from '../utils/date';

const BOOKING_TIME_SLOTS = [
  { value: '09:00', label: '09:00 AM' },
  { value: '09:30', label: '09:30 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '10:30', label: '10:30 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '11:30', label: '11:30 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '12:30', label: '12:30 PM' },
  { value: '13:00', label: '01:00 PM' },
  { value: '13:30', label: '01:30 PM' },
  { value: '14:00', label: '02:00 PM' },
  { value: '14:30', label: '02:30 PM' },
  { value: '15:00', label: '03:00 PM' },
  { value: '15:30', label: '03:30 PM' },
  { value: '16:00', label: '04:00 PM' },
  { value: '16:30', label: '04:30 PM' },
  { value: '17:00', label: '05:00 PM' },
  { value: '17:30', label: '05:30 PM' },
  { value: '18:00', label: '06:00 PM' },
  { value: '18:30', label: '06:30 PM' },
  { value: '19:00', label: '07:00 PM' },
  { value: '19:30', label: '07:30 PM' },
  { value: '20:00', label: '08:00 PM' },
  { value: '20:30', label: '08:30 PM' },
  { value: '21:00', label: '09:00 PM' },
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

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

interface CreateAppointmentScreenProps {
  initialClientId?: string;
  initialTechId?: string;
  initialDate?: string;
  initialTime?: string;
  onBack?: () => void;
  onSuccess?: () => void;
  onNavigateAddClient?: () => void;
}

export const CreateAppointmentScreen: React.FC<CreateAppointmentScreenProps> = ({
  initialClientId,
  initialTechId,
  initialDate,
  initialTime,
  onBack,
  onSuccess,
  onNavigateAddClient,
}) => {
  const { clients, searchClientsApi } = useClients();
  const { appointments, createAppointment } = useAppointments();
  const { activeServices, refreshServices } = useServices();
  const { allUsers, user } = useAuth();

  // Keep services catalog strictly synchronized with live Railway backend on mount
  useEffect(() => {
    refreshServices().catch(() => {});
  }, [refreshServices]);

  const isTechnician = user?.role === 'technician';
  const todayStr = new Date().toISOString().split('T')[0];

  // Active technicians
  const technicians = useMemo(() => {
    const list = allUsers.filter((u) => u.role === 'technician' && u.active !== false);
    if (list.length > 0) return list;
    return [
      { id: 'tech-1', name: 'Samira Djouwa', role: 'technician', specialties: ['Nail Tech'], active: true, email: '' },
      { id: 'tech-2', name: 'Fortune Fotso', role: 'technician', specialties: ['Body Massage'], active: true, email: '' },
      { id: 'tech-3', name: 'Justice B', role: 'technician', specialties: ['BARBER'], active: true, email: '' },
      { id: 'tech-4', name: 'Celia Whapi', role: 'technician', specialties: ['Facial'], active: true, email: '' },
    ];
  }, [allUsers]);

  // Form State
  const [clientId, setClientId] = useState<string>(initialClientId || '');
  const [selectedTechId, setSelectedTechId] = useState<string>(
    initialTechId || (isTechnician ? String(user?.id) : (technicians[0]?.id || ''))
  );
  const [date, setDate] = useState<string>(initialDate || todayStr);
  const [time, setTime] = useState<string>(initialTime || '09:00');
  const [notes, setNotes] = useState<string>('');
  const [promoPercent, setPromoPercent] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Multi-service selection: list of ServiceItem
  const [selectedServices, setSelectedServices] = useState<ServiceItem[]>([]);

  // Modals & Pickers
  const [isClientPickerOpen, setIsClientPickerOpen] = useState<boolean>(false);
  const [clientSearchQuery, setClientSearchQuery] = useState<string>('');
  const [serverSearchedClients, setServerSearchedClients] = useState<Client[]>([]);
  const [isSearchingServer, setIsSearchingServer] = useState<boolean>(false);

  // Live Server search trigger whenever query changes
  useEffect(() => {
    if (!clientSearchQuery || clientSearchQuery.trim().length < 2) {
      setServerSearchedClients([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingServer(true);
      try {
        const results = await searchClientsApi(clientSearchQuery);
        setServerSearchedClients(results);
      } catch (e) {}
      setIsSearchingServer(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [clientSearchQuery, searchClientsApi]);

  const [isServicePickerOpen, setIsServicePickerOpen] = useState<boolean>(false);
  const [serviceSearchQuery, setServiceSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const [isTechPickerOpen, setIsTechPickerOpen] = useState<boolean>(false);

  // Date & Time Pickers (Exact 1-to-1 Match with Web Software)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    if (initialDate || todayStr) {
      const [y, m, d] = (initialDate || todayStr).split('-').map(Number);
      return new Date(y, (m || 1) - 1, d || 1);
    }
    return new Date();
  });
  const [isTimePickerOpen, setIsTimePickerOpen] = useState<boolean>(false);

  const selectedTimeSlot = useMemo(() => {
    return BOOKING_TIME_SLOTS.find((s) => s.value === time);
  }, [time]);

  // Calendar Calculation Engine
  const currentYear = calendarMonth.getFullYear();
  const currentMonthIdx = calendarMonth.getMonth();
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const currentMonthName = MONTH_NAMES[currentMonthIdx];
  const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  const daysInCurrentMonth = new Date(currentYear, currentMonthIdx + 1, 0).getDate();
  const firstDayRaw = new Date(currentYear, currentMonthIdx, 1).getDay();
  // Monday = 0, Sunday = 6
  const firstDayOffset = firstDayRaw === 0 ? 6 : firstDayRaw - 1;

  const calendarDays = useMemo(() => {
    const list: (number | null)[] = [];
    for (let i = 0; i < firstDayOffset; i++) {
      list.push(null);
    }
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      list.push(d);
    }
    return list;
  }, [firstDayOffset, daysInCurrentMonth]);

  const todayObj = new Date();
  const isTodayDate = (day: number) => {
    return (
      currentYear === todayObj.getFullYear() &&
      currentMonthIdx === todayObj.getMonth() &&
      day === todayObj.getDate()
    );
  };

  const isSelectedDate = (day: number) => {
    if (!date) return false;
    const [y, m, d] = date.split('-').map(Number);
    return currentYear === y && (currentMonthIdx + 1) === m && day === d;
  };

  const handleSelectDay = (day: number) => {
    const yStr = String(currentYear);
    const mStr = String(currentMonthIdx + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    setDate(`${yStr}-${mStr}-${dStr}`);
    setIsDatePickerOpen(false);
  };

  const handlePrevMonth = () => {
    setCalendarMonth(new Date(currentYear, currentMonthIdx - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth(new Date(currentYear, currentMonthIdx + 1, 1));
  };

  const handleQuickDate = (offsetDays: number) => {
    const target = new Date();
    target.setDate(target.getDate() + offsetDays);
    const yStr = String(target.getFullYear());
    const mStr = String(target.getMonth() + 1).padStart(2, '0');
    const dStr = String(target.getDate()).padStart(2, '0');
    setDate(`${yStr}-${mStr}-${dStr}`);
    setCalendarMonth(new Date(target.getFullYear(), target.getMonth(), 1));
    setIsDatePickerOpen(false);
  };

  // Selected Client
  const selectedClient = useMemo(() => {
    const foundLocal = clients.find((c) => String(c.id) === String(clientId));
    if (foundLocal) return foundLocal;
    return serverSearchedClients.find((c) => String(c.id) === String(clientId));
  }, [clients, clientId, serverSearchedClients]);

  // Filtered Clients for search
  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) {
      return clients.slice(0, 50);
    }
    const q = clientSearchQuery.toLowerCase().trim();
    const cleanQ = q.replace(/[\s\-\+]/g, '');

    const localMatches = clients.filter((c) => {
      const matchName = c.name && c.name.toLowerCase().includes(q);
      const cleanPhone = (c.phone || '').replace(/[\s\-\+]/g, '');
      const matchPhone = cleanQ.length > 0 && cleanPhone.includes(cleanQ);
      return matchName || matchPhone;
    });

    const localIds = new Set(localMatches.map((c) => c.id));
    const extra = serverSearchedClients.filter((c) => !localIds.has(c.id));
    return [...localMatches, ...extra];
  }, [clients, clientSearchQuery, serverSearchedClients]);

  // Service Categories
  const serviceCategories = useMemo(() => {
    const set = new Set<string>();
    activeServices.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return ['ALL', ...Array.from(set)];
  }, [activeServices]);

  // Filtered Services for picker
  const filteredServices = useMemo(() => {
    return activeServices.filter((s) => {
      if (selectedCategory !== 'ALL' && s.category !== selectedCategory) return false;
      if (!serviceSearchQuery.trim()) return true;
      const q = serviceSearchQuery.toLowerCase().trim();
      return (
        s.name.toLowerCase().includes(q) ||
        (s.category && s.category.toLowerCase().includes(q))
      );
    });
  }, [activeServices, selectedCategory, serviceSearchQuery]);

  // Selected Technician
  const selectedTech = useMemo(() => {
    return technicians.find((t) => String(t.id) === String(selectedTechId));
  }, [technicians, selectedTechId]);

  // Duration & End Time calculation
  const totalDurationMinutes = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + (s.numericDuration || 45), 0);
  }, [selectedServices]);

  const newStartMins = timeToMinutes(time);
  const newEndMins = newStartMins + (totalDurationMinutes || 30);
  const newEndTime = minutesToTime(newEndMins);

  // Conflict detection
  const conflictingAppointment = useMemo(() => {
    if (!date || !time || !selectedTechId || totalDurationMinutes <= 0) return null;
    return appointments.find((apt) => {
      if (apt.date !== date) return false;
      if (String(apt.mainTechnicianId) !== String(selectedTechId)) return false;
      if (apt.status === 'CANCELLED' || apt.status === 'NO_SHOW') return false;

      const aptStart = timeToMinutes(apt.time);
      const aptDur = apt.services?.reduce((acc, s) => acc + 45, 0) || 45;
      const aptEnd = aptStart + aptDur;

      return newStartMins < aptEnd && newEndMins > aptStart;
    });
  }, [appointments, date, time, selectedTechId, totalDurationMinutes, newStartMins, newEndMins]);

  // Total Price calculation
  const grossTotal = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + s.numericPrice, 0);
  }, [selectedServices]);

  const discountAmount = Math.round((grossTotal * promoPercent) / 100);
  const finalPrice = Math.max(0, grossTotal - discountAmount);

  // Handlers
  const handleAddService = (srv: ServiceItem) => {
    setSelectedServices((prev) => [...prev, srv]);
    setIsServicePickerOpen(false);
  };

  const handleRemoveService = (idx: number) => {
    setSelectedServices((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleBook = async () => {
    if (!clientId) {
      Alert.alert('Required', 'Please select a client for this appointment.');
      return;
    }
    if (selectedServices.length === 0) {
      Alert.alert('Required', 'Please select at least one service for this visit.');
      return;
    }
    if (!selectedTechId) {
      Alert.alert('Required', 'Please assign a primary technician.');
      return;
    }

    try {
      setIsSubmitting(true);
      await createAppointment({
        clientId,
        mainTechnicianId: selectedTechId,
        date,
        time,
        notes: notes.trim() || undefined,
        services: selectedServices.map((s) => ({
          serviceId: s.id,
          technicianId: selectedTechId,
          price: s.numericPrice,
        })),
        promoDiscountPercent: promoPercent > 0 ? promoPercent : undefined,
      });

      setIsSubmitting(false);
      Alert.alert('Success', 'Appointment booked successfully!', [
        {
          text: 'OK',
          onPress: () => {
            if (onSuccess) onSuccess();
            else if (onBack) onBack();
          },
        },
      ]);
    } catch (e: any) {
      setIsSubmitting(false);
      Alert.alert('Booking Error', e?.message || 'Failed to book appointment.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header — 1-to-1 match with Web Software */}
      <View style={styles.topBar}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={18} color="#2D2D2A" />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.topBarTitle}>Create Appointment</Text>
          <Text style={styles.topBarSub}>Schedule treatment & assign technician</Text>
        </View>
      </View>

      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={styles.formContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ===================================================================== */}
        {/* 1. CLIENT SELECTION                                                   */}
        {/* ===================================================================== */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>
              Client <Text style={{ color: '#DC2626' }}>*</Text>
            </Text>
            {onNavigateAddClient && (
              <TouchableOpacity
                onPress={onNavigateAddClient}
                style={styles.newClientLink}
                activeOpacity={0.7}
              >
                <Plus size={12} color="#4F6748" />
                <Text style={styles.newClientLinkText}>+ New Client</Text>
              </TouchableOpacity>
            )}
          </View>

          {selectedClient ? (
            /* Selected Client Card */
            <View style={styles.selectedClientCard}>
              <View style={styles.clientAvatarCircle}>
                <Text style={styles.clientAvatarText}>
                  {(selectedClient.name || 'C').charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.selectedClientName}>{selectedClient.name}</Text>
                <Text style={styles.selectedClientPhone}>{selectedClient.phone}</Text>
              </View>

              <View style={styles.clientActionButtons}>
                <TouchableOpacity
                  onPress={() => {
                    setClientSearchQuery('');
                    setIsClientPickerOpen(true);
                  }}
                  style={styles.changeClientBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.changeClientText}>Change</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setClientId('')}
                  style={styles.removeClientBtn}
                  activeOpacity={0.7}
                >
                  <X size={14} color="#737373" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Search Trigger Input */
            <TouchableOpacity
              onPress={() => {
                setClientSearchQuery('');
                setIsClientPickerOpen(true);
              }}
              style={styles.searchClientTrigger}
              activeOpacity={0.8}
            >
              <Search size={16} color="#737373" style={{ marginRight: 8 }} />
              <Text style={styles.searchClientPlaceholder}>
                Type client name or phone (+237)...
              </Text>
              <ChevronDown size={16} color="#737373" />
            </TouchableOpacity>
          )}

          {/* Deposit Warning Banner */}
          {selectedClient && (selectedClient.noShows || 0) >= 2 && (
            <View style={styles.depositWarningBanner}>
              <TriangleAlert size={16} color="#D97706" style={{ marginTop: 2, marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.warningTitle}>
                  Client No-Shows: {selectedClient.noShows}
                </Text>
                <Text style={styles.warningSub}>
                  Deposit required for next appointment booking.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ===================================================================== */}
        {/* 2. MULTI-SERVICE SELECTION                                            */}
        {/* ===================================================================== */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>
              Booked Services ({selectedServices.length})
            </Text>
            <Text style={styles.multiServiceHint}>Multi-Service allowed</Text>
          </View>

          {/* Selected Services Chips */}
          {selectedServices.length > 0 && (
            <View style={styles.selectedServicesContainer}>
              {selectedServices.map((srv, idx) => (
                <View key={`${srv.id}-${idx}`} style={styles.serviceChip}>
                  <Text style={styles.serviceChipName}>{srv.name}</Text>
                  <Text style={styles.serviceChipPrice}>({srv.price} FCFA)</Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveService(idx)}
                    style={styles.removeServiceChipBtn}
                  >
                    <X size={12} color="#737373" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Add Service Selector Trigger */}
          <TouchableOpacity
            onPress={() => {
              setServiceSearchQuery('');
              setSelectedCategory('ALL');
              setIsServicePickerOpen(true);
              refreshServices().catch(() => {});
            }}
            style={styles.addServiceTriggerBtn}
            activeOpacity={0.8}
          >
            <View style={styles.addServicePlusCircle}>
              <Plus size={13} color="#4F6748" />
            </View>
            <Text style={styles.addServiceTriggerText}>
              {selectedServices.length === 0
                ? '+ Select Service for this Visit...'
                : '+ Add Another Service to Visit...'}
            </Text>
            <ChevronDown size={15} color="#4F6748" />
          </TouchableOpacity>
        </View>

        {/* ===================================================================== */}
        {/* 3. MAIN ASSIGNED TECHNICIAN                                           */}
        {/* ===================================================================== */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>
            Main Technician
            <Text style={{ fontSize: 11, fontWeight: '400', color: '#4F6748' }}>
              {' '}— Primary assigned technician for visit
            </Text>
          </Text>

          <TouchableOpacity
            disabled={isTechnician}
            onPress={() => setIsTechPickerOpen(true)}
            style={[
              styles.techSelectTrigger,
              isTechnician && { backgroundColor: '#F6F1EB' },
            ]}
            activeOpacity={0.8}
          >
            <View style={styles.techIconCircle}>
              <Sparkles size={14} color="#4F6748" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.techSelectName}>
                {selectedTech
                  ? selectedTech.name
                  : 'Select Main Technician...'}
              </Text>
              {selectedTech && (
                <Text style={styles.techSelectSpecs}>
                  {(selectedTech.specialties || []).join(', ') || 'Technician'}
                </Text>
              )}
            </View>
            {!isTechnician && <ChevronDown size={16} color="#737373" />}
          </TouchableOpacity>

          {/* Technician Schedule Conflict Alert */}
          {conflictingAppointment && (
            <View style={styles.conflictAlertBanner}>
              <TriangleAlert size={16} color="#DC2626" style={{ marginTop: 2, marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.conflictTitle}>Technician Schedule Conflict</Text>
                <Text style={styles.conflictSub}>
                  {selectedTech?.name} is already booked at {conflictingAppointment.time} for{' '}
                  {conflictingAppointment.clientName}. Please choose another slot or staff member.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ===================================================================== */}
        {/* 4. DATE + TIME (Exact 1-to-1 Match with Web Software)                */}
        {/* ===================================================================== */}
        <View style={styles.sectionCard}>
          {/* Date Picker Trigger Box */}
          <View style={{ marginBottom: 14 }}>
            <Text style={styles.sectionLabel}>Date</Text>
            <TouchableOpacity
              onPress={() => {
                if (date) {
                  const [y, m, d] = date.split('-').map(Number);
                  setCalendarMonth(new Date(y, (m || 1) - 1, d || 1));
                }
                setIsDatePickerOpen(true);
              }}
              style={styles.webStylePickerBox}
              activeOpacity={0.8}
            >
              <Text style={styles.webStylePickerValueText}>
                {formatDisplayDate(date)}
              </Text>
              <Calendar size={17} color="#2D2D2A" />
            </TouchableOpacity>
          </View>

          {/* Time Picker Trigger Box */}
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>
                Time <Text style={{ fontSize: 11, fontWeight: '400', color: '#737373' }}>(09:00 AM – 09:00 PM)</Text>
              </Text>
              {time && totalDurationMinutes > 0 && (
                <Text style={styles.timeDurationBadgeText}>
                  · {totalDurationMinutes} min (until {newEndTime})
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => setIsTimePickerOpen(true)}
              style={styles.webStylePickerBox}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.webStylePickerValueText,
                  !time && { color: '#737373', fontWeight: '400' },
                ]}
              >
                {selectedTimeSlot ? selectedTimeSlot.label : 'Select Time (09:00 AM – 09:00 PM)'}
              </Text>
              <ChevronDown size={17} color="#737373" />
            </TouchableOpacity>
          </View>

          {/* Duration Summary */}
          {totalDurationMinutes > 0 && (
            <View style={styles.durationSummaryRow}>
              <Clock size={12} color="#4F6748" />
              <Text style={styles.durationSummaryText}>
                Duration: {totalDurationMinutes} mins · Treatment completes around {newEndTime}
              </Text>
            </View>
          )}
        </View>

        {/* ===================================================================== */}
        {/* 5. PROSPECTING WELCOME PROMO DISCOUNT                                 */}
        {/* ===================================================================== */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>
              <Award size={14} color="#8B6E58" style={{ marginRight: 4 }} />
              Prospecting Welcome Promo
            </Text>
            <Text style={styles.multiServiceHint}>For first-time prospects</Text>
          </View>

          <View style={styles.promoButtonsRow}>
            {[0, 5, 10, 15, 20].map((rate) => {
              const isSelected = promoPercent === rate;
              return (
                <TouchableOpacity
                  key={rate}
                  onPress={() => setPromoPercent(rate)}
                  style={[styles.promoChip, isSelected && styles.promoChipActive]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.promoChipText,
                      isSelected && styles.promoChipTextActive,
                    ]}
                  >
                    {rate === 0 ? 'No Promo' : `${rate}% OFF`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ===================================================================== */}
        {/* 6. VISIT NOTES                                                        */}
        {/* ===================================================================== */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Visit Notes (optional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Special requests, allergy warnings, customer preferences..."
            placeholderTextColor="#737373"
            multiline
            numberOfLines={2}
            style={styles.notesTextInput}
          />
        </View>

        {/* ===================================================================== */}
        {/* SUMMARY & SUBMIT BUTTON                                               */}
        {/* ===================================================================== */}
        <View style={styles.submitSection}>
          <View style={styles.totalPriceRow}>
            <View>
              <Text style={styles.totalPriceLabel}>Total Treatment Cost</Text>
              {promoPercent > 0 && (
                <Text style={styles.promoDeductionText}>
                  Includes {promoPercent}% welcome discount (-{formatFCFA(discountAmount)})
                </Text>
              )}
            </View>
            <Text style={styles.totalPriceValue}>{formatFCFA(finalPrice)}</Text>
          </View>

          <TouchableOpacity
            onPress={handleBook}
            style={[styles.bookBtn, isSubmitting && styles.bookBtnDisabled]}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.bookBtnText}>Book Appointment</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ===================================================================== */}
      {/* CLIENT PICKER MODAL (Instant Searchable)                              */}
      {/* ===================================================================== */}
      <Modal
        visible={isClientPickerOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsClientPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.pickerModalContainer}>
            <View style={styles.pickerHeader}>
              <View>
                <Text style={styles.pickerTitle}>Select Client</Text>
                <Text style={styles.pickerSubCount}>
                  {clientSearchQuery.trim()
                    ? `${filteredClients.length} of ${clients.length} clients`
                    : `${clients.length} clients available`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsClientPickerOpen(false)}>
                <X size={18} color="#2D2D2A" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchBox}>
              <Search size={15} color="#737373" style={{ marginRight: 8 }} />
              <TextInput
                value={clientSearchQuery}
                onChangeText={setClientSearchQuery}
                placeholder="Type name or phone (+237)..."
                placeholderTextColor="#737373"
                autoFocus={true}
                style={styles.modalSearchInput}
              />
              {clientSearchQuery ? (
                <TouchableOpacity onPress={() => setClientSearchQuery('')}>
                  <X size={14} color="#737373" />
                </TouchableOpacity>
              ) : null}
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {filteredClients.length === 0 ? (
                <View style={styles.emptyList}>
                  <Text style={styles.emptyListText}>
                    {isSearchingServer
                      ? 'Searching Omega Spa database...'
                      : `No clients found matching "${clientSearchQuery}".`}
                  </Text>
                  {onNavigateAddClient && (
                    <TouchableOpacity
                      onPress={() => {
                        setIsClientPickerOpen(false);
                        onNavigateAddClient();
                      }}
                      style={styles.addClientFromEmptyBtn}
                    >
                      <Plus size={14} color="#4F6748" />
                      <Text style={styles.addClientFromEmptyText}>+ Register New Client</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                filteredClients.map((c) => {
                  const isSelected = clientId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => {
                        setClientId(c.id);
                        setIsClientPickerOpen(false);
                      }}
                      style={[styles.pickerItemRow, isSelected && styles.pickerItemActive]}
                    >
                      <View style={styles.clientAvatarMini}>
                        <Text style={styles.clientAvatarMiniText}>
                          {(c.name || 'C').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.pickerItemName}>{c.name}</Text>
                        <Text style={styles.pickerItemSub}>{c.phone || 'No phone'}</Text>
                      </View>
                      {isSelected ? (
                        <Check size={16} color="#4F6748" />
                      ) : (
                        <Text style={styles.selectTextPill}>Select</Text>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ===================================================================== */}
      {/* SERVICES PICKER MODAL (All 66 Treatments with Categories)             */}
      {/* ===================================================================== */}
      <Modal
        visible={isServicePickerOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsServicePickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.pickerModalContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Add Treatment to Visit</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => refreshServices().catch(() => {})}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <RefreshCw size={16} color="#4F6748" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsServicePickerOpen(false)}>
                  <X size={18} color="#2D2D2A" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Category Filter Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalCategoryTabs}>
              {serviceCategories.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setSelectedCategory(cat)}
                    style={[styles.modalCatChip, isSelected && styles.modalCatChipActive]}
                  >
                    <Text
                      style={[
                        styles.modalCatChipText,
                        isSelected && styles.modalCatChipTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Search Input */}
            <View style={styles.modalSearchBox}>
              <Search size={15} color="#737373" style={{ marginRight: 8 }} />
              <TextInput
                value={serviceSearchQuery}
                onChangeText={setServiceSearchQuery}
                placeholder="Search treatment name..."
                placeholderTextColor="#737373"
                style={styles.modalSearchInput}
              />
            </View>

            {/* Services List */}
            <ScrollView style={{ maxHeight: 360 }}>
              {filteredServices.map((srv) => (
                <TouchableOpacity
                  key={srv.id}
                  onPress={() => handleAddService(srv)}
                  style={styles.serviceOptionRow}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.serviceOptionName}>{srv.name}</Text>
                    <Text style={styles.serviceOptionMeta}>
                      {srv.category} · {srv.duration}
                    </Text>
                  </View>
                  <Text style={styles.serviceOptionPrice}>{srv.price} FCFA</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ===================================================================== */}
      {/* TECHNICIAN PICKER MODAL                                               */}
      {/* ===================================================================== */}
      <Modal
        visible={isTechPickerOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsTechPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.pickerModalContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Assign Main Technician</Text>
              <TouchableOpacity onPress={() => setIsTechPickerOpen(false)}>
                <X size={18} color="#2D2D2A" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360 }}>
              {technicians.map((t) => {
                const isSelected = selectedTechId === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => {
                      setSelectedTechId(t.id);
                      setIsTechPickerOpen(false);
                    }}
                    style={[styles.pickerItemRow, isSelected && styles.pickerItemActive]}
                  >
                    <View style={styles.clientAvatarMini}>
                      <Text style={styles.clientAvatarMiniText}>
                        {(t.name || 'T').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerItemName}>{t.name}</Text>
                      <Text style={styles.pickerItemSub}>
                        {(t.specialties || []).join(', ') || 'Technician'}
                      </Text>
                    </View>
                    {isSelected && <Check size={16} color="#4F6748" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ===================================================================== */}
      {/* DATE PICKER MODAL (Interactive Calendar Dialog)                       */}
      {/* ===================================================================== */}
      <Modal
        visible={isDatePickerOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsDatePickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsDatePickerOpen(false)}
        >
          <View style={styles.calendarModalContainer} onStartShouldSetResponder={() => true}>
            {/* Header: Prev Month, Title, Next Month, Close */}
            <View style={styles.calendarHeaderRow}>
              <TouchableOpacity onPress={handlePrevMonth} style={styles.calendarNavBtn}>
                <ChevronLeft size={18} color="#2D2D2A" />
              </TouchableOpacity>
              <Text style={styles.calendarMonthTitle}>
                {currentMonthName} {currentYear}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity onPress={handleNextMonth} style={styles.calendarNavBtn}>
                  <ChevronRight size={18} color="#2D2D2A" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsDatePickerOpen(false)} style={styles.calendarCloseBtn}>
                  <X size={16} color="#737373" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Weekday Labels (Mo Tu We Th Fr Sa Su) */}
            <View style={styles.calendarWeekRow}>
              {DAY_LABELS.map((dName) => (
                <Text key={dName} style={styles.calendarWeekDayText}>
                  {dName}
                </Text>
              ))}
            </View>

            {/* Calendar Days Grid */}
            <View style={styles.calendarDaysGrid}>
              {calendarDays.map((day, idx) => {
                if (day === null) {
                  return <View key={`empty-${idx}`} style={styles.calendarDayCellEmpty} />;
                }
                const selected = isSelectedDate(day);
                const today = isTodayDate(day);
                return (
                  <TouchableOpacity
                    key={`day-${day}`}
                    onPress={() => handleSelectDay(day)}
                    style={[
                      styles.calendarDayCell,
                      today && styles.calendarDayCellToday,
                      selected && styles.calendarDayCellSelected,
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        today && styles.calendarDayTextToday,
                        selected && styles.calendarDayTextSelected,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Quick Date Shortcuts */}
            <View style={styles.calendarShortcutsRow}>
              <TouchableOpacity
                onPress={() => handleQuickDate(0)}
                style={styles.calendarShortcutBtn}
              >
                <Text style={styles.calendarShortcutText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleQuickDate(1)}
                style={styles.calendarShortcutBtn}
              >
                <Text style={styles.calendarShortcutText}>Tomorrow</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleQuickDate(7)}
                style={styles.calendarShortcutBtn}
              >
                <Text style={styles.calendarShortcutText}>+1 Week</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ===================================================================== */}
      {/* TIME PICKER MODAL (Dropdown Match with Web Software)                  */}
      {/* ===================================================================== */}
      <Modal
        visible={isTimePickerOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsTimePickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsTimePickerOpen(false)}
        >
          <View style={styles.timePickerModalContainer} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHeader}>
              <View>
                <Text style={styles.pickerTitle}>Select Appointment Time</Text>
                <Text style={styles.pickerSubtitle}>09:00 AM to 09:00 PM (30 min intervals)</Text>
              </View>
              <TouchableOpacity onPress={() => setIsTimePickerOpen(false)}>
                <X size={18} color="#2D2D2A" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={true}>
              <View style={styles.timeSlotsGrid}>
                {BOOKING_TIME_SLOTS.map((slot) => {
                  const isSelected = time === slot.value;
                  return (
                    <TouchableOpacity
                      key={slot.value}
                      onPress={() => {
                        setTime(slot.value);
                        setIsTimePickerOpen(false);
                      }}
                      style={[
                        styles.timeSlotModalItem,
                        isSelected && styles.timeSlotModalItemActive,
                      ]}
                      activeOpacity={0.7}
                    >
                      <Clock
                        size={14}
                        color={isSelected ? '#FFFFFF' : '#4F6748'}
                        style={{ marginRight: 8 }}
                      />
                      <Text
                        style={[
                          styles.timeSlotModalText,
                          isSelected && styles.timeSlotModalTextActive,
                        ]}
                      >
                        {slot.label}
                      </Text>
                      {isSelected && (
                        <Check size={16} color="#FFFFFF" style={{ marginLeft: 'auto' }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F6F1EB', // Soft cream
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D9',
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2D2D2A',
  },
  topBarSub: {
    fontSize: 11,
    color: '#737373',
  },
  formScroll: {
    flex: 1,
  },
  formContent: {
    padding: 12,
    gap: 12,
    paddingBottom: 36,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    padding: 14,
    ...THEME.shadows.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  multiServiceHint: {
    fontSize: 11,
    color: '#737373',
  },
  newClientLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  newClientLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F6748',
  },
  searchClientTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchClientPlaceholder: {
    flex: 1,
    fontSize: 13,
    color: '#737373',
  },
  selectedClientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F7F0',
    borderWidth: 1,
    borderColor: '#CFDEC9',
    borderRadius: 12,
    padding: 10,
  },
  clientAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCE7D7',
    borderWidth: 1,
    borderColor: '#A7B89A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  clientAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4F6748',
  },
  selectedClientName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  selectedClientPhone: {
    fontSize: 11,
    color: '#737373',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  clientActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  changeClientBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  changeClientText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  removeClientBtn: {
    padding: 4,
  },
  depositWarningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFDF5',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  warningTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  warningSub: {
    fontSize: 11,
    color: '#92400E',
    marginTop: 2,
  },
  selectedServicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
    padding: 8,
    backgroundColor: '#FAF8F5',
    borderRadius: 10,
  },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
  },
  serviceChipName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  serviceChipPrice: {
    fontSize: 11,
    color: '#737373',
  },
  removeServiceChipBtn: {
    padding: 2,
  },
  addServiceTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#8B9E82',
    borderStyle: 'dashed',
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 12,
  },
  addServicePlusCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#DCE7D7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  addServiceTriggerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#4F6748',
  },
  techSelectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 6,
  },
  techIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F2F7F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  techSelectName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  techSelectSpecs: {
    fontSize: 11,
    color: '#737373',
    marginTop: 1,
  },
  conflictAlertBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  conflictTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
  },
  conflictSub: {
    fontSize: 11,
    color: '#991B1B',
    marginTop: 2,
  },
  webStylePickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 11,
    paddingHorizontal: 14,
    marginTop: 6,
  },
  webStylePickerValueText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2D2D2A',
  },
  timeDurationBadgeText: {
    fontSize: 11,
    color: '#4F6748',
    fontWeight: '500',
  },
  calendarModalContainer: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    ...THEME.shadows.md,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calendarNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F6F1EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F6F1EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F4EFEA',
    paddingBottom: 6,
  },
  calendarWeekDayText: {
    width: 38,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#737373',
  },
  calendarDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  calendarDayCell: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    borderRadius: 19,
  },
  calendarDayCellEmpty: {
    width: 38,
    height: 38,
    marginVertical: 2,
  },
  calendarDayCellSelected: {
    backgroundColor: '#4F6748',
  },
  calendarDayCellToday: {
    borderWidth: 1.5,
    borderColor: '#4F6748',
  },
  calendarDayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  calendarDayTextToday: {
    color: '#4F6748',
    fontWeight: '700',
  },
  calendarShortcutsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F4EFEA',
    gap: 8,
  },
  calendarShortcutBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F6F1EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  calendarShortcutText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F6748',
  },
  timePickerModalContainer: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    ...THEME.shadows.md,
  },
  pickerSubtitle: {
    fontSize: 11,
    color: '#737373',
    marginTop: 2,
  },
  timeSlotsGrid: {
    gap: 6,
    paddingVertical: 6,
  },
  timeSlotModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  timeSlotModalItemActive: {
    backgroundColor: '#4F6748',
    borderColor: '#4F6748',
  },
  timeSlotModalText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  timeSlotModalTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  durationSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F4EFEA',
  },
  durationSummaryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4F6748',
  },
  promoButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  promoChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  promoChipActive: {
    backgroundColor: '#8B6E58',
    borderColor: '#8B6E58',
  },
  promoChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  promoChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  notesTextInput: {
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 9,
    padding: 10,
    fontSize: 12,
    color: '#2D2D2A',
    height: 54,
    textAlignVertical: 'top',
    marginTop: 6,
  },
  submitSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    padding: 14,
    gap: 12,
    ...THEME.shadows.md,
  },
  totalPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  totalPriceLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  promoDeductionText: {
    fontSize: 11,
    color: '#8B6E58',
    marginTop: 2,
  },
  totalPriceValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#4F6748',
  },
  bookBtn: {
    backgroundColor: '#4F6748',
    height: 46,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    ...THEME.shadows.sm,
  },
  bookBtnDisabled: {
    opacity: 0.6,
  },
  bookBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '85%',
    ...THEME.shadows.modal,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2D2D2A',
  },
  pickerSubCount: {
    fontSize: 11,
    color: '#737373',
    marginTop: 2,
  },
  selectTextPill: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F6748',
  },
  addClientFromEmptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  addClientFromEmptyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F6748',
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F1EB',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    marginBottom: 12,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#2D2D2A',
    paddingVertical: 0,
  },
  emptyList: {
    padding: 24,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: 13,
    color: '#737373',
  },
  pickerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F4EFEA',
    gap: 10,
  },
  pickerItemActive: {
    backgroundColor: '#F2F7F0',
  },
  clientAvatarMini: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DCE7D7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarMiniText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F6748',
  },
  pickerItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  pickerItemSub: {
    fontSize: 11,
    color: '#737373',
    marginTop: 1,
  },
  modalCategoryTabs: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  modalCatChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F6F1EB',
    marginRight: 6,
  },
  modalCatChipActive: {
    backgroundColor: '#8B9E82',
  },
  modalCatChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#737373',
  },
  modalCatChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  serviceOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F4EFEA',
  },
  serviceOptionName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  serviceOptionMeta: {
    fontSize: 11,
    color: '#737373',
    marginTop: 2,
  },
  serviceOptionPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4F6748',
  },
});

export default CreateAppointmentScreen;
