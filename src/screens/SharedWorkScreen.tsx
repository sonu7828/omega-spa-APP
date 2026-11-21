/**
 * SharedWorkScreen — 1-to-1 Match with Omega Spa POS SharedWork.jsx
 * Full parity with Web POS frontend/src/pages/SharedWork.jsx:
 * - Header: "Shared Work" + subtitle + [+ New Walk-in Shared Visit] + [Back]
 * - Top Banner: "Your Assigned Client Visits" with count badge +
 *     "Manager View: All Client Visits" / "Reception View: All Client Visits (View Only)" / "Main Tech: <Name>"
 * - Search bar: "Search client or service..." with clear button
 * - Visits List:
 *     - Client name + status badge (DRAFT, PENDING, PAID)
 *     - Service name (e.g. ADVANCE FACIAL)
 *     - Time + Main Tech (e.g. Fortune Fotso)
 * - Active Shared Work Workspace (Modal / Details sheet):
 *     - Visit header with client name, appt #, scheduled service, time, main tech
 *     - Paid / Pending warning banners
 *     - Work Performed during this visit list with individual tech attribution & price
 *     - Reassign contributing technician on any performed service line (picker modal)
 *     - [+ Add Technician Work] modal with catalog services, contributing technician, & price
 *     - Remove unperformed service lines
 *     - Combined Invoice Total in FCFA
 *     - [Complete Shared Work & Submit] button -> submits combined invoice to Reception (PENDING_PAYMENT)
 *     - Role-based permissions: Reception has View-Only access (cannot add/edit/delete/submit lines)
 * - [+ New Walk-in Shared Visit] Modal:
 *     - Direct integration with NewWalkInServiceModal supporting BOTH Walk-in & Registered Clients,
 *       multi-technician service lines, optional retail add-ons, and instant pending/paid submission.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
  RefreshControl,
  Platform,
} from 'react-native';
import {
  Users,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  UserCheck,
  Calendar,
  X,
  FileCheck,
  Lock,
  ArrowLeft,
  Search,
  User,
  Scissors,
  Check,
  ChevronDown,
} from 'lucide-react-native';
import THEME from '../constants/theme';
import Header from '../components/Header';
import { formatFCFA } from '../utils/currency';
import { useAppointments, Appointment } from '../context/AppointmentsContext';
import { useAuth } from '../context/AuthContext';
import { useServices } from '../context/ServicesContext';
import { useInvoices } from '../context/InvoiceContext';
import { usersApi } from '../services/api';
import { NewWalkInServiceModal } from '../components/NewWalkInServiceModal';

export const SharedWorkScreen: React.FC<{ onOpenMenu?: () => void; onBack?: () => void }> = ({
  onOpenMenu,
  onBack,
}) => {
  const { user } = useAuth();
  const { appointments, refreshAppointments, updateAppointmentStatus } = useAppointments();
  const { services: catalogServices } = useServices();
  const { invoices, submitSharedWorkInvoice, refreshInvoices } = useInvoices();

  const isManager = (user?.role || '').toLowerCase() === 'manager';
  const isReception = (user?.role || '').toLowerCase() === 'reception';
  const canViewAll = isManager || isReception;

  const [staffList, setStaffList] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackNotice, setFeedbackNotice] = useState('');

  // Selected visit currently opened in Shared Work workspace
  const [activeApt, setActiveApt] = useState<Appointment | null>(null);

  // Draft work lines state per appointment: { [aptId]: [ { id, technician, technicianId, service, price, isMainTech } ] }
  const [draftLinesByApt, setDraftLinesByApt] = useState<Record<string, any[]>>({});

  // Modal: Add Technician Work
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalTechName, setModalTechName] = useState('');
  const [modalTechId, setModalTechId] = useState('');
  const [modalServiceName, setModalServiceName] = useState('');
  const [modalPrice, setModalPrice] = useState('');

  // Modal: Reassign Line Technician
  const [reassignLineId, setReassignLineId] = useState<string | null>(null);

  // Modal: New Walk-in / Shared Visit (Multi-tech, Walk-in & Registered)
  const [showSharedModal, setShowSharedModal] = useState(false);

  // Load technicians from backend
  const loadStaff = useCallback(async () => {
    setLoadingStaff(true);
    try {
      const res = await usersApi.getAll().catch(() => null);
      if (res) {
        const raw = res.data || (Array.isArray(res) ? res : []);
        const techs = raw.filter((u: any) => {
          const r = String(u.role?.name || u.role || '').toLowerCase();
          return r === 'technician' || r.includes('tech');
        });
        setStaffList(techs);
      }
    } catch (e) {
      console.warn('Failed to load staff for shared work', e);
    } finally {
      setLoadingStaff(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const activeTechnicians = useMemo(() => {
    if (staffList.length > 0) {
      return staffList.map((u) => ({
        id: String(u.id),
        name: u.staffProfile?.name || u.name || u.email,
      }));
    }
    // Fallback names
    return [
      { id: 'tech-1', name: 'Fortune Fotso' },
      { id: 'tech-2', name: 'Justice B' },
      { id: 'tech-3', name: 'Celia Whapi' },
      { id: 'tech-4', name: 'Mbakop Joana' },
      { id: 'tech-5', name: 'Samira Djouwa' },
    ];
  }, [staffList]);

  const activeCatalogServices = useMemo(() => {
    return catalogServices.filter((s) => s.active !== false);
  }, [catalogServices]);

  // 1. FILTER VISITS: Only show appointments where user is Main Tech (or Manager/Reception sees all)
  const eligibleAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      if (apt.status === 'CANCELLED' || apt.status === 'NO_SHOW') return false;
      if (!canViewAll) {
        const userMatches =
          (user?.name && apt.mainTechnicianName?.toLowerCase() === user.name.toLowerCase()) ||
          (user?.id && apt.mainTechnicianId === user.id);
        if (!userMatches) return false;
      }
      return true;
    });
  }, [appointments, canViewAll, user]);

  // Search filter for assigned client visits
  const filteredVisits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return eligibleAppointments;
    return eligibleAppointments.filter((apt) => {
      const serviceSummary = apt.services.map((s) => s.serviceName).join(', ');
      return (
        apt.clientName?.toLowerCase().includes(q) ||
        serviceSummary.toLowerCase().includes(q) ||
        apt.time?.toLowerCase().includes(q) ||
        (apt.mainTechnicianName && apt.mainTechnicianName.toLowerCase().includes(q))
      );
    });
  }, [eligibleAppointments, searchQuery]);

  // Existing invoice for active visit if already submitted or paid
  const activeInvoice = useMemo(() => {
    if (!activeApt) return null;
    return invoices.find(
      (inv) =>
        String(inv.appointmentId) === String(activeApt.id) ||
        inv.items?.some((it) => String(it.id) === String(activeApt.id))
    );
  }, [invoices, activeApt]);

  const isPaid = activeInvoice?.status === 'PAID';
  const isPending = activeInvoice?.status === 'PENDING_PAYMENT';

  // Work performed lines for current active visit
  const currentDraftLines = useMemo(() => {
    if (!activeApt) return [];

    if (draftLinesByApt[activeApt.id]) {
      return draftLinesByApt[activeApt.id];
    }

    if (activeInvoice?.items && activeInvoice.items.length > 0) {
      return activeInvoice.items
        .filter((it: any) => it.type !== 'drink' && it.type !== 'cosmetic')
        .map((it, idx) => ({
          id: String(it.id || idx),
          appointmentServiceId: (it as any).appointmentServiceId || String(it.id || idx),
          serviceId: (it as any).serviceId || null,
          technician: it.technicianName || activeApt.mainTechnicianName || 'Staff',
          technicianId: (it as any).technicianId || activeApt.mainTechnicianId || null,
          service: it.name || 'Spa Service',
          price: it.price || 0,
          isMainTech:
            !it.technicianName || it.technicianName === activeApt.mainTechnicianName,
        }));
    }

    if (activeApt.services && activeApt.services.length > 0) {
      return activeApt.services.map((s, idx) => ({
        id: s.id || `line-${activeApt.id}-${idx}`,
        appointmentServiceId: s.id || `line-${activeApt.id}-${idx}`,
        serviceId: s.serviceId || null,
        technician: s.technicianName || activeApt.mainTechnicianName || user?.name || 'Staff',
        technicianId: s.technicianId || activeApt.mainTechnicianId || user?.id || null,
        service: s.serviceName,
        price: s.price || 15000,
        isMainTech:
          !s.technicianName || s.technicianName === activeApt.mainTechnicianName,
      }));
    }

    return [
      {
        id: `line-${activeApt.id}-0`,
        appointmentServiceId: `line-${activeApt.id}-0`,
        serviceId: null,
        technician: activeApt.mainTechnicianName || user?.name || 'Staff',
        technicianId: activeApt.mainTechnicianId || user?.id || null,
        service: 'Spa Treatment',
        price: activeApt.totalPrice || 15000,
        isMainTech: true,
      },
    ];
  }, [activeApt, draftLinesByApt, activeInvoice, user]);

  // Combined subtotal
  const combinedSubtotal = useMemo(() => {
    return currentDraftLines.reduce((sum, it) => sum + (Number(it.price) || 0), 0);
  }, [currentDraftLines]);

  // Open modal to add a contributing technician's work
  const handleOpenAddModal = () => {
    const firstTech = activeTechnicians[0] || { id: 'tech-1', name: 'Fortune Fotso' };
    const firstSvc = activeCatalogServices[0];
    setModalTechName(firstTech.name);
    setModalTechId(firstTech.id);
    setModalServiceName(firstSvc?.name || 'Gel Nails');
    setModalPrice(String(firstSvc?.numericPrice || 15000));
    setShowAddModal(true);
  };

  const handleSelectServiceInModal = (svc: any) => {
    setModalServiceName(svc.name);
    setModalPrice(String(svc.numericPrice || 15000));
  };

  // Save new technician work line
  const handleSaveTechnicianWork = () => {
    if (!activeApt || !modalServiceName || !modalTechName) return;

    const matchedSvc = activeCatalogServices.find((s) => s.name === modalServiceName);
    const matchedTech = activeTechnicians.find((t) => t.name === modalTechName);
    const priceNum = parseInt(String(modalPrice).replace(/[^0-9]/g, ''), 10) || matchedSvc?.numericPrice || 15000;
    const newId = `shared-line-${activeApt.id}-${Date.now()}`;

    const newLine = {
      id: newId,
      appointmentServiceId: newId,
      serviceId: matchedSvc?.id || null,
      technician: modalTechName,
      technicianId: matchedTech?.id || modalTechId || null,
      service: modalServiceName,
      price: priceNum,
      isMainTech: modalTechName === activeApt.mainTechnicianName,
    };

    const updated = [...currentDraftLines, newLine];
    setDraftLinesByApt((prev) => ({
      ...prev,
      [activeApt.id]: updated,
    }));

    setShowAddModal(false);
    setFeedbackNotice(`Added ${modalTechName}'s work (${modalServiceName} — ${formatFCFA(priceNum)}) to draft.`);
    setTimeout(() => setFeedbackNotice(''), 4000);
  };

  // Reassign contributing technician on a line
  const handleUpdateLineTechnician = (lineId: string, techName: string, techId: string) => {
    if (!activeApt || isPaid || isPending || isReception) return;
    const updated = currentDraftLines.map((line) => {
      if (line.id !== lineId) return line;
      return {
        ...line,
        technician: techName,
        technicianId: techId || null,
        isMainTech: techName === activeApt.mainTechnicianName,
      };
    });
    setDraftLinesByApt((prev) => ({
      ...prev,
      [activeApt.id]: updated,
    }));
    setReassignLineId(null);
  };

  // Remove work line
  const handleRemoveDraftLine = (lineId: string) => {
    if (!activeApt || isPaid || isReception) return;
    const updated = currentDraftLines.filter((l) => l.id !== lineId);
    setDraftLinesByApt((prev) => ({
      ...prev,
      [activeApt.id]: updated,
    }));
  };

  // Complete and submit combined invoice to Reception
  const handleCompleteAndSubmit = async () => {
    if (!activeApt || currentDraftLines.length === 0 || isPaid || isReception) return;

    try {
      await submitSharedWorkInvoice({
        appointmentId: activeApt.id,
        clientId: activeApt.clientId,
        clientName: activeApt.clientName,
        items: currentDraftLines.map((it) => ({
          appointmentServiceId: it.appointmentServiceId || it.id,
          serviceId: it.serviceId,
          name: it.service,
          service: it.service,
          price: it.price,
          technician: it.technician,
          technicianId: it.technicianId,
        })),
      });

      await updateAppointmentStatus(activeApt.id, 'COMPLETED');
      setFeedbackNotice(`Shared Work submitted for ${activeApt.clientName}! Combined invoice (${formatFCFA(combinedSubtotal)}) sent to Reception.`);
      setTimeout(() => setFeedbackNotice(''), 5000);
      setActiveApt(null);
      refreshAppointments();
      if (refreshInvoices) refreshInvoices();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not submit shared work.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header — Clean Title & Subtitle Full Width on Top */}
      <Header
        title="Shared Work"
        subtitle="Multi-technician collaborative visits managed by the assigned Main Technician."
        onOpenMenu={onOpenMenu}
      />

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainScrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loadingStaff}
            onRefresh={() => {
              loadStaff();
              refreshAppointments();
              if (refreshInvoices) refreshInvoices();
            }}
            tintColor={THEME.colors.primaryDark}
          />
        }
      >
        {/* Top Actions Row: New Walk-in Button Stacked Under Title (Upar-Niche Layout) */}
        <View style={styles.topActionsContainer}>
          <TouchableOpacity
            onPress={() => setShowSharedModal(true)}
            style={styles.newWalkInBtnStacked}
            activeOpacity={0.8}
          >
            <Users size={16} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.newWalkInBtnTextStacked}>+ New Walk-in Shared Visit</Text>
          </TouchableOpacity>

          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.headerBackBtn} activeOpacity={0.7}>
              <ArrowLeft size={14} color="#2D2D2A" />
              <Text style={styles.headerBackBtnText}>Back</Text>
            </TouchableOpacity>
          )}
        </View>
        {/* Success Notice */}
        {feedbackNotice ? (
          <View style={styles.noticeBanner}>
            <CheckCircle2 size={16} color="#16A34A" />
            <Text style={styles.noticeBannerText}>{feedbackNotice}</Text>
            <TouchableOpacity onPress={() => setFeedbackNotice('')} style={{ padding: 2 }}>
              <X size={14} color="#16A34A" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ========================================================================= */}
        {/* TOP BANNER: Your Assigned Client Visits (Exact match with Web Software) */}
        {/* ========================================================================= */}
        <View style={styles.assignedVisitsCard}>
          {/* Top Row: Title + Count Badge */}
          <View style={styles.bannerTopRow}>
            <Text style={styles.bannerTitle}>Your Assigned Client Visits</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{eligibleAppointments.length}</Text>
            </View>
          </View>
          <Text style={styles.bannerSubtitle}>
            Select an active visit below to manage collaborative technician services.
          </Text>

          {/* Nested Manager / Reception / Technician Info Card */}
          <View style={styles.managerBannerBox}>
            <View style={styles.userCheckCircle}>
              <UserCheck size={16} color="#4F6748" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.managerRow}>
                <Text style={styles.managerTitle}>
                  {isManager ? (
                    <Text>
                      Manager View: <Text style={styles.roleHighlightText}>All Client Visits</Text>
                    </Text>
                  ) : isReception ? (
                    <Text>
                      Reception View: <Text style={styles.roleHighlightText}>All Client Visits (View Only)</Text>
                    </Text>
                  ) : (
                    <Text>
                      Main Technician: <Text style={styles.roleHighlightText}>{user?.name || 'Staff'}</Text>
                    </Text>
                  )}
                </Text>
                <View style={styles.assignedVisitsPill}>
                  <Text style={styles.assignedVisitsPillText}>
                    {eligibleAppointments.length} Assigned Visit{eligibleAppointments.length === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>
              <Text style={styles.managerSub} numberOfLines={2}>
                {isManager
                  ? 'Review and manage shared technician visits across all staff.'
                  : isReception
                  ? 'View-only review of collaborative technician visits across all staff.'
                  : 'You are viewing only appointments assigned to you as Main Technician.'}
              </Text>
            </View>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* SEARCH BAR (Exact match with Web Software) */}
        {/* ========================================================================= */}
        <View style={styles.searchBar}>
          <Search size={14} color="#737373" style={{ marginRight: 8 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search client or service..."
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
        {/* VISITS LIST CARDS (Exact match with Web Software) */}
        {/* ========================================================================= */}
        <View style={styles.visitsList}>
          {filteredVisits.length === 0 ? (
            <View style={styles.emptyCard}>
              <Users size={32} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No Assigned Visits Found</Text>
              <Text style={styles.emptySub}>
                {searchQuery
                  ? `No visits found matching "${searchQuery}"`
                  : canViewAll
                  ? 'No active client visits or scheduled appointments for today.'
                  : `You have no appointments assigned to you as Main Technician today. Other technicians' visits cannot be accessed.`}
              </Text>
            </View>
          ) : (
            filteredVisits.map((apt) => {
              const serviceSummary =
                apt.services.map((s) => s.serviceName).join(', ') || 'Spa Service';
              const techName = apt.mainTechnicianName || 'Staff';
              const aptInvoice = invoices.find(
                (inv) => String(inv.appointmentId) === String(apt.id)
              );
              const isAptPaid = aptInvoice?.status === 'PAID';
              const isAptPending = aptInvoice?.status === 'PENDING_PAYMENT';
              const statusBadgeText = isAptPaid ? 'PAID' : isAptPending ? 'PENDING' : 'DRAFT';

              return (
                <TouchableOpacity
                  key={apt.id}
                  onPress={() => setActiveApt(apt)}
                  style={styles.visitCard}
                  activeOpacity={0.8}
                >
                  {/* Top Line: Client Name + Status Badge */}
                  <View style={styles.visitTopRow}>
                    <Text style={styles.clientNameText} numberOfLines={1}>
                      {apt.clientName}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        isAptPaid
                          ? styles.statusBadgePaid
                          : isAptPending
                          ? styles.statusBadgePending
                          : styles.statusBadgeDraft,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          isAptPaid
                            ? styles.statusBadgeTextPaid
                            : isAptPending
                            ? styles.statusBadgeTextPending
                            : styles.statusBadgeTextDraft,
                        ]}
                      >
                        {statusBadgeText}
                      </Text>
                    </View>
                  </View>

                  {/* Middle Line: Service Name */}
                  <Text style={styles.serviceNameText} numberOfLines={1}>
                    {serviceSummary}
                  </Text>

                  {/* Bottom Line: Time + Main Tech */}
                  <View style={styles.visitBottomRow}>
                    <View style={styles.timeTag}>
                      <Clock size={12} color="#737373" />
                      <Text style={styles.timeText}>{apt.time || 'Today'}</Text>
                    </View>

                    <Text style={styles.mainTechText}>
                      Main Tech: <Text style={styles.mainTechName}>{techName}</Text>
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ========================================================================= */}
      {/* WORKSPACE MODAL: Active Shared Work Visit (Manage collaborative technicians) */}
      {/* ========================================================================= */}
      <Modal visible={!!activeApt} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.workspaceSheet}>
            {activeApt && (
              <>
                {/* Header — Fully Responsive Layout */}
                <View style={styles.workspaceHeader}>
                  <View style={styles.workspaceHeaderTopRow}>
                    <Text style={styles.workspaceClientName} numberOfLines={1}>
                      {activeApt.clientName}
                    </Text>
                    <TouchableOpacity onPress={() => setActiveApt(null)} style={styles.modalCloseBtn}>
                      <X size={20} color="#737373" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.workspaceHeaderMetaRow}>
                    <View style={styles.apptBadge}>
                      <Text style={styles.apptBadgeText}>#{activeApt.id.slice(0, 8)}</Text>
                    </View>
                    <View style={styles.mainTechBadge}>
                      <Text style={styles.mainTechBadgeText}>
                        Main Tech: <Text style={{ fontWeight: '800' }}>{activeApt.mainTechnicianName || 'Staff'}</Text>
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.workspaceMetaText} numberOfLines={2}>
                    Scheduled: <Text style={{ fontWeight: '700', color: '#2D2D2A' }}>{activeApt.services.map((s) => s.serviceName).join(', ') || 'Spa Service'}</Text> · Time: <Text style={{ fontWeight: '700', color: '#2D2D2A' }}>{activeApt.time || 'Today'}</Text>
                  </Text>
                </View>

                {/* Status Notice if Paid / Submitted */}
                {isPaid ? (
                  <View style={styles.paidNoticeBox}>
                    <FileCheck size={16} color="#16A34A" />
                    <Text style={styles.paidNoticeText}>
                      This visit invoice is <Text style={{ fontWeight: '800' }}>PAID</Text> and sealed. No further services can be added or edited.
                    </Text>
                  </View>
                ) : isPending ? (
                  <View style={styles.pendingNoticeBox}>
                    <Clock size={16} color="#D97706" />
                    <Text style={styles.pendingNoticeText}>
                      Combined invoice is already submitted to Reception and awaiting payment collection.
                    </Text>
                  </View>
                ) : null}

                {/* Work Performed Header */}
                <View style={styles.workSectionHeader}>
                  <Text style={styles.workSectionTitle}>
                    WORK PERFORMED DURING THIS VISIT ({currentDraftLines.length})
                  </Text>
                  {!isPaid && !isPending && !isReception && (
                    <TouchableOpacity
                      onPress={handleOpenAddModal}
                      style={styles.addWorkBtn}
                      activeOpacity={0.8}
                    >
                      <Plus size={13} color="#2D2D2A" />
                      <Text style={styles.addWorkBtnText}>Add Technician Work</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Work Lines List */}
                <ScrollView style={styles.workLinesScroll}>
                  {currentDraftLines.length === 0 ? (
                    <View style={styles.noLinesBox}>
                      <Text style={styles.noLinesText}>No services recorded in this draft visit.</Text>
                      {!isReception && (
                        <TouchableOpacity
                          onPress={handleOpenAddModal}
                          style={[styles.addWorkBtn, { marginTop: 8 }]}
                        >
                          <Plus size={13} color="#2D2D2A" />
                          <Text style={styles.addWorkBtnText}>Add Performed Service</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    currentDraftLines.map((line, idx) => {
                      const isMain = line.technician === activeApt.mainTechnicianName;
                      const canDelete = !isPaid && !isPending && !isReception;
                      const canReassign = !isPaid && !isPending && !isReception;

                      return (
                        <View
                          key={line.id || idx}
                          style={[
                            styles.workLineCard,
                            isMain ? styles.workLineCardMain : styles.workLineCardOther,
                          ]}
                        >
                          <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                            <View style={styles.workLineTop}>
                              <Text style={styles.workLineService} numberOfLines={1}>
                                {line.service}
                              </Text>
                              {isMain && (
                                <View style={styles.mainTechTag}>
                                  <Text style={styles.mainTechTagText}>Main Tech</Text>
                                </View>
                              )}
                            </View>

                            <View style={styles.performedByRow}>
                              <Text style={styles.workLinePerformedBy}>Performed by: </Text>
                              {canReassign ? (
                                <TouchableOpacity
                                  onPress={() => setReassignLineId(line.id)}
                                  style={styles.reassignTechBtn}
                                  activeOpacity={0.7}
                                >
                                  <Text style={styles.reassignTechText}>{line.technician}</Text>
                                  <ChevronDown size={11} color="#4F6748" />
                                </TouchableOpacity>
                              ) : (
                                <Text style={styles.workLineTechNameFixed}>{line.technician}</Text>
                              )}
                            </View>
                          </View>

                          <View style={styles.workLineRight}>
                            <Text style={styles.workLinePrice}>{formatFCFA(line.price)}</Text>
                            {canDelete ? (
                              <TouchableOpacity
                                onPress={() => handleRemoveDraftLine(line.id)}
                                style={styles.deleteLineBtn}
                              >
                                <Trash2 size={14} color="#EF4444" />
                              </TouchableOpacity>
                            ) : isPaid ? (
                              <View style={styles.lockIconBox}>
                                <Lock size={13} color="#9CA3AF" />
                              </View>
                            ) : null}
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>

                {/* Summary & Submission Footer — Fully Responsive Stacked Layout */}
                <View style={styles.workspaceFooter}>
                  <View style={styles.footerTotalBlock}>
                    <View>
                      <Text style={styles.footerTotalLabel}>COMBINED INVOICE TOTAL</Text>
                      <Text style={styles.footerTotalValue}>{formatFCFA(combinedSubtotal)}</Text>
                    </View>
                    <Text style={styles.footerCountSub}>
                      {currentDraftLines.length} technician service{currentDraftLines.length === 1 ? '' : 's'} recorded
                    </Text>
                  </View>

                  {!isPaid && !isPending && (
                    !isReception ? (
                      <TouchableOpacity
                        onPress={handleCompleteAndSubmit}
                        style={styles.submitSharedBtn}
                        activeOpacity={0.8}
                      >
                        <CheckCircle2 size={16} color="#FFFFFF" strokeWidth={2.2} />
                        <Text style={styles.submitSharedBtnText}>Complete Shared Work & Submit</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.receptionViewOnlyBadge}>
                        <FileCheck size={16} color="#4F6748" />
                        <Text style={styles.receptionViewOnlyText}>
                          View Only · Managed by Main Tech / Manager
                        </Text>
                      </View>
                    )
                  )}

                  {isPending && (
                    <View style={styles.pendingAwaitingPill}>
                      <Clock size={15} color="#D97706" />
                      <Text style={styles.pendingAwaitingText}>
                        Awaiting Reception Collection ({formatFCFA(combinedSubtotal)})
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: Add Technician Work */}
      {/* ========================================================================= */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.addModalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add Technician Work</Text>
                <Text style={styles.modalSubtitle}>
                  Client: {activeApt?.clientName} (Main Tech: {activeApt?.mainTechnicianName})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X size={20} color="#737373" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {/* Select Contributing Technician */}
              <Text style={styles.fieldLabel}>CONTRIBUTING TECHNICIAN *</Text>
              <View style={styles.chipsWrap}>
                {activeTechnicians.map((t) => {
                  const isSel = modalTechName === t.name;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => {
                        setModalTechName(t.name);
                        setModalTechId(t.id);
                      }}
                      style={[styles.techChip, isSel && styles.techChipActive]}
                    >
                      <Text style={[styles.techChipText, isSel && styles.techChipTextActive]}>
                        {t.name} {t.name === activeApt?.mainTechnicianName ? '(Main Tech)' : '· Tech'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Select Performed Service */}
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>PERFORMED SERVICE *</Text>
              <View style={styles.chipsWrap}>
                {activeCatalogServices.map((s) => {
                  const isSel = modalServiceName === s.name;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => handleSelectServiceInModal(s)}
                      style={[styles.serviceChip, isSel && styles.serviceChipActive]}
                    >
                      <Text style={[styles.serviceChipText, isSel && styles.serviceChipTextActive]}>
                        {s.name} — {formatFCFA(s.numericPrice || 0)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Price */}
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>PRICE (FCFA) *</Text>
              <TextInput
                value={modalPrice}
                onChangeText={setModalPrice}
                keyboardType="numeric"
                style={styles.formInput}
                placeholder="15000"
              />

              <View style={styles.explainerBox}>
                <Text style={styles.explainerText}>
                  💡 Each service line preserves its contributing technician. In Daily Close and Tech Summary, revenue will be credited directly to the recorded technician.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveTechnicianWork} style={styles.confirmAddBtn}>
                <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.confirmAddBtnText}>Add to Work List</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: Reassign Technician for Work Line */}
      {/* ========================================================================= */}
      <Modal visible={!!reassignLineId} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.addModalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Reassign Technician</Text>
                <Text style={styles.modalSubtitle}>
                  Choose contributing technician for this service line
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReassignLineId(null)}>
                <X size={20} color="#737373" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              <View style={{ gap: 8 }}>
                {activeTechnicians.map((t) => {
                  const currentLine = currentDraftLines.find((l) => l.id === reassignLineId);
                  const isCurrent = currentLine?.technician === t.name;
                  const isMain = t.name === activeApt?.mainTechnicianName;

                  return (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => {
                        if (reassignLineId) {
                          handleUpdateLineTechnician(reassignLineId, t.name, t.id);
                        }
                      }}
                      style={[
                        styles.reassignOptionItem,
                        isCurrent && styles.reassignOptionItemActive,
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <User size={15} color={isCurrent ? '#4F6748' : '#737373'} />
                        <Text
                          style={[
                            styles.reassignOptionName,
                            isCurrent && styles.reassignOptionNameActive,
                          ]}
                        >
                          {t.name}
                        </Text>
                        {isMain && (
                          <View style={styles.mainTechTag}>
                            <Text style={styles.mainTechTagText}>Main Tech</Text>
                          </View>
                        )}
                      </View>
                      {isCurrent && <Check size={16} color="#4F6748" strokeWidth={2.5} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={[styles.modalActionsRow, { marginTop: 12 }]}>
              <TouchableOpacity
                onPress={() => setReassignLineId(null)}
                style={[styles.cancelBtn, { flex: 1 }]}
              >
                <Text style={styles.cancelBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: + New Walk-in Shared Visit (Supports BOTH Walk-in & Registered Clients) */}
      {/* ========================================================================= */}
      <NewWalkInServiceModal
        visible={showSharedModal}
        initialSharedMode={true}
        onClose={() => setShowSharedModal(false)}
        onSuccess={(_inv, isPaid) => {
          setShowSharedModal(false);
          setFeedbackNotice(
            `Shared visit created successfully (${isPaid ? 'Paid' : 'Pending Payment'})!`
          );
          setTimeout(() => setFeedbackNotice(''), 5000);
          refreshAppointments();
          if (refreshInvoices) refreshInvoices();
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
  topActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  newWalkInBtnStacked: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#8F9E87',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    ...THEME.shadows.sm,
  },
  newWalkInBtnTextStacked: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...THEME.shadows.sm,
  },
  headerBackBtnText: {
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
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  noticeBannerText: {
    fontSize: 12,
    color: '#15803D',
    fontWeight: '600',
    flex: 1,
  },
  // Top Banner Card (Matches Web SharedWork.jsx)
  assignedVisitsCard: {
    backgroundColor: 'rgba(246, 241, 235, 0.6)',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  bannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  countBadge: {
    backgroundColor: '#E8F2E6',
    borderWidth: 1,
    borderColor: '#B7CEB3',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4F6748',
  },
  bannerSubtitle: {
    fontSize: 11,
    color: '#737373',
    marginTop: 3,
    marginBottom: 10,
  },
  managerBannerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 12,
    padding: 12,
    ...THEME.shadows.sm,
  },
  userCheckCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F2E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  managerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 2,
  },
  managerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
    flexShrink: 1,
  },
  roleHighlightText: {
    color: '#4F6748',
    fontWeight: '800',
  },
  assignedVisitsPill: {
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  assignedVisitsPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#737373',
  },
  managerSub: {
    fontSize: 11,
    color: '#737373',
    lineHeight: 15,
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
    ...THEME.shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#2D2D2A',
    paddingVertical: 4,
  },
  // Visits List
  visitsList: {
    gap: 10,
  },
  visitCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 14,
    padding: 14,
    gap: 6,
    ...THEME.shadows.sm,
  },
  visitTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clientNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2A',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
  },
  statusBadgeDraft: {
    backgroundColor: '#F6F1EB',
    borderColor: '#E8E2D9',
  },
  statusBadgePending: {
    backgroundColor: '#FEF3C7',
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  statusBadgePaid: {
    backgroundColor: '#DCFCE7',
    borderColor: 'rgba(22, 163, 74, 0.3)',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusBadgeTextDraft: {
    color: '#737373',
  },
  statusBadgeTextPending: {
    color: '#B45309',
  },
  statusBadgeTextPaid: {
    color: '#15803D',
  },
  serviceNameText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  visitBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F0EBE3',
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    color: '#737373',
    fontWeight: '500',
  },
  mainTechText: {
    fontSize: 11,
    color: '#737373',
  },
  mainTechName: {
    fontWeight: '700',
    color: '#2D2D2A',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 36,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  emptySub: {
    fontSize: 11,
    color: '#737373',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 16,
  },
  // Workspace Sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  workspaceSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '90%',
  },
  workspaceHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D9',
    paddingBottom: 12,
    marginBottom: 12,
    gap: 6,
  },
  workspaceHeaderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  workspaceClientName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#2D2D2A',
    flex: 1,
  },
  modalCloseBtn: {
    padding: 4,
  },
  workspaceHeaderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  apptBadge: {
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  apptBadgeText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#737373',
    fontWeight: '600',
  },
  mainTechBadge: {
    backgroundColor: '#E8F2E6',
    borderWidth: 1,
    borderColor: 'rgba(79, 103, 72, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  mainTechBadgeText: {
    fontSize: 11,
    color: '#2D2D2A',
  },
  workspaceMetaText: {
    fontSize: 11,
    color: '#737373',
    lineHeight: 16,
  },
  paidNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  paidNoticeText: {
    fontSize: 11,
    color: '#15803D',
    flex: 1,
  },
  pendingNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  pendingNoticeText: {
    fontSize: 11,
    color: '#B45309',
    flex: 1,
  },
  workSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  workSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2D2D2A',
    letterSpacing: 0.5,
  },
  addWorkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addWorkBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  workLinesScroll: {
    maxHeight: 280,
    marginBottom: 12,
  },
  noLinesBox: {
    paddingVertical: 20,
    alignItems: 'center',
    backgroundColor: '#FAF7F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  noLinesText: {
    fontSize: 12,
    color: '#737373',
  },
  workLineCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  workLineCardMain: {
    backgroundColor: '#F3F7F2',
    borderColor: '#D4E2D0',
  },
  workLineCardOther: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E8E2D9',
  },
  workLineTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  workLineService: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  mainTechTag: {
    backgroundColor: '#A7B89A',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  mainTechTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#2D2D2A',
    textTransform: 'uppercase',
  },
  performedByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  workLinePerformedBy: {
    fontSize: 11,
    color: '#737373',
  },
  workLineTechNameFixed: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  reassignTechBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E8F2E6',
    borderWidth: 1,
    borderColor: 'rgba(79, 103, 72, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reassignTechText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  workLineRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  workLinePrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2D2D2A',
  },
  deleteLineBtn: {
    padding: 4,
  },
  lockIconBox: {
    padding: 4,
  },
  workspaceFooter: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E8E2D9',
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  footerTotalBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerTotalLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#737373',
    letterSpacing: 0.5,
  },
  footerTotalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2D2D2A',
  },
  footerCountSub: {
    fontSize: 11,
    color: '#737373',
    fontWeight: '500',
  },
  submitSharedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4F6748',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
  },
  submitSharedBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  receptionViewOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    width: '100%',
  },
  receptionViewOnlyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F6748',
    textAlign: 'center',
    flexShrink: 1,
  },
  pendingAwaitingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    width: '100%',
  },
  pendingAwaitingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
    textAlign: 'center',
    flexShrink: 1,
  },
  // Add Technician Work Sheet
  addModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D9',
    paddingBottom: 10,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#737373',
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#737373',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  techChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  techChipActive: {
    backgroundColor: '#E8F2E6',
    borderColor: '#4F6748',
  },
  techChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#737373',
  },
  techChipTextActive: {
    color: '#4F6748',
    fontWeight: '700',
  },
  serviceChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  serviceChipActive: {
    backgroundColor: '#E8F2E6',
    borderColor: '#4F6748',
  },
  serviceChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#737373',
  },
  serviceChipTextActive: {
    color: '#4F6748',
    fontWeight: '700',
  },
  formInput: {
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#2D2D2A',
  },
  explainerBox: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    marginTop: 12,
  },
  explainerText: {
    fontSize: 11,
    color: '#737373',
    lineHeight: 16,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F6F1EB',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  confirmAddBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#4F6748',
  },
  confirmAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Reassign Modal Items
  reassignOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  reassignOptionItemActive: {
    backgroundColor: '#E8F2E6',
    borderColor: '#4F6748',
  },
  reassignOptionName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  reassignOptionNameActive: {
    fontWeight: '800',
    color: '#4F6748',
  },
});

export default SharedWorkScreen;
