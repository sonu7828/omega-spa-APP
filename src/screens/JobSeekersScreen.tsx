/**
 * JobSeekersScreen — 1-to-1 Match with Omega Spa POS Web Software
 * Matches frontend/src/pages/JobSeekers.jsx exactly:
 * - Header: "Job Seekers" | "Record of people applying for jobs at Omega Spa (X total)" | "+ Add Job Seeker"
 * - Search bar with clear (X)
 * - Status Filter: "All Statuses", "Applied", "Interview", "Hired", "Rejected"
 * - Role Filter: "All Roles", "Massage Therapist", "Nail Technician", etc.
 * - Table/Row view: Initial avatar, Candidate Name, Phone, Position badge, Date, Notes, Status dropdown, Trash icon action
 * - Modal: Add Job Seeker (Full Name, Phone, Position, Notes)
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
  Linking,
  ActivityIndicator,
  FlatList,
  Platform,
} from 'react-native';
import {
  Search,
  UserPlus,
  Trash2,
  X,
  Users,
  ShieldAlert,
  ChevronDown,
  Check,
  Phone,
  MessageSquare,
} from 'lucide-react-native';
import THEME from '../constants/theme';
import Header from '../components/Header';
import Card from '../components/Card';
import {
  useJobSeekers,
  JobSeeker,
  JOB_SEEKER_POSITIONS,
  JOB_SEEKER_STATUSES,
} from '../context/JobSeekersContext';
import { useAuth } from '../context/AuthContext';

function formatDisplayDate(raw: string | undefined): string {
  if (!raw) return '—';
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return String(raw).slice(0, 10);
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(raw).slice(0, 10) || '—';
  }
}

const STATUS_OPTIONS = [
  { value: 'NEW', label: 'Applied', bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  { value: 'INTERVIEW_SCHEDULED', label: 'Interview', bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  { value: 'HIRED', label: 'Hired', bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  { value: 'REJECTED', label: 'Rejected', bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
];

export const JobSeekersScreen: React.FC<{ onOpenMenu?: () => void }> = ({ onOpenMenu }) => {
  const { user } = useAuth();
  const role = (user?.role || '').toLowerCase();
  const isManager = role === 'manager';
  const isReception = role === 'reception';
  const hasAccess = isManager || isReception;

  const { jobSeekers, loading, createJobSeeker, updateJobSeekerStatus, deleteJobSeeker, refreshJobSeekers } =
    useJobSeekers();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedPosition, setSelectedPosition] = useState('ALL');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [statusPickerCandidate, setStatusPickerCandidate] = useState<JobSeeker | null>(null);
  const [filterPickerType, setFilterPickerType] = useState<'status' | 'position' | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    positionApplied: 'Massage Therapist',
    notes: '',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter candidates
  const filteredCandidates = useMemo(() => {
    return jobSeekers.filter((c) => {
      // Normalize shortlisted to NEW if status filter is applied
      const cStatus = c.status === 'SHORTLISTED' ? 'NEW' : c.status;
      if (selectedStatus !== 'ALL' && cStatus !== selectedStatus) {
        return false;
      }
      if (selectedPosition !== 'ALL' && c.positionApplied !== selectedPosition) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (c.fullName || '').toLowerCase().includes(q);
        const matchPhone = (c.phone || '').includes(q);
        const matchPos = (c.positionApplied || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchPos) {
          return false;
        }
      }
      return true;
    });
  }, [jobSeekers, selectedStatus, selectedPosition, searchQuery]);

  // Handle Create Candidate
  const handleCreateSubmit = async () => {
    setFormError('');
    if (!formData.fullName.trim()) {
      setFormError('Candidate name is required.');
      return;
    }
    if (!formData.phone.trim()) {
      setFormError('Phone number is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      await createJobSeeker({
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        positionApplied: formData.positionApplied,
        notes: formData.notes.trim() || undefined,
        status: 'NEW',
      });
      setFormData({
        fullName: '',
        phone: '',
        positionApplied: 'Massage Therapist',
        notes: '',
      });
      setIsAddModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save candidate.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Candidate
  const handleDelete = (candidate: JobSeeker) => {
    Alert.alert(
      'Remove Candidate',
      `Are you sure you want to remove ${candidate.fullName} from job seekers? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteJobSeeker(candidate.id);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete candidate.');
            }
          },
        },
      ]
    );
  };

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    const s = status === 'SHORTLISTED' ? 'NEW' : status;
    const match = STATUS_OPTIONS.find((opt) => opt.value === s) || STATUS_OPTIONS[0];
    return match;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Header
        title="Job Seekers"
        subtitle={`Record of people applying for jobs at Omega Spa (${jobSeekers.length} total)`}
        onOpenMenu={onOpenMenu}
        rightAction={
          <TouchableOpacity
            onPress={() => setIsAddModalOpen(true)}
            style={styles.addBtn}
            activeOpacity={0.8}
          >
            <UserPlus size={15} color="#FFFFFF" />
            <Text style={styles.addBtnText}>+ Add Job Seeker</Text>
          </TouchableOpacity>
        }
      />

      {/* Search & Filters Bar */}
      <View style={styles.filterBar}>
        {/* Search Input */}
        <View style={styles.searchBox}>
          <Search size={15} color={THEME.colors.textMuted} style={styles.searchIcon} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name, phone or role..."
            placeholderTextColor={THEME.colors.textMuted}
            style={styles.searchInput}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
              <X size={14} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Dropdown Selectors */}
        <View style={styles.dropdownRow}>
          {/* Status Dropdown */}
          <TouchableOpacity
            style={styles.filterDropdown}
            onPress={() => setFilterPickerType('status')}
            activeOpacity={0.7}
          >
            <Text style={styles.filterDropdownText} numberOfLines={1}>
              {JOB_SEEKER_STATUSES.find((s) => s.value === selectedStatus)?.label || 'All Statuses'}
            </Text>
            <ChevronDown size={14} color={THEME.colors.textMuted} />
          </TouchableOpacity>

          {/* Position Dropdown */}
          <TouchableOpacity
            style={styles.filterDropdown}
            onPress={() => setFilterPickerType('position')}
            activeOpacity={0.7}
          >
            <Text style={styles.filterDropdownText} numberOfLines={1}>
              {selectedPosition === 'ALL' ? 'All Roles' : selectedPosition}
            </Text>
            <ChevronDown size={14} color={THEME.colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Candidate List / Table */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
          <Text style={styles.loadingText}>Loading recruitment candidates...</Text>
        </View>
      ) : filteredCandidates.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Users size={22} color={THEME.colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No candidates found</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery || selectedStatus !== 'ALL' || selectedPosition !== 'ALL'
              ? 'Try clearing your search or status filter.'
              : 'Click "+ Add Job Seeker" to record a new applicant.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredCandidates.map((candidate) => {
            const statusConfig = getStatusBadge(candidate.status);
            const initial = (candidate.fullName || 'C').charAt(0).toUpperCase();

            return (
              <View key={candidate.id} style={styles.candidateRowCard}>
                {/* Top Row: Avatar + Name + Status Dropdown + Delete */}
                <View style={styles.rowTop}>
                  <View style={styles.nameAvatarGroup}>
                    <View style={styles.initialAvatar}>
                      <Text style={styles.initialText}>{initial}</Text>
                    </View>
                    <View style={styles.namePhoneGroup}>
                      <Text style={styles.candidateName}>{candidate.fullName}</Text>
                      <View style={styles.phoneGroup}>
                        <Text style={styles.phoneText}>{candidate.phone}</Text>
                        {candidate.phone ? (
                          <View style={styles.callIcons}>
                            <TouchableOpacity
                              onPress={() => Linking.openURL(`tel:${candidate.phone}`).catch(() => {})}
                              style={styles.iconTinyBtn}
                            >
                              <Phone size={12} color={THEME.colors.primaryDark} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() =>
                                Linking.openURL(
                                  `whatsapp://send?phone=${candidate.phone.replace(/[^0-9]/g, '')}`
                                ).catch(() => {})
                              }
                              style={styles.iconTinyBtn}
                            >
                              <MessageSquare size={12} color="#25D366" />
                            </TouchableOpacity>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  {/* Actions: Status Dropdown Trigger & Delete Trash */}
                  <View style={styles.actionGroup}>
                    <TouchableOpacity
                      onPress={() => setStatusPickerCandidate(candidate)}
                      style={[
                        styles.statusSelectBtn,
                        {
                          backgroundColor: statusConfig.bg,
                          borderColor: statusConfig.border,
                        },
                      ]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.statusSelectText, { color: statusConfig.text }]}>
                        {statusConfig.label}
                      </Text>
                      <ChevronDown size={11} color={statusConfig.text} style={{ marginLeft: 3 }} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDelete(candidate)}
                      style={styles.trashBtn}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={15} color={THEME.colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Sub Row: Position Badge, Date, Notes */}
                <View style={styles.rowBottom}>
                  <View style={styles.positionBadge}>
                    <Text style={styles.positionBadgeText}>{candidate.positionApplied}</Text>
                  </View>

                  <Text style={styles.dateText}>
                    {formatDisplayDate(candidate.createdAt)}
                  </Text>
                </View>

                {candidate.notes ? (
                  <View style={styles.notesContainer}>
                    <Text style={styles.notesLabel}>Notes:</Text>
                    <Text style={styles.notesText}>{candidate.notes}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ===================================================================== */}
      {/* STATUS PICKER MODAL (4 Options: Applied, Interview, Hired, Rejected)   */}
      {/* ===================================================================== */}
      <Modal
        visible={!!statusPickerCandidate}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setStatusPickerCandidate(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setStatusPickerCandidate(null)}
        >
          <View style={styles.pickerModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Change Candidate Status</Text>
              <Text style={styles.pickerModalSub}>
                {statusPickerCandidate?.fullName}
              </Text>
            </View>

            <View style={styles.pickerOptionsList}>
              {STATUS_OPTIONS.map((opt) => {
                const currentStatus =
                  statusPickerCandidate?.status === 'SHORTLISTED'
                    ? 'NEW'
                    : statusPickerCandidate?.status;
                const isCurrent = currentStatus === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.pickerOptionRow,
                      isCurrent && { backgroundColor: opt.bg },
                    ]}
                    onPress={async () => {
                      if (statusPickerCandidate) {
                        const candId = statusPickerCandidate.id;
                        setStatusPickerCandidate(null);
                        try {
                          await updateJobSeekerStatus(candId, opt.value as any);
                        } catch (err: any) {
                          Alert.alert('Error', err?.message || 'Failed to update status.');
                        }
                      }
                    }}
                  >
                    <View style={styles.optLabelBox}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: opt.text },
                        ]}
                      />
                      <Text
                        style={[
                          styles.pickerOptionText,
                          isCurrent && { color: opt.text, fontWeight: '700' },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </View>
                    {isCurrent && <Check size={16} color={opt.text} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.cancelPickerBtn}
              onPress={() => setStatusPickerCandidate(null)}
            >
              <Text style={styles.cancelPickerText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ===================================================================== */}
      {/* FILTER PICKER MODAL (Status or Position)                              */}
      {/* ===================================================================== */}
      <Modal
        visible={!!filterPickerType}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFilterPickerType(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFilterPickerType(null)}
        >
          <View style={styles.pickerModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>
                {filterPickerType === 'status' ? 'Filter by Status' : 'Filter by Role'}
              </Text>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {filterPickerType === 'status'
                ? JOB_SEEKER_STATUSES.map((st) => (
                    <TouchableOpacity
                      key={st.value}
                      style={[
                        styles.pickerOptionRow,
                        selectedStatus === st.value && styles.pickerOptionActive,
                      ]}
                      onPress={() => {
                        setSelectedStatus(st.value);
                        setFilterPickerType(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          selectedStatus === st.value && styles.pickerOptionTextActive,
                        ]}
                      >
                        {st.label}
                      </Text>
                      {selectedStatus === st.value && (
                        <Check size={16} color={THEME.colors.primaryDark} />
                      )}
                    </TouchableOpacity>
                  ))
                : [
                    { value: 'ALL', label: 'All Roles' },
                    ...JOB_SEEKER_POSITIONS.map((p) => ({ value: p, label: p })),
                  ].map((roleOpt) => (
                    <TouchableOpacity
                      key={roleOpt.value}
                      style={[
                        styles.pickerOptionRow,
                        selectedPosition === roleOpt.value && styles.pickerOptionActive,
                      ]}
                      onPress={() => {
                        setSelectedPosition(roleOpt.value);
                        setFilterPickerType(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          selectedPosition === roleOpt.value && styles.pickerOptionTextActive,
                        ]}
                      >
                        {roleOpt.label}
                      </Text>
                      {selectedPosition === roleOpt.value && (
                        <Check size={16} color={THEME.colors.primaryDark} />
                      )}
                    </TouchableOpacity>
                  ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.cancelPickerBtn}
              onPress={() => setFilterPickerType(null)}
            >
              <Text style={styles.cancelPickerText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ===================================================================== */}
      {/* ADD JOB SEEKER MODAL (Exact match with Web Software)                  */}
      {/* ===================================================================== */}
      <Modal
        visible={isAddModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsAddModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsAddModalOpen(false)}
        >
          <View style={styles.addModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.addModalHeader}>
              <Text style={styles.addModalTitle}>Add Job Seeker</Text>
              <TouchableOpacity onPress={() => setIsAddModalOpen(false)} style={styles.closeModalBtn}>
                <X size={18} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              {formError ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{formError}</Text>
                </View>
              ) : null}

              {/* Full Name */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>
                  Full Name <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  value={formData.fullName}
                  onChangeText={(val) => setFormData((prev) => ({ ...prev, fullName: val }))}
                  placeholder="e.g. Marie Claire Mbida"
                  placeholderTextColor={THEME.colors.textMuted}
                  style={styles.formInput}
                />
              </View>

              {/* Phone */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>
                  Phone Number <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  value={formData.phone}
                  onChangeText={(val) => setFormData((prev) => ({ ...prev, phone: val }))}
                  placeholder="6XXXXXXXX"
                  placeholderTextColor={THEME.colors.textMuted}
                  keyboardType="phone-pad"
                  style={styles.formInput}
                />
              </View>

              {/* Position Applied */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Position Applied</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.positionChips}>
                  {JOB_SEEKER_POSITIONS.map((pos) => {
                    const isSelected = formData.positionApplied === pos;
                    return (
                      <TouchableOpacity
                        key={pos}
                        onPress={() => setFormData((prev) => ({ ...prev, positionApplied: pos }))}
                        style={[styles.positionChip, isSelected && styles.positionChipActive]}
                      >
                        <Text
                          style={[
                            styles.positionChipText,
                            isSelected && styles.positionChipTextActive,
                          ]}
                        >
                          {pos}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Notes */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Notes (optional)</Text>
                <TextInput
                  value={formData.notes}
                  onChangeText={(val) => setFormData((prev) => ({ ...prev, notes: val }))}
                  placeholder="Experience details, certificates, who referred them, etc."
                  placeholderTextColor={THEME.colors.textMuted}
                  multiline
                  numberOfLines={3}
                  style={[styles.formInput, styles.textAreaInput]}
                />
              </View>

              {/* Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setIsAddModalOpen(false)}
                  style={styles.cancelBtn}
                  disabled={isSubmitting}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleCreateSubmit}
                  style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitBtnText}>Save Candidate</Text>
                  )}
                </TouchableOpacity>
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
    backgroundColor: THEME.colors.background,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radii.md,
    ...THEME.shadows.sm,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filterBar: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    gap: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 9,
    paddingHorizontal: 10,
    height: 38,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: THEME.colors.text,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  dropdownRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 9,
    paddingHorizontal: 10,
    height: 36,
  },
  filterDropdownText: {
    fontSize: 12,
    color: THEME.colors.text,
    fontWeight: '600',
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: THEME.colors.primarySoft,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    maxWidth: 260,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: THEME.spacing.md,
    gap: 10,
    paddingBottom: 24,
  },
  candidateRowCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 12,
    padding: 12,
    ...THEME.shadows.sm,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  nameAvatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  initialAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EAF2E8',
    borderWidth: 1,
    borderColor: '#C2D6BF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F6748',
  },
  namePhoneGroup: {
    flex: 1,
  },
  candidateName: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  phoneGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  phoneText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  callIcons: {
    flexDirection: 'row',
    gap: 4,
  },
  iconTinyBtn: {
    padding: 2,
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusSelectText: {
    fontSize: 11,
    fontWeight: '700',
  },
  trashBtn: {
    padding: 6,
    borderRadius: 6,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  positionBadge: {
    backgroundColor: '#EAF2E8',
    borderColor: '#C2D6BF',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  positionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4F6748',
  },
  dateText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  notesContainer: {
    marginTop: 6,
    padding: 6,
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
  },
  notesLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    marginBottom: 2,
  },
  notesText: {
    fontSize: 11,
    color: THEME.colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  pickerModalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    ...THEME.shadows.md,
  },
  pickerModalHeader: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    paddingBottom: 8,
  },
  pickerModalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  pickerModalSub: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  pickerOptionsList: {
    gap: 4,
  },
  pickerOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  pickerOptionActive: {
    backgroundColor: THEME.colors.primarySoft,
  },
  optLabelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pickerOptionText: {
    fontSize: 13,
    color: THEME.colors.text,
    fontWeight: '500',
  },
  pickerOptionTextActive: {
    color: THEME.colors.primaryDark,
    fontWeight: '700',
  },
  cancelPickerBtn: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  cancelPickerText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  addModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    maxHeight: '90%',
    overflow: 'hidden',
    ...THEME.shadows.lg,
  },
  addModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    backgroundColor: '#FBFBFA',
  },
  addModalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  closeModalBtn: {
    padding: 4,
  },
  formScroll: {
    padding: 16,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorBannerText: {
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '600',
  },
  formField: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.text,
    marginBottom: 6,
  },
  requiredStar: {
    color: THEME.colors.danger,
  },
  formInput: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 9,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 13,
    color: THEME.colors.text,
  },
  textAreaInput: {
    height: 70,
    textAlignVertical: 'top',
    paddingVertical: 8,
  },
  positionChips: {
    flexDirection: 'row',
  },
  positionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
  },
  positionChipActive: {
    backgroundColor: THEME.colors.primaryDark,
  },
  positionChipText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  positionChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    paddingBottom: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  submitBtn: {
    flex: 2,
    height: 40,
    backgroundColor: THEME.colors.primary,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default JobSeekersScreen;
