/**
 * ClientFileScreen — 1-to-1 Pixel & Structural Match with Omega Spa POS Web Software
 * Matches frontend/src/pages/ClientFile.jsx:
 * - Header: Back button + "Client File"
 * - Main Client Identity Card:
 *     - Client Name + Active / Inactive Badge
 *     - "Mark as Inactive" / "Restore Active" button
 *     - "Edit Details" button
 *     - Contact & Bio Details: Phone, Quartier, Birthday (e.g. 26 May), Anniversary
 *     - REFERRAL INFORMATION Nested Card: CLIENT, INTRODUCED BY (green font), SOURCE (Staff Referral badge)
 * - No-Show Warning Banner (if >= 2 no-shows)
 * - 4 Standard Tabs:
 *     1. Service History (Services & Appointments list with Status, Date, Tech, Price)
 *     2. Before / After (Photo session cards with Before & After upload slots)
 *     3. Loyalty Points (3 metric cards: Balance, Lifetime Earned, Redeemed + History list)
 *     4. Feedback (Client reviews & star ratings)
 * - Confirmation Modals: Mark Inactive, Restore Active, Edit Details, New Photo Session, Camera
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Image,
  Platform,
} from 'react-native';
import {
  ArrowLeft,
  Phone,
  MapPin,
  Cake,
  Heart,
  UserPlus,
  TriangleAlert,
  Plus,
  X,
  Award,
  Sparkles,
  Check,
  Pencil,
  Star,
  UserX,
  RotateCcw,
  FileText,
  Camera,
  Clock,
  SlidersHorizontal,
  ImagePlus,
} from 'lucide-react-native';
import THEME from '../constants/theme';
import CameraModal from '../components/CameraModal';
import { useClients, Client } from '../context/ClientsContext';
import { useAppointments } from '../context/AppointmentsContext';
import { useAuth } from '../context/AuthContext';
import { loyaltyApi, feedbackApi } from '../services/api';
import { DEFAULT_FEEDBACK_REVIEWS } from './ClientFeedbackScreen';
import { formatFCFA } from '../utils/currency';
import { formatDate } from '../utils/date';
import { createFormDataFile } from '../utils/fileUpload';

const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatCelebrationDisplay(dateVal?: string | null): string {
  if (!dateVal || dateVal === '-' || dateVal === '—') return '—';
  const str = String(dateVal).trim().split('T')[0];
  const parts = str.split(/[-/.]/);

  let day = '';
  let month = '';
  let year = '';

  if (parts.length === 3) {
    if (parts[0].length === 4) {
      year = parts[0] === '2000' ? '' : parts[0];
      month = String(parseInt(parts[1], 10)).padStart(2, '0');
      day = String(parseInt(parts[2], 10)).padStart(2, '0');
    } else if (parts[2].length === 4) {
      day = String(parseInt(parts[0], 10)).padStart(2, '0');
      month = String(parseInt(parts[1], 10)).padStart(2, '0');
      year = parts[2] === '2000' ? '' : parts[2];
    }
  } else if (parts.length === 2) {
    const n1 = parseInt(parts[0], 10);
    const n2 = parseInt(parts[1], 10);
    if (n1 > 12) {
      day = String(n1).padStart(2, '0');
      month = String(n2).padStart(2, '0');
    } else {
      month = String(n1).padStart(2, '0');
      day = String(n2).padStart(2, '0');
    }
  }

  const mNum = parseInt(month, 10);
  const dNum = parseInt(day, 10);
  if (isNaN(mNum) || isNaN(dNum) || mNum < 1 || mNum > 12) return '—';

  const monthName = MONTH_NAMES_FULL[mNum - 1];
  if (year && year !== '2000') {
    return `${dNum} ${monthName} ${year}`;
  }
  return `${dNum} ${monthName}`;
}

function getStatusBadge(status: string) {
  const s = (status || '').toLowerCase();
  if (s === 'completed') {
    return {
      bg: '#EBF5EE',
      border: '#C3E6D0',
      text: '#2D7A4D',
      label: 'Completed',
    };
  }
  if (s === 'cancelled') {
    return {
      bg: '#FAECEC',
      border: '#ECCACA',
      text: '#B34040',
      label: 'Cancelled',
    };
  }
  if (s === 'late') {
    return {
      bg: '#FFF4E5',
      border: '#FFE2B8',
      text: '#B76E00',
      label: 'Late',
    };
  }
  if (s === 'no-show' || s === 'no_show') {
    return {
      bg: '#FAECEC',
      border: '#ECCACA',
      text: '#B34040',
      label: 'No Show',
    };
  }
  return {
    bg: '#EBF2EA',
    border: 'rgba(79,103,72,0.3)',
    text: '#4F6748',
    label: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Scheduled',
  };
}

const TABS = [
  { key: 'history', label: 'Service History' },
  { key: 'photos', label: 'Before / After' },
  { key: 'loyalty', label: 'Loyalty Points' },
  { key: 'feedback', label: 'Feedback' },
];

interface ClientFileScreenProps {
  clientId: string;
  onBack?: () => void;
  onBookAppointment?: (client: Client) => void;
}

export const ClientFileScreen: React.FC<ClientFileScreenProps> = ({
  clientId,
  onBack,
}) => {
  const { fetchClientFull, updateClient, setClientStatus, addClientMedia, getClient } = useClients();
  const { appointments: allAppointments } = useAppointments();
  const { user } = useAuth();
  const canEdit = user?.role === 'manager' || user?.role === 'reception';

  const [client, setClient] = useState<Client | null>(() => getClient(clientId) || null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('history');

  // Modals
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState<boolean>(false);
  const [showActivateModal, setShowActivateModal] = useState<boolean>(false);
  const [showAddSessionModal, setShowAddSessionModal] = useState<boolean>(false);
  const [newSessionService, setNewSessionService] = useState<string>('Gel Nails');

  // Camera / Upload
  const [cameraVisible, setCameraVisible] = useState<boolean>(false);
  const [activePhotoTarget, setActivePhotoTarget] = useState<{ sessionId: string; slot: 'before' | 'after' } | null>(null);

  // Edit Form State
  const [editName, setEditName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editQuartier, setEditQuartier] = useState<string>('');
  const [editBirthday, setEditBirthday] = useState<string>('');
  const [editAnniversary, setEditAnniversary] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Loyalty Live Data
  const [liveLoyalty, setLiveLoyalty] = useState<any>(null);
  // Feedback Live Data
  const [clientFeedbacks, setClientFeedbacks] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const full = await fetchClientFull(clientId);
      if (full) {
        setClient(full);
      }
    } catch (e) {
      console.warn('Failed to fetch client profile', e);
    } finally {
      setLoading(false);
    }
  }, [clientId, fetchClientFull]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fetch Loyalty & Feedback when respective tabs are opened
  useEffect(() => {
    if (activeTab === 'loyalty' && clientId) {
      loyaltyApi.getClientPoints(clientId)
        .then((res: any) => {
          if (res?.data) setLiveLoyalty(res.data);
        })
        .catch(() => {});
    }
    if (activeTab === 'feedback' && clientId) {
      feedbackApi.getAll({ clientId })
        .then((res: any) => {
          const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
          const defMatches = DEFAULT_FEEDBACK_REVIEWS.filter(f => f.clientId === clientId);
          const map = new Map(list.map((f: any) => [f.id, f]));
          defMatches.forEach(f => {
            if (!map.has(f.id)) map.set(f.id, f);
          });
          setClientFeedbacks(Array.from(map.values()));
        })
        .catch(() => {
          const defMatches = DEFAULT_FEEDBACK_REVIEWS.filter(f => f.clientId === clientId);
          setClientFeedbacks(defMatches);
        });
    }
  }, [activeTab, clientId]);

  // Edit Handlers
  const handleStartEdit = () => {
    if (!client) return;
    setEditName(client.name || '');
    setEditPhone(client.phone || '');
    setEditQuartier(client.quartier || '');
    setEditBirthday(client.birthday || '');
    setEditAnniversary(client.anniversary || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!client || !editName.trim()) {
      Alert.alert('Required', 'Please enter client name.');
      return;
    }
    setSavingEdit(true);
    try {
      await updateClient(client.id, {
        name: editName.trim(),
        phone: editPhone.trim(),
        whatsapp: editPhone.trim(),
        quartier: editQuartier.trim(),
        birthday: editBirthday.trim(),
        anniversary: editAnniversary.trim(),
      });
      setShowEditModal(false);
      await loadData();
      Alert.alert('Success', 'Client details updated successfully.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update client details.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Status Handlers
  const handleConfirmDeactivate = async () => {
    if (!client) return;
    try {
      await setClientStatus(client.id, 'INACTIVE');
      setShowDeactivateModal(false);
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to deactivate client.');
    }
  };

  const handleConfirmActivate = async () => {
    if (!client) return;
    try {
      await setClientStatus(client.id, 'ACTIVE');
      setShowActivateModal(false);
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to restore active status.');
    }
  };

  // Merged Service History calculation
  const liveClientAppointments = useMemo(() => {
    if (!client) return [];
    return (allAppointments || []).filter(
      (a) =>
        (a.clientId && String(a.clientId) === String(client.id)) ||
        (client.phone && String(a.clientPhone || (a as any).phone) === String(client.phone))
    );
  }, [allAppointments, client]);

  const liveRows = useMemo(() => {
    return liveClientAppointments.map((a) => {
      const totalPrice =
        a.services?.reduce((sum: number, s: any) => sum + (Number(s.price) || 0), 0) ||
        a.totalPrice ||
        0;
      const statusLower = String(a.status || 'scheduled').toLowerCase().replace(/_/g, '-');
      const serviceName =
        a.services?.map((s: any) => s.serviceName || s.name).join(', ') || 'Spa Service';
      return {
        id: `appt-${a.id}`,
        appointmentId: a.id,
        date: a.date,
        time: a.time,
        service: serviceName,
        technician: a.mainTechnicianName || 'Technician',
        product: statusLower === 'cancelled' ? 'Cancelled' : 'Spa Service',
        price: totalPrice > 0 ? totalPrice.toLocaleString('en-US') : '—',
        status: statusLower,
        rawStatus: a.status || 'SCHEDULED',
        notes: a.notes || '',
      };
    });
  }, [liveClientAppointments]);

  const mergedHistory = useMemo(() => {
    const seenKeys = new Set();
    const list: any[] = [];
    for (const row of liveRows) {
      seenKeys.add(String(row.appointmentId));
      seenKeys.add(String(row.id));
      list.push(row);
    }
    for (const row of (client?.serviceHistory || [])) {
      const key = String(row.appointmentId || row.id);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        list.push(row);
      }
    }
    return list;
  }, [liveRows, client?.serviceHistory]);

  // Photo Session Handlers
  const handleAddNewSession = () => {
    if (!client) return;
    const today = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const newEntry = {
      id: 'session-' + Date.now(),
      service: (newSessionService || 'Gel Nails').trim(),
      date: today,
      before: null,
      after: null,
    };
    const updated = [newEntry, ...(client.photos || [])];
    updateClient(client.id, { photos: updated } as any);
    setClient({ ...client, photos: updated });
    setShowAddSessionModal(false);
  };

  const handleOpenPhotoCapture = (sessionId: string, slot: 'before' | 'after') => {
    setActivePhotoTarget({ sessionId, slot });
    setCameraVisible(true);
  };

  const handlePhotoCaptured = async (uri: string) => {
    if (!client || !activePhotoTarget) return;
    const { sessionId, slot } = activePhotoTarget;
    const updatedPhotos = (client.photos || []).map((p: any) => {
      if (p.id === sessionId) {
        return {
          ...p,
          [slot]: uri,
        };
      }
      return p;
    });

    setClient({ ...client, photos: updatedPhotos });
    await updateClient(client.id, { photos: updatedPhotos } as any);

    // Upload to backend media API
    try {
      const formData = new FormData();
      const fileObj = await createFormDataFile(uri, `client_${client.id}_${slot}_${Date.now()}.jpg`, 'image/jpeg');
      if (fileObj) {
        formData.append('photo', fileObj);
      }
      if (typeof uri === 'string' && uri.startsWith('data:')) {
        formData.append('base64Photo', uri);
      }
      await addClientMedia(client.id, formData);
    } catch (err) {
      console.warn('Backend media sync note:', err);
    }
  };

  if (loading && !client) {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.webBackBtn}>
              <ArrowLeft size={16} color="#2D2D2A" />
              <Text style={styles.webBackBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.webPageTitle}>Client File</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F6748" />
          <Text style={styles.loadingText}>Loading client details...</Text>
        </View>
      </View>
    );
  }

  if (!client) {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.webBackBtn}>
              <ArrowLeft size={16} color="#2D2D2A" />
              <Text style={styles.webBackBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.webPageTitle}>Client File</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Client not found.</Text>
        </View>
      </View>
    );
  }

  const isInactive = client.status === 'INACTIVE' || client.isActive === false;

  return (
    <View style={styles.container}>
      {/* ── Header: Back button + "Client File" (Exact match with web) ── */}
      <View style={styles.topBar}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.webBackBtn} activeOpacity={0.8}>
            <ArrowLeft size={16} color="#2D2D2A" />
            <Text style={styles.webBackBtnText}>Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.webPageTitle}>Client File</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ===================================================================== */}
        {/* 1. MAIN CLIENT IDENTITY CARD                                         */}
        {/* ===================================================================== */}
        <View style={styles.identityCard}>
          {/* Line 1: Name + Status Badge */}
          <View style={styles.identityHeaderRow}>
            <Text style={styles.clientName}>{client.name}</Text>
            {isInactive ? (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveBadgeText}>Inactive</Text>
              </View>
            ) : (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>Active</Text>
              </View>
            )}
          </View>

          {/* Line 2: Actions Row (Mark as Inactive / Restore Active + Edit Details) */}
          {canEdit && (
            <View style={styles.actionsRow}>
              {isInactive ? (
                <TouchableOpacity
                  onPress={() => setShowActivateModal(true)}
                  style={styles.restoreActiveBtn}
                  activeOpacity={0.7}
                >
                  <RotateCcw size={13} color="#2D2D2A" />
                  <Text style={styles.restoreActiveBtnText}>Restore Active</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setShowDeactivateModal(true)}
                  style={styles.markInactiveBtn}
                  activeOpacity={0.7}
                >
                  <UserX size={13} color="#737373" />
                  <Text style={styles.markInactiveBtnText}>Mark as Inactive</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={handleStartEdit}
                style={styles.editDetailsBtn}
                activeOpacity={0.7}
              >
                <Pencil size={13} color="#4F6748" />
                <Text style={styles.editDetailsBtnText}>Edit Details</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Line 3: Info Rows (Phone, Quartier, Birthday, Anniversary) */}
          <View style={styles.infoRows}>
            <View style={styles.infoRow}>
              <Phone size={15} color="#4F6748" style={{ marginRight: 8 }} />
              <Text style={styles.infoRowText}>{client.phone || 'No phone'}</Text>
            </View>

            {client.quartier ? (
              <View style={styles.infoRow}>
                <MapPin size={15} color="#4F6748" style={{ marginRight: 8 }} />
                <Text style={styles.infoRowText}>{client.quartier}</Text>
              </View>
            ) : null}

            <View style={styles.infoRow}>
              <Cake size={15} color="#4F6748" style={{ marginRight: 8 }} />
              <Text style={styles.infoRowText}>
                Birthday: <Text style={styles.infoRowValue}>{formatCelebrationDisplay(client.birthday)}</Text>
              </Text>
            </View>

            {client.anniversary ? (
              <View style={styles.infoRow}>
                <Heart size={15} color="#4F6748" style={{ marginRight: 8 }} />
                <Text style={styles.infoRowText}>
                  Anniversary: <Text style={styles.infoRowValue}>{formatCelebrationDisplay(client.anniversary)}</Text>
                </Text>
              </View>
            ) : null}
          </View>

          {/* Line 4: REFERRAL INFORMATION Nested Card (Exact Match with Web) */}
          {client.introducedBy ? (
            <View style={styles.referralCard}>
              <View style={styles.referralHeaderRow}>
                <UserPlus size={15} color="#4F6748" style={{ marginRight: 6 }} />
                <Text style={styles.referralHeaderTitle}>REFERRAL INFORMATION</Text>
              </View>

              <View style={styles.referralGrid}>
                <View style={styles.referralCol}>
                  <Text style={styles.referralLabel}>CLIENT</Text>
                  <Text style={styles.referralClientValue}>{client.name}</Text>
                </View>

                <View style={styles.referralCol}>
                  <Text style={styles.referralLabel}>INTRODUCED BY</Text>
                  <Text style={styles.referralIntroValue}>{client.introducedBy}</Text>
                </View>

                <View style={styles.referralCol}>
                  <Text style={styles.referralLabel}>SOURCE</Text>
                  <View style={styles.sourcePill}>
                    <Text style={styles.sourcePillText}>
                      {client.clientSource || 'Staff Referral'}
                    </Text>
                  </View>
                </View>
              </View>

              {client.firstAppointmentService && (
                <Text style={styles.referralFirstService}>
                  First Appointment Recommended:{' '}
                  <Text style={{ fontWeight: '700', color: '#2D2D2A' }}>
                    {client.firstAppointmentService}
                  </Text>
                </Text>
              )}
            </View>
          ) : null}
        </View>

        {/* ===================================================================== */}
        {/* 2. NO-SHOW / DEPOSIT WARNING BANNER                                   */}
        {/* ===================================================================== */}
        {(client.noShowCount || client.noShows || 0) >= 2 && (
          <View style={styles.depositBanner}>
            <TriangleAlert size={18} color="#D97706" style={{ marginTop: 2, marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.depositTitle}>
                No-Shows: {client.noShowCount || client.noShows}
              </Text>
              <Text style={styles.depositSub}>
                Deposit required for next appointment booking
              </Text>
            </View>
          </View>
        )}

        {/* ===================================================================== */}
        {/* 3. TABS BAR (Exact 4 Tabs: Service History, Photos, Loyalty, Feedback) */}
        {/* ===================================================================== */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScrollView}
          contentContainerStyle={styles.tabsContainer}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ===================================================================== */}
        {/* 4. TAB CONTENTS                                                       */}
        {/* ===================================================================== */}

        {/* ── TAB 1: SERVICE HISTORY ── */}
        {activeTab === 'history' && (
          <View style={styles.tabContentCard}>
            <View style={styles.tabCardHeader}>
              <Text style={styles.tabCardTitle}>Services & Appointments</Text>
              <Text style={styles.tabCardCount}>({mergedHistory.length} records)</Text>
            </View>

            {mergedHistory.length === 0 ? (
              <View style={styles.emptyTabBox}>
                <Text style={styles.emptyTabText}>No service history yet.</Text>
              </View>
            ) : (
              <View style={styles.historyList}>
                {mergedHistory.map((row) => {
                  const badge = getStatusBadge(row.status);
                  return (
                    <View key={row.id} style={styles.historyItemRow}>
                      <View style={styles.historyItemTop}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.historyServiceName}>{row.service}</Text>
                          <View style={styles.historyMetaRow}>
                            <Text style={styles.historyDateText}>
                              Date: {row.date} {row.time ? `(${row.time})` : ''}
                            </Text>
                            <Text style={styles.historyTechText}>
                              Tech: <Text style={{ color: '#2D2D2A', fontWeight: '600' }}>{row.technician}</Text>
                            </Text>
                          </View>
                          {row.product && (
                            <Text style={styles.historyProductText}>Product: {row.product}</Text>
                          )}
                          {row.notes ? (
                            <View style={styles.historyNotesBox}>
                              <FileText size={12} color="#4F6748" style={{ marginRight: 4, marginTop: 1 }} />
                              <Text style={styles.historyNotesText}>
                                <Text style={{ fontWeight: '700' }}>Note: </Text>
                                {row.notes}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <View style={{ alignItems: 'flex-end' }}>
                          <View
                            style={[
                              styles.historyStatusBadge,
                              { backgroundColor: badge.bg, borderColor: badge.border },
                            ]}
                          >
                            <Text style={[styles.historyStatusBadgeText, { color: badge.text }]}>
                              {badge.label}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.historyPriceText,
                              row.status === 'cancelled' && styles.historyPriceCancelled,
                            ]}
                          >
                            {row.price} FCFA
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ── TAB 2: BEFORE / AFTER PHOTOS ── */}
        {activeTab === 'photos' && (
          <View>
            <View style={styles.photoTabHeaderRow}>
              <TouchableOpacity
                onPress={() => setShowAddSessionModal(true)}
                style={styles.addPhotoSessionBtn}
                activeOpacity={0.8}
              >
                <Plus size={14} color="#2D2D2A" />
                <Text style={styles.addPhotoSessionBtnText}>Add Photo Session</Text>
              </TouchableOpacity>
            </View>

            {(!client.photos || client.photos.length === 0) ? (
              <View style={styles.tabContentCard}>
                <View style={styles.emptyTabBox}>
                  <Text style={styles.emptyTabText}>No before / after photos attached yet.</Text>
                  <TouchableOpacity
                    onPress={() => setShowAddSessionModal(true)}
                    style={[styles.editDetailsBtn, { marginTop: 12 }]}
                  >
                    <Plus size={14} color="#4F6748" />
                    <Text style={styles.editDetailsBtnText}>Attach First Photo</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              client.photos.map((session: any) => (
                <View key={session.id} style={[styles.tabContentCard, { marginBottom: 14 }]}>
                  <View style={styles.photoSessionHeader}>
                    <Text style={styles.photoSessionService}>{session.service}</Text>
                    <Text style={styles.photoSessionDate}>{session.date}</Text>
                  </View>

                  <View style={styles.photoSlotsRow}>
                    {/* Before Slot */}
                    <TouchableOpacity
                      onPress={() => handleOpenPhotoCapture(session.id, 'before')}
                      style={styles.photoSlotBox}
                      activeOpacity={0.8}
                    >
                      {session.before ? (
                        <Image source={{ uri: session.before }} style={styles.slotImage} />
                      ) : (
                        <View style={styles.emptySlotContent}>
                          <ImagePlus size={22} color="#737373" />
                          <Text style={styles.slotLabel}>Before Photo</Text>
                          <View style={styles.attachBtnPill}>
                            <Text style={styles.attachBtnPillText}>Attach Photo</Text>
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* After Slot */}
                    <TouchableOpacity
                      onPress={() => handleOpenPhotoCapture(session.id, 'after')}
                      style={styles.photoSlotBox}
                      activeOpacity={0.8}
                    >
                      {session.after ? (
                        <Image source={{ uri: session.after }} style={styles.slotImage} />
                      ) : (
                        <View style={styles.emptySlotContent}>
                          <ImagePlus size={22} color="#737373" />
                          <Text style={styles.slotLabel}>After Photo</Text>
                          <View style={styles.attachBtnPill}>
                            <Text style={styles.attachBtnPillText}>Attach Photo</Text>
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ── TAB 3: LOYALTY POINTS ── */}
        {activeTab === 'loyalty' && (
          <View>
            {/* 3 Metric Cards matching Web Software */}
            <View style={styles.loyaltyMetricsRow}>
              {/* Balance */}
              <View style={[styles.loyaltyMetricCard, styles.loyaltyBalanceCard]}>
                <View style={styles.loyaltyMetricHeader}>
                  <Text style={styles.loyaltyMetricTitle}>POINTS BALANCE</Text>
                  <Award size={15} color="#4F6748" />
                </View>
                <Text style={styles.loyaltyMetricValue}>
                  {liveLoyalty?.balance ?? client.loyaltyBalance ?? 0}
                </Text>
                <Text style={styles.loyaltyMetricSub}>pts available</Text>
              </View>

              {/* Total Earned */}
              <View style={styles.loyaltyMetricCard}>
                <View style={styles.loyaltyMetricHeader}>
                  <Text style={styles.loyaltyMetricTitle}>TOTAL EARNED</Text>
                  <Sparkles size={14} color="#737373" />
                </View>
                <Text style={styles.loyaltyMetricValue}>
                  {liveLoyalty?.totalEarned ?? client.loyaltyBalance ?? 0}
                </Text>
                <Text style={styles.loyaltyMetricSub}>pts lifetime</Text>
              </View>

              {/* Total Redeemed */}
              <View style={styles.loyaltyMetricCard}>
                <View style={styles.loyaltyMetricHeader}>
                  <Text style={styles.loyaltyMetricTitle}>TOTAL REDEEMED</Text>
                  <SlidersHorizontal size={14} color="#737373" />
                </View>
                <Text style={styles.loyaltyMetricValue}>
                  {liveLoyalty?.totalRedeemed ?? 0}
                </Text>
                <Text style={styles.loyaltyMetricSub}>pts used</Text>
              </View>
            </View>

            {/* Points History Card */}
            <View style={[styles.tabContentCard, { marginTop: 14 }]}>
              <View style={styles.tabCardHeader}>
                <Text style={styles.tabCardTitle}>Points History</Text>
                <Text style={styles.tabCardCount}>Record of earned, redeemed, and adjusted points</Text>
              </View>

              {(!liveLoyalty?.history || liveLoyalty.history.length === 0) ? (
                <View style={styles.emptyTabBox}>
                  <Text style={styles.emptyTabText}>No loyalty points history recorded yet.</Text>
                </View>
              ) : (
                <View style={styles.historyList}>
                  {liveLoyalty.history.map((h: any, idx: number) => (
                    <View key={h.id || idx} style={styles.loyaltyHistoryRow}>
                      <View>
                        <Text style={styles.loyaltyHistorySource}>{h.source || h.type || 'Points Earned'}</Text>
                        <Text style={styles.loyaltyHistoryDate}>{formatDate(h.createdAt || h.date)}</Text>
                      </View>
                      <Text
                        style={[
                          styles.loyaltyHistoryPoints,
                          Number(h.points) < 0 ? styles.pointsNegative : styles.pointsPositive,
                        ]}
                      >
                        {Number(h.points) > 0 ? `+${h.points}` : h.points} pts
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── TAB 4: FEEDBACK ── */}
        {activeTab === 'feedback' && (
          <View style={styles.tabContentCard}>
            <View style={styles.tabCardHeader}>
              <Text style={styles.tabCardTitle}>Client Reviews & Feedback</Text>
            </View>

            {clientFeedbacks.length === 0 ? (
              <View style={styles.emptyTabBox}>
                <Text style={styles.emptyTabText}>No feedback submitted for this client yet.</Text>
              </View>
            ) : (
              <View style={styles.historyList}>
                {clientFeedbacks.map((f: any, idx: number) => (
                  <View key={f.id || idx} style={styles.feedbackItemRow}>
                    <View style={styles.feedbackTopRow}>
                      <View style={styles.starsRow}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={14}
                            color={star <= Number(f.rating || 5) ? '#F59E0B' : '#E8E2D9'}
                            fill={star <= Number(f.rating || 5) ? '#F59E0B' : 'transparent'}
                          />
                        ))}
                      </View>
                      <Text style={styles.feedbackDate}>{formatDate(f.createdAt)}</Text>
                    </View>
                    {f.comment ? (
                      <Text style={styles.feedbackComment}>{f.comment}</Text>
                    ) : null}
                    {f.technicianName ? (
                      <Text style={styles.feedbackTech}>Serviced by: {f.technicianName}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ===================================================================== */}
      {/* MODAL 1: EDIT DETAILS MODAL                                           */}
      {/* ===================================================================== */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Client Details</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <X size={18} color="#737373" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Name</Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Client name"
                  style={styles.formInput}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Phone (+237)</Text>
                <TextInput
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="+237 6xx xx xx xx"
                  keyboardType="phone-pad"
                  style={styles.formInput}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Quartier / Neighborhood</Text>
                <TextInput
                  value={editQuartier}
                  onChangeText={setEditQuartier}
                  placeholder="e.g. Bonamoussadi, Akwa"
                  style={styles.formInput}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Birthday Date (YYYY-MM-DD or DD-MM)</Text>
                <TextInput
                  value={editBirthday}
                  onChangeText={setEditBirthday}
                  placeholder="e.g. 1995-05-26 or 26-05"
                  style={styles.formInput}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Anniversary Date (Optional)</Text>
                <TextInput
                  value={editAnniversary}
                  onChangeText={setEditAnniversary}
                  placeholder="e.g. 2018-12-14 or 14-12"
                  style={styles.formInput}
                />
              </View>

              <View style={styles.modalActionButtons}>
                <TouchableOpacity
                  onPress={() => setShowEditModal(false)}
                  style={styles.cancelModalBtn}
                >
                  <Text style={styles.cancelModalBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSaveEdit}
                  disabled={savingEdit}
                  style={styles.saveModalBtn}
                >
                  {savingEdit ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Check size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.saveModalBtnText}>Save Changes</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ===================================================================== */}
      {/* MODAL 2: DEACTIVATE CONFIRMATION MODAL                                */}
      {/* ===================================================================== */}
      <Modal visible={showDeactivateModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.confirmIconCircleWarning}>
              <TriangleAlert size={24} color="#B34040" />
            </View>
            <Text style={styles.confirmTitle}>Mark Client as Inactive?</Text>
            <Text style={styles.confirmDesc}>
              Are you sure you want to mark <Text style={{ fontWeight: '700', color: '#2D2D2A' }}>{client.name}</Text> as inactive?
            </Text>
            <Text style={styles.confirmNote}>
              ℹ️ All appointments, invoices, payments, loyalty points, and photos will remain permanently preserved. You can restore this client to active at any time.
            </Text>

            <View style={styles.confirmActionButtons}>
              <TouchableOpacity
                onPress={() => setShowDeactivateModal(false)}
                style={styles.cancelModalBtn}
              >
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmDeactivate}
                style={styles.confirmDeactivateBtn}
              >
                <UserX size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.confirmDeactivateBtnText}>Yes, Mark Inactive</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===================================================================== */}
      {/* MODAL 3: RESTORE ACTIVE CONFIRMATION MODAL                            */}
      {/* ===================================================================== */}
      <Modal visible={showActivateModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.confirmIconCircleSuccess}>
              <RotateCcw size={22} color="#4F6748" />
            </View>
            <Text style={styles.confirmTitle}>Restore Client to Active?</Text>
            <Text style={styles.confirmDesc}>
              Are you sure you want to restore <Text style={{ fontWeight: '700', color: '#2D2D2A' }}>{client.name}</Text> to active status?
            </Text>
            <Text style={styles.confirmNote}>
              ✅ This client will be immediately restored to active and will appear across all active client lists and appointment booking dropdowns.
            </Text>

            <View style={styles.confirmActionButtons}>
              <TouchableOpacity
                onPress={() => setShowActivateModal(false)}
                style={styles.cancelModalBtn}
              >
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmActivate}
                style={styles.confirmActivateBtn}
              >
                <RotateCcw size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.confirmActivateBtnText}>Yes, Restore Active</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===================================================================== */}
      {/* MODAL 4: NEW PHOTO SESSION MODAL                                      */}
      {/* ===================================================================== */}
      <Modal visible={showAddSessionModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Photo Session</Text>
              <TouchableOpacity onPress={() => setShowAddSessionModal(false)}>
                <X size={18} color="#737373" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Treatment Service Name</Text>
              <TextInput
                value={newSessionService}
                onChangeText={setNewSessionService}
                placeholder="e.g. Gel Nails, Facial Rehydration"
                style={styles.formInput}
              />
            </View>

            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                onPress={() => setShowAddSessionModal(false)}
                style={styles.cancelModalBtn}
              >
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddNewSession}
                style={styles.saveModalBtn}
              >
                <Text style={styles.saveModalBtnText}>Create Session</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===================================================================== */}
      {/* MODAL 5: CAMERA CAPTURE MODAL                                         */}
      {/* ===================================================================== */}
      <CameraModal
        visible={cameraVisible}
        title="Capture Client Media"
        facingDefault="back"
        onClose={() => {
          setCameraVisible(false);
          setActivePhotoTarget(null);
        }}
        onCapture={(photoUri) => {
          setCameraVisible(false);
          handlePhotoCaptured(photoUri);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF7F2', // Warm Ivory matching web software body
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F6F1EB', // Soft cream matching web header
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D9',
    gap: 12,
  },
  webBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...THEME.shadows.sm,
  },
  webBackBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  webPageTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 13,
    color: '#737373',
    marginTop: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 14,
    color: '#737373',
  },

  /* Main Client Identity Card */
  identityCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    ...THEME.shadows.sm,
  },
  identityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  clientName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D2D2A',
    flex: 1,
    marginRight: 8,
  },
  activeBadge: {
    backgroundColor: '#EBF2EA',
    borderWidth: 1,
    borderColor: 'rgba(79, 103, 72, 0.3)',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F6748',
  },
  inactiveBadge: {
    backgroundColor: '#F3F0EC',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  inactiveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#737373',
  },

  /* Action Buttons Row */
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  markInactiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FBF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  markInactiveBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#737373',
  },
  restoreActiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FBF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  restoreActiveBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  editDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EBF2EA',
    borderWidth: 1,
    borderColor: 'rgba(79, 103, 72, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editDetailsBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F6748',
  },

  /* Info Rows */
  infoRows: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoRowText: {
    fontSize: 13,
    color: '#737373',
  },
  infoRowValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D2D2A',
  },

  /* Referral Nested Card */
  referralCard: {
    backgroundColor: '#F3F7F2',
    borderWidth: 1,
    borderColor: '#DCE7D7',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  referralHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#DCE7D7',
    paddingBottom: 6,
  },
  referralHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#2D2D2A',
  },
  referralGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  referralCol: {
    flex: 1,
  },
  referralLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#737373',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  referralClientValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  referralIntroValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F6748',
  },
  sourcePill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE7D7',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    alignSelf: 'flex-start',
  },
  sourcePillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  referralFirstService: {
    fontSize: 11,
    color: '#737373',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#DCE7D7',
  },

  /* Deposit Warning Banner */
  depositBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFDF5',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  depositTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  depositSub: {
    fontSize: 11,
    color: '#92400E',
    marginTop: 2,
  },

  /* Tabs Bar */
  tabsScrollView: {
    marginBottom: 14,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tabButtonActive: {
    backgroundColor: '#EBF2EA',
    borderColor: '#4F6748',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#737373',
  },
  tabButtonTextActive: {
    color: '#4F6748',
    fontWeight: '700',
  },

  /* Tab Content Card */
  tabContentCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 16,
    padding: 16,
    ...THEME.shadows.sm,
  },
  tabCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F4EFEA',
    marginBottom: 12,
  },
  tabCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  tabCardCount: {
    fontSize: 11,
    color: '#737373',
  },
  emptyTabBox: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTabText: {
    fontSize: 12,
    color: '#737373',
  },

  /* History List */
  historyList: {
    gap: 10,
  },
  historyItemRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F4EFEA',
  },
  historyItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyServiceName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  historyMetaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 3,
    flexWrap: 'wrap',
  },
  historyDateText: {
    fontSize: 11,
    color: '#737373',
  },
  historyTechText: {
    fontSize: 11,
    color: '#737373',
  },
  historyProductText: {
    fontSize: 11,
    color: '#737373',
    marginTop: 2,
  },
  historyNotesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 6,
    padding: 6,
    marginTop: 4,
  },
  historyNotesText: {
    fontSize: 11,
    color: '#2D2D2A',
    flex: 1,
  },
  historyStatusBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  historyStatusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  historyPriceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  historyPriceCancelled: {
    textDecorationLine: 'line-through',
    color: '#737373',
  },

  /* Photo Session Tab */
  photoTabHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  addPhotoSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    ...THEME.shadows.sm,
  },
  addPhotoSessionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  photoSessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F4EFEA',
  },
  photoSessionService: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  photoSessionDate: {
    fontSize: 11,
    color: '#737373',
  },
  photoSlotsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  photoSlotBox: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderStyle: 'dashed',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotImage: {
    width: '100%',
    height: '100%',
  },
  emptySlotContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  slotLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2D2D2A',
    marginTop: 6,
    marginBottom: 6,
  },
  attachBtnPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  attachBtnPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2D2D2A',
  },

  /* Loyalty Tab */
  loyaltyMetricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  loyaltyMetricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 14,
    padding: 12,
    ...THEME.shadows.sm,
  },
  loyaltyBalanceCard: {
    borderColor: 'rgba(79, 103, 72, 0.3)',
    backgroundColor: '#F7FAF6',
  },
  loyaltyMetricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  loyaltyMetricTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#737373',
    letterSpacing: 0.5,
  },
  loyaltyMetricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  loyaltyMetricSub: {
    fontSize: 10,
    color: '#4F6748',
    marginTop: 1,
  },
  loyaltyHistoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F4EFEA',
  },
  loyaltyHistorySource: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  loyaltyHistoryDate: {
    fontSize: 10,
    color: '#737373',
    marginTop: 1,
  },
  loyaltyHistoryPoints: {
    fontSize: 13,
    fontWeight: '700',
  },
  pointsPositive: {
    color: '#2D7A4D',
  },
  pointsNegative: {
    color: '#B34040',
  },

  /* Feedback Tab */
  feedbackItemRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F4EFEA',
  },
  feedbackTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  feedbackDate: {
    fontSize: 10,
    color: '#737373',
  },
  feedbackComment: {
    fontSize: 12,
    color: '#2D2D2A',
    lineHeight: 16,
  },
  feedbackTech: {
    fontSize: 11,
    color: '#4F6748',
    fontWeight: '500',
    marginTop: 4,
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    ...THEME.shadows.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F4EFEA',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  formGroup: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#737373',
    marginBottom: 4,
  },
  formInput: {
    height: 42,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 9,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#2D2D2A',
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelModalBtn: {
    flex: 1,
    height: 40,
    borderRadius: 9,
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelModalBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  saveModalBtn: {
    flex: 1,
    height: 40,
    borderRadius: 9,
    backgroundColor: '#4F6748',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveModalBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Confirmation Modals */
  confirmIconCircleWarning: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FAECEC',
    borderWidth: 1,
    borderColor: '#ECCACA',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  confirmIconCircleSuccess: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EBF2EA',
    borderWidth: 1,
    borderColor: 'rgba(79, 103, 72, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  confirmTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D2D2A',
    textAlign: 'center',
    marginBottom: 6,
  },
  confirmDesc: {
    fontSize: 12,
    color: '#737373',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 10,
  },
  confirmNote: {
    fontSize: 11,
    color: '#737373',
    backgroundColor: '#F6F1EB',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    lineHeight: 16,
  },
  confirmActionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmDeactivateBtn: {
    flex: 1,
    height: 40,
    borderRadius: 9,
    backgroundColor: '#B34040',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeactivateBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  confirmActivateBtn: {
    flex: 1,
    height: 40,
    borderRadius: 9,
    backgroundColor: '#4F6748',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmActivateBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default ClientFileScreen;
