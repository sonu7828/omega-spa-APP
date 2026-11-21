/**
 * StaffManagementScreen — 1-to-1 Match with Omega Spa POS Web Software
 * Matches frontend/src/pages/Staff.jsx & Web View Screenshot:
 * - Top Action Buttons:
 *     - [ 🏷 Specialties ] (toggle specialty management panel)
 *     - [ +👤 Add Staff ] (opens Add Staff modal)
 * - Specialty Management Panel:
 *     - Add new specialty input + [ + Add ] button
 *     - List of specialties with Edit, Deactivate/Activate, Delete
 * - Active Staff Section:
 *     - Title: "ACTIVE STAFF (X)"
 *     - Mobile Card Layout:
 *         - Staff Name & Role Badge (Manager, Reception, Technician, Cleaner, Marketer)
 *         - Email · Phone in a single row
 *         - Specialty pills (e.g. Nail Tech, Body Massage)
 *         - Target & Salary Box:
 *             - Manager: "Salary: X FCFA" / "Monthly Fixed Remuneration (Management)"
 *             - Technician: "Target: X FCFA (Indiv)" / "Y% comm · Base: Z · Fixed: W"
 *         - Action Buttons Row:
 *             - [ 📄 Contract ] -> Opens Edit Salary & Target Contract Modal
 *             - [ ✏ Edit ] -> Opens Edit Staff Modal
 *             - [ ⟳ Reset PW ] -> Opens Reset Password Modal
 *             - [ 🛡 Penalty ] -> Opens Record Disciplinary Penalty Modal (for technicians)
 *             - [ 👤- Deact ] -> Deactivates staff member
 * - Deactivated Staff Section:
 *     - Title: "DEACTIVATED (X)"
 *     - Deactivated member info + [ 👤+ Activate ] button
 *
 * ZERO INVENTED CONTENT:
 * - No circle letter avatars (AR, MI, SA)
 * - No active/inactive toggle switch
 * - No separate custom tabs or filter pills
 * - Exact 1-to-1 parity with web POS software.
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
  RefreshControl,
} from 'react-native';
import {
  UserPlus,
  Tags,
  Pencil,
  RotateCcw,
  ShieldAlert,
  UserX,
  UserCheck,
  Calculator,
  X,
  Check,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Calendar,
  AlertTriangle,
} from 'lucide-react-native';
import Header from '../components/Header';
import Card from '../components/Card';
import { usersApi, specialtiesApi, penaltiesApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface SpecialtyItem {
  id: string;
  name: string;
  active: boolean;
}

interface StaffUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  username?: string;
  role: string;
  specialties: string[];
  active: boolean;
  salaryContract?: {
    monthlyTarget?: number;
    fixedSalary?: number;
    basePay?: number;
    commissionRate?: number;
    targetScope?: string;
  };
}

const ROLES = [
  { value: 'manager', label: 'Manager' },
  { value: 'reception', label: 'Reception' },
  { value: 'technician', label: 'Technician' },
  { value: 'marketer', label: 'Marketer' },
  { value: 'cleaner', label: 'Cleaner' },
];

const STANDARD_PENALTY_RULES = [
  { id: 'late_coming', name: 'Late coming', defaultAmount: 2000 },
  { id: 'no_show', name: 'No show / Missed work', defaultAmount: 5000 },
  { id: 'not_dressed_properly', name: 'Not dressed properly', defaultAmount: 2000 },
  { id: 'rude_to_clients', name: 'Rude / Disrespectful to clients', defaultAmount: 5000 },
  { id: 'sitting_in_rooms', name: 'Sitting / Hiding in rooms', defaultAmount: 2500 },
];

export const StaffManagementScreen: React.FC<{ onOpenMenu?: () => void }> = ({ onOpenMenu }) => {
  const { user } = useAuth();
  const isManager = (user?.role || '').toLowerCase() === 'manager';

  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [specialties, setSpecialties] = useState<SpecialtyItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Specialty panel toggle
  const [showSpecialtyPanel, setShowSpecialtyPanel] = useState<boolean>(false);
  const [newSpecialtyName, setNewSpecialtyName] = useState<string>('');
  const [specialtyError, setSpecialtyError] = useState<string>('');
  const [editingSpecId, setEditingSpecId] = useState<string | null>(null);
  const [editingSpecName, setEditingSpecName] = useState<string>('');

  // Add / Edit Staff Modal
  const [showStaffModal, setShowStaffModal] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formRole, setFormRole] = useState<string>('technician');
  const [formPassword, setFormPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [formSpecs, setFormSpecs] = useState<string[]>([]);
  const [formError, setFormError] = useState<string>('');
  const [submittingStaff, setSubmittingStaff] = useState<boolean>(false);

  // Reset Password Modal
  const [resetModalUser, setResetModalUser] = useState<StaffUser | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [showNewPw, setShowNewPw] = useState<boolean>(false);
  const [resettingPw, setResettingPw] = useState<boolean>(false);

  // Salary & Target Contract Modal
  const [contractStaff, setContractStaff] = useState<StaffUser | null>(null);
  const [contractTarget, setContractTarget] = useState<string>('525000');
  const [contractFixed, setContractFixed] = useState<string>('110000');
  const [contractBase, setContractBase] = useState<string>('50000');
  const [contractRate, setContractRate] = useState<string>('15');
  const [contractScope, setContractScope] = useState<'INDIVIDUAL' | 'SPA_TOTAL'>('INDIVIDUAL');
  const [contractError, setContractError] = useState<string>('');
  const [submittingContract, setSubmittingContract] = useState<boolean>(false);

  // Disciplinary Penalty Modal
  const [penaltyStaff, setPenaltyStaff] = useState<StaffUser | null>(null);
  const [selectedPenaltyRule, setSelectedPenaltyRule] = useState<string>('late_coming');
  const [penaltyAmount, setPenaltyAmount] = useState<string>('2000');
  const [penaltyDate, setPenaltyDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [penaltyNotes, setPenaltyNotes] = useState<string>('');
  const [penaltyError, setPenaltyError] = useState<string>('');
  const [submittingPenalty, setSubmittingPenalty] = useState<boolean>(false);

  // Load all users and specialties from backend
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, specsRes] = await Promise.all([
        usersApi.getAll().catch(() => null),
        specialtiesApi.getAll().catch(() => null),
      ]);

      if (usersRes) {
        const raw = usersRes.data || (Array.isArray(usersRes) ? usersRes : []);
        const mapped: StaffUser[] = raw.map((u: any) => {
          const salary = u.salaryContract || u.staffProfile?.salaryContract || {};
          return {
            id: String(u.id),
            name: u.name || u.staffProfile?.name || u.email?.split('@')[0] || 'Staff',
            email: u.email || '',
            phone: u.phone || u.staffProfile?.phone || '',
            username: u.username || '',
            role: String(u.role?.name || u.role || 'technician').toLowerCase(),
            specialties: Array.isArray(u.specialties)
              ? u.specialties
              : Array.isArray(u.staffProfile?.specialties)
              ? u.staffProfile.specialties
              : [],
            active: u.isActive !== undefined ? Boolean(u.isActive) : u.active !== false,
            salaryContract: {
              monthlyTarget: Number(salary.monthlyTarget || 0),
              fixedSalary: Number(salary.fixedSalary || 0),
              basePay: Number(salary.basePay || 0),
              commissionRate: Number(salary.commissionRate || 15),
              targetScope: salary.targetScope || 'INDIVIDUAL',
            },
          };
        });
        setStaffList(mapped);
      }

      if (specsRes) {
        const rawSpecs = specsRes.data || (Array.isArray(specsRes) ? specsRes : []);
        const mappedSpecs: SpecialtyItem[] = rawSpecs.map((s: any, idx: number) => ({
          id: String(s.id || `spec-${idx}`),
          name: typeof s === 'string' ? s : s.name,
          active: s.active !== false && s.isActive !== false,
        }));
        setSpecialties(mappedSpecs);
      }
    } catch (e: any) {
      console.warn('Failed to load staff list:', e?.message || e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeUsers = useMemo(() => staffList.filter((u) => u.active !== false), [staffList]);
  const deactivatedUsers = useMemo(() => staffList.filter((u) => u.active === false), [staffList]);

  // Open Add Modal
  const openAddModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormRole('technician');
    setFormPassword('');
    setShowPassword(false);
    setFormSpecs([]);
    setFormError('');
    setShowStaffModal(true);
  };

  // Open Edit Modal
  const openEditModal = (u: StaffUser) => {
    setEditingUser(u);
    setFormName(u.name || '');
    setFormEmail(u.email || '');
    setFormPhone(u.phone || '');
    setFormRole(u.role || 'technician');
    setFormPassword('');
    setShowPassword(false);
    setFormSpecs(Array.isArray(u.specialties) ? u.specialties : []);
    setFormError('');
    setShowStaffModal(true);
  };

  // Toggle specialty in form
  const toggleFormSpecialty = (specName: string) => {
    setFormSpecs((prev) =>
      prev.includes(specName) ? prev.filter((s) => s !== specName) : [...prev, specName]
    );
  };

  // Save Staff (Add / Edit)
  const handleSaveStaff = async () => {
    if (!formName.trim() || !formEmail.trim()) {
      setFormError('Please enter both Full Name and Email Address.');
      return;
    }

    if (!editingUser && !formPassword.trim()) {
      setFormError('Password is required for new staff account.');
      return;
    }

    if (!editingUser && formPassword.trim().length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    if (formRole === 'technician' && formSpecs.length === 0) {
      setFormError('Please select at least one specialty for technician.');
      return;
    }

    setSubmittingStaff(true);
    setFormError('');
    try {
      const emailVal = formEmail.trim().toLowerCase();
      const phoneVal = formPhone.trim();
      const isMarketer = formRole === 'marketer';
      const effectiveSpecialties = isMarketer
        ? ['Marketer']
        : formRole === 'technician'
        ? formSpecs
        : [];

      if (editingUser) {
        const updates: any = {
          name: formName.trim(),
          email: emailVal,
          phone: phoneVal || null,
          role: formRole,
          specialties: effectiveSpecialties,
        };
        if (formPassword.trim()) {
          updates.password = formPassword.trim();
        }
        await usersApi.update(editingUser.id, updates);
        Alert.alert('Success', 'Staff member updated successfully.');
      } else {
        await usersApi.create({
          name: formName.trim(),
          email: emailVal,
          phone: phoneVal || null,
          role: formRole,
          password: formPassword.trim(),
          specialties: effectiveSpecialties,
        });
        Alert.alert('Success', 'New staff account created successfully.');
      }

      setShowStaffModal(false);
      loadData();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save staff record.');
    } finally {
      setSubmittingStaff(false);
    }
  };

  // Open Reset Password Modal
  const openResetModal = (u: StaffUser) => {
    setResetModalUser(u);
    setNewPasswordInput('');
    setShowNewPw(false);
  };

  const handleConfirmResetPassword = async () => {
    if (!resetModalUser || !newPasswordInput.trim()) {
      Alert.alert('Error', 'Please enter a new password.');
      return;
    }
    if (newPasswordInput.trim().length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }

    setResettingPw(true);
    try {
      await usersApi.update(resetModalUser.id, { password: newPasswordInput.trim() });
      Alert.alert('Password Reset', `Password for ${resetModalUser.name} has been updated.`);
      setResetModalUser(null);
      setNewPasswordInput('');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to reset password.');
    } finally {
      setResettingPw(false);
    }
  };

  // Deactivate User
  const handleDeactivateUser = (u: StaffUser) => {
    Alert.alert(
      'Deactivate Staff',
      `Are you sure you want to deactivate ${u.name}? They will lose access to Omega Spa POS.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              await usersApi.update(u.id, { active: false, isActive: false });
              loadData();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to deactivate staff member.');
            }
          },
        },
      ]
    );
  };

  // Activate User
  const handleActivateUser = async (u: StaffUser) => {
    try {
      await usersApi.update(u.id, { active: true, isActive: true });
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to activate staff member.');
    }
  };

  // Open Salary Contract Modal
  const openSalaryContract = (u: StaffUser) => {
    setContractStaff(u);
    const contract = u.salaryContract || {};
    const isMgr = u.role === 'manager';

    if (isMgr) {
      setContractFixed(String(contract.fixedSalary || 300000));
      setContractTarget('0');
      setContractBase(String(contract.fixedSalary || 300000));
      setContractRate('0');
      setContractScope('SPA_TOTAL');
    } else {
      setContractTarget(String(contract.monthlyTarget || 525000));
      setContractFixed(String(contract.fixedSalary || 110000));
      setContractBase(String(contract.basePay || 50000));
      setContractRate(String(contract.commissionRate || 15));
      setContractScope((contract.targetScope as any) || 'INDIVIDUAL');
    }
    setContractError('');
  };

  const handleSaveContract = async () => {
    if (!contractStaff) return;
    setSubmittingContract(true);
    setContractError('');

    try {
      const fixedNum = Number(contractFixed) || 0;
      const targetNum = Number(contractTarget) || 0;
      const baseNum = Number(contractBase) || 0;
      const commNum = Number(contractRate) || 0;

      await usersApi.updateSalaryContract(contractStaff.id, {
        monthlyTarget: contractStaff.role === 'manager' ? 0 : targetNum,
        basePay: contractStaff.role === 'manager' ? fixedNum : baseNum,
        commissionRate: contractStaff.role === 'manager' ? 0 : commNum,
        fixedSalary: fixedNum,
        targetScope: contractScope,
      });

      Alert.alert('Contract Updated', `Salary & target terms saved for ${contractStaff.name}.`);
      setContractStaff(null);
      loadData();
    } catch (err: any) {
      setContractError(err?.message || 'Failed to save salary contract terms.');
    } finally {
      setSubmittingContract(false);
    }
  };

  // Open Record Penalty Modal
  const openPenaltyModal = (u: StaffUser) => {
    setPenaltyStaff(u);
    setSelectedPenaltyRule('late_coming');
    setPenaltyAmount('2000');
    setPenaltyDate(new Date().toISOString().slice(0, 10));
    setPenaltyNotes('');
    setPenaltyError('');
  };

  const handlePenaltyRuleChange = (ruleId: string) => {
    setSelectedPenaltyRule(ruleId);
    const matched = STANDARD_PENALTY_RULES.find((r) => r.id === ruleId);
    if (matched) {
      setPenaltyAmount(String(matched.defaultAmount));
    }
  };

  const handleSavePenalty = async () => {
    if (!penaltyStaff) return;
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
        staffId: penaltyStaff.id,
        ruleName,
        penaltyAmount: amountNum,
        date: penaltyDate,
        notes: penaltyNotes.trim() || undefined,
      });

      Alert.alert(
        'Penalty Recorded',
        `Disciplinary penalty of ${amountNum.toLocaleString()} FCFA recorded for ${penaltyStaff.name}.`
      );
      setPenaltyStaff(null);
    } catch (err: any) {
      setPenaltyError(err?.message || 'Failed to record penalty.');
    } finally {
      setSubmittingPenalty(false);
    }
  };

  // Specialty Management Handlers
  const handleAddSpecialty = async () => {
    const trimmed = newSpecialtyName.trim();
    if (!trimmed) {
      setSpecialtyError('Specialty name cannot be empty.');
      return;
    }
    try {
      await specialtiesApi.create({ name: trimmed });
      setNewSpecialtyName('');
      setSpecialtyError('');
      loadData();
    } catch (err: any) {
      setSpecialtyError(err?.message || 'Failed to add specialty.');
    }
  };

  const handleToggleSpecialtyActive = async (spec: SpecialtyItem) => {
    try {
      await specialtiesApi.update(spec.id, { active: !spec.active, isActive: !spec.active });
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to toggle specialty.');
    }
  };

  const handleDeleteSpecialty = (spec: SpecialtyItem) => {
    Alert.alert(
      'Delete Specialty',
      `Are you sure you want to delete "${spec.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await specialtiesApi.delete(spec.id);
              loadData();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete specialty.');
            }
          },
        },
      ]
    );
  };

  // Helper for role pill styling (exact match with Web View)
  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'manager':
        return { bg: '#EBF3EC', text: '#4F6748', border: '#CFE2D2' };
      case 'reception':
        return { bg: '#E8EFF8', text: '#4A6B8A', border: '#CFDCED' };
      case 'technician':
        return { bg: '#FAECEC', text: '#C25E5E', border: '#F2D6D6' };
      case 'marketer':
        return { bg: '#EDE9FE', text: '#6D28D9', border: '#DDD6FE' };
      case 'cleaner':
        return { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' };
      default:
        return { bg: '#FAF8F5', text: '#2D2D2A', border: '#E8E2D9' };
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Header — Exact Web Match */}
      <Header
        title="Staff / Users"
        subtitle="Manage team members, roles, specialties, and access permissions."
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
        {/* 2. Top Action Buttons (Exact Image 2 Match: Specialties & Add Staff) */}
        {isManager && (
          <View style={styles.topActionRow}>
            {/* Specialties Button (White card) */}
            <TouchableOpacity
              onPress={() => setShowSpecialtyPanel((v) => !v)}
              style={styles.specialtiesBtn}
              activeOpacity={0.8}
            >
              <Tags size={15} color="#2D2D2A" />
              <Text style={styles.specialtiesBtnText}>Specialties</Text>
            </TouchableOpacity>

            {/* Add Staff Button (Solid Sage Green) */}
            <TouchableOpacity
              onPress={openAddModal}
              style={styles.addStaffBtn}
              activeOpacity={0.8}
            >
              <UserPlus size={16} color="#FFFFFF" strokeWidth={2} />
              <Text style={styles.addStaffBtnText}>Add Staff</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 3. Specialty Management Panel (When Toggled) */}
        {showSpecialtyPanel && isManager && (
          <Card style={styles.specialtyPanelCard}>
            <View style={styles.panelHeaderRow}>
              <Text style={styles.panelTitle}>Manage Specialties</Text>
              <TouchableOpacity onPress={() => setShowSpecialtyPanel(false)}>
                <X size={16} color="#71717A" />
              </TouchableOpacity>
            </View>

            {/* Add Specialty Input Row */}
            <View style={styles.addSpecRow}>
              <TextInput
                value={newSpecialtyName}
                onChangeText={(t) => {
                  setNewSpecialtyName(t);
                  setSpecialtyError('');
                }}
                placeholder="New specialty name..."
                placeholderTextColor="#A1A1AA"
                style={styles.specInput}
              />
              <TouchableOpacity onPress={handleAddSpecialty} style={styles.addSpecBtn}>
                <Plus size={14} color="#FFFFFF" />
                <Text style={styles.addSpecBtnText}>Add</Text>
              </TouchableOpacity>
            </View>

            {specialtyError ? (
              <Text style={styles.specErrorText}>{specialtyError}</Text>
            ) : null}

            {/* Specialties List */}
            <View style={styles.specsList}>
              {specialties.map((spec) => (
                <View
                  key={spec.id}
                  style={[styles.specItemRow, !spec.active && styles.specItemRowInactive]}
                >
                  <Text
                    style={[
                      styles.specItemName,
                      !spec.active && styles.specItemNameInactive,
                    ]}
                  >
                    {spec.name}
                  </Text>
                  <View style={styles.specActionBtns}>
                    <TouchableOpacity
                      onPress={() => handleToggleSpecialtyActive(spec)}
                      style={[
                        styles.specToggleBtn,
                        spec.active ? styles.specToggleBtnDeact : styles.specToggleBtnAct,
                      ]}
                    >
                      <Text
                        style={[
                          styles.specToggleBtnText,
                          spec.active ? styles.specToggleBtnTextDeact : styles.specToggleBtnTextAct,
                        ]}
                      >
                        {spec.active ? 'Deactivate' : 'Activate'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDeleteSpecialty(spec)}
                      style={styles.specDeleteBtn}
                    >
                      <Trash2 size={12} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* 4. Active Staff Section Card (Exact 1:1 Match with Web View Screenshot) */}
        <Card style={styles.staffContainerCard}>
          {/* Card Title Header: ACTIVE STAFF (18) */}
          <View style={styles.staffHeaderRow}>
            <Text style={styles.staffCardTitle}>
              ACTIVE STAFF ({activeUsers.length})
            </Text>
          </View>

          {/* Staff Members List */}
          {activeUsers.map((u, idx) => {
            const roleStyle = getRoleBadgeStyle(u.role);
            const isTechnician = u.role === 'technician';
            const isManagerRole = u.role === 'manager';
            const hasSalary = isManagerRole && Number(u.salaryContract?.fixedSalary || 0) > 0;
            const hasTarget =
              !isManagerRole &&
              (Number(u.salaryContract?.monthlyTarget || 0) > 0 ||
                Number(u.salaryContract?.fixedSalary || 0) > 0);

            return (
              <View
                key={u.id}
                style={[
                  styles.staffCardItem,
                  idx !== activeUsers.length - 1 && styles.staffCardItemBorder,
                ]}
              >
                {/* Row 1: Name & Subtitle on left, Role Badge on right */}
                <View style={styles.staffTopRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.staffName}>{u.name}</Text>
                    <Text style={styles.staffSubInfo} numberOfLines={1}>
                      {u.email} {u.phone ? `· ${u.phone}` : ''}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.roleBadge,
                      {
                        backgroundColor: roleStyle.bg,
                        borderColor: roleStyle.border,
                      },
                    ]}
                  >
                    <Text style={[styles.roleBadgeText, { color: roleStyle.text }]}>
                      {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                    </Text>
                  </View>
                </View>

                {/* Row 2: Specialties Pills (e.g. Nail Tech, Body Massage) */}
                {u.specialties && u.specialties.length > 0 && (
                  <View style={styles.specialtiesPillsRow}>
                    {u.specialties.map((spec, sIdx) => (
                      <View key={`${spec}-${sIdx}`} style={styles.specialtyPill}>
                        <Text style={styles.specialtyPillText}>{spec}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Row 3: Target & Salary Contract Box (Exact Web View Match) */}
                {isManagerRole ? (
                  hasSalary ? (
                    <View style={styles.salaryBoxManager}>
                      <Text style={styles.salaryTitleManager}>
                        Salary: {Number(u.salaryContract?.fixedSalary || 0).toLocaleString()} FCFA
                      </Text>
                      <Text style={styles.salarySubManager}>
                        Monthly Fixed Remuneration (Management)
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.pendingBadgeBox}>
                      <Text style={styles.pendingBadgeText}>Pending Salary</Text>
                    </View>
                  )
                ) : hasTarget ? (
                  <View style={styles.salaryBoxTech}>
                    <Text style={styles.salaryTitleTech}>
                      Target: {Number(u.salaryContract?.monthlyTarget || 0).toLocaleString()} FCFA (
                      {u.salaryContract?.targetScope === 'SPA_TOTAL' ? 'Spa' : 'Indiv'})
                    </Text>
                    <Text style={styles.salarySubTech}>
                      {u.salaryContract?.commissionRate || 15}% comm · Base:{' '}
                      {Number(u.salaryContract?.basePay || 0).toLocaleString()} · Fixed:{' '}
                      {Number(u.salaryContract?.fixedSalary || 0).toLocaleString()}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.pendingBadgeBox}>
                    <Text style={styles.pendingBadgeText}>Pending Contract</Text>
                  </View>
                )}

                {/* Row 4: Action Buttons (Manager Only, Exact Web Buttons) */}
                {isManager && (
                  <View style={styles.actionButtonsContainer}>
                    {/* First Row of Action Buttons */}
                    <View style={styles.actionButtonsRow}>
                      {/* [ 📄 Contract ] */}
                      <TouchableOpacity
                        onPress={() => openSalaryContract(u)}
                        style={styles.contractBtn}
                        activeOpacity={0.7}
                      >
                        <Calculator size={12} color="#065F46" />
                        <Text style={styles.contractBtnText}>Contract</Text>
                      </TouchableOpacity>

                      {/* [ ✏ Edit ] */}
                      <TouchableOpacity
                        onPress={() => openEditModal(u)}
                        style={styles.editBtn}
                        activeOpacity={0.7}
                      >
                        <Pencil size={12} color="#2D2D2A" />
                        <Text style={styles.editBtnText}>Edit</Text>
                      </TouchableOpacity>

                      {/* [ ⟳ Reset PW ] */}
                      <TouchableOpacity
                        onPress={() => openResetModal(u)}
                        style={styles.resetPwBtn}
                        activeOpacity={0.7}
                      >
                        <RotateCcw size={11} color="#71717A" />
                        <Text style={styles.resetPwBtnText}>Reset PW</Text>
                      </TouchableOpacity>

                      {/* [ 🛡 Penalty ] (Technicians only) */}
                      {isTechnician && (
                        <TouchableOpacity
                          onPress={() => openPenaltyModal(u)}
                          style={styles.penaltyBtn}
                          activeOpacity={0.7}
                        >
                          <ShieldAlert size={12} color="#BE123C" />
                          <Text style={styles.penaltyBtnText}>Penalty</Text>
                        </TouchableOpacity>
                      )}

                      {/* [ 👤- Deact ] (In Row 1 for non-technicians) */}
                      {!isTechnician && (
                        <TouchableOpacity
                          onPress={() => handleDeactivateUser(u)}
                          style={styles.deactBtn}
                          activeOpacity={0.7}
                        >
                          <UserX size={12} color="#B91C1C" />
                          <Text style={styles.deactBtnText}>Deact</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Second Row: [ 👤- Deact ] full width for technicians */}
                    {isTechnician && (
                      <TouchableOpacity
                        onPress={() => handleDeactivateUser(u)}
                        style={styles.deactBtnFull}
                        activeOpacity={0.7}
                      >
                        <UserX size={12} color="#B91C1C" />
                        <Text style={styles.deactBtnText}>Deact</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </Card>

        {/* 5. Deactivated Staff Section (If Any) */}
        {deactivatedUsers.length > 0 && (
          <Card style={[styles.staffContainerCard, { marginTop: 16 }]}>
            <View style={styles.staffHeaderRow}>
              <Text style={[styles.staffCardTitle, { color: '#71717A' }]}>
                DEACTIVATED ({deactivatedUsers.length})
              </Text>
            </View>

            {deactivatedUsers.map((u, idx) => (
              <View
                key={u.id}
                style={[
                  styles.staffCardItem,
                  idx !== deactivatedUsers.length - 1 && styles.staffCardItemBorder,
                  { opacity: 0.7 },
                ]}
              >
                <View style={styles.staffTopRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.staffName, { textDecorationLine: 'line-through', color: '#71717A' }]}>
                      {u.name}
                    </Text>
                    <Text style={styles.staffSubInfo}>
                      {u.email} {u.phone ? `· ${u.phone}` : ''}
                    </Text>
                  </View>

                  {isManager && (
                    <TouchableOpacity
                      onPress={() => handleActivateUser(u)}
                      style={styles.activateBtn}
                      activeOpacity={0.7}
                    >
                      <UserCheck size={12} color="#065F46" />
                      <Text style={styles.activateBtnText}>Activate</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      {/* 6. Add / Edit Staff Modal */}
      <Modal visible={showStaffModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingUser ? 'Edit Staff Member' : 'Add New Staff Member'}
              </Text>
              <TouchableOpacity onPress={() => setShowStaffModal(false)}>
                <X size={18} color="#2D2D2A" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Full Name */}
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                value={formName}
                onChangeText={setFormName}
                placeholder="e.g. Samira Djouwa"
                placeholderTextColor="#A1A1AA"
                style={styles.modalInput}
              />

              {/* Email */}
              <Text style={styles.inputLabel}>Email Address *</Text>
              <TextInput
                value={formEmail}
                onChangeText={setFormEmail}
                placeholder="e.g. samira@omegaspa.com"
                placeholderTextColor="#A1A1AA"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.modalInput}
              />

              {/* Phone */}
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                value={formPhone}
                onChangeText={setFormPhone}
                placeholder="+2376XXXXXXXX"
                placeholderTextColor="#A1A1AA"
                keyboardType="phone-pad"
                style={styles.modalInput}
              />

              {/* Role Picker */}
              <Text style={styles.inputLabel}>Staff Role *</Text>
              <View style={styles.rolePickerRow}>
                {ROLES.map((r) => {
                  const isSelected = formRole === r.value;
                  return (
                    <TouchableOpacity
                      key={r.value}
                      onPress={() => setFormRole(r.value)}
                      style={[styles.roleSelectPill, isSelected && styles.roleSelectPillActive]}
                    >
                      <Text
                        style={[
                          styles.roleSelectPillText,
                          isSelected && styles.roleSelectPillTextActive,
                        ]}
                      >
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Password */}
              <Text style={styles.inputLabel}>
                {editingUser ? 'Change Password (Leave blank to keep current)' : 'Password *'}
              </Text>
              <View style={styles.passwordInputWrap}>
                <TextInput
                  value={formPassword}
                  onChangeText={setFormPassword}
                  placeholder={editingUser ? '••••••••' : 'Minimum 6 characters'}
                  placeholderTextColor="#A1A1AA"
                  secureTextEntry={!showPassword}
                  style={styles.passwordInput}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eyeBtn}
                >
                  {showPassword ? (
                    <EyeOff size={16} color="#71717A" />
                  ) : (
                    <Eye size={16} color="#71717A" />
                  )}
                </TouchableOpacity>
              </View>

              {/* Specialties Multi-select (For Technicians) */}
              {formRole === 'technician' && (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.inputLabel}>Technician Specialties *</Text>
                  <View style={styles.specMultiSelectRow}>
                    {specialties
                      .filter((s) => s.active)
                      .map((s) => {
                        const isSelected = formSpecs.includes(s.name);
                        return (
                          <TouchableOpacity
                            key={s.id}
                            onPress={() => toggleFormSpecialty(s.name)}
                            style={[
                              styles.specMultiPill,
                              isSelected && styles.specMultiPillActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.specMultiPillText,
                                isSelected && styles.specMultiPillTextActive,
                              ]}
                            >
                              {s.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                  </View>
                </View>
              )}

              {formError ? <Text style={styles.modalErrorText}>{formError}</Text> : null}
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                onPress={() => setShowStaffModal(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveStaff}
                disabled={submittingStaff}
                style={styles.modalSubmitBtn}
              >
                {submittingStaff ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>
                    {editingUser ? 'Save Changes' : 'Create Staff'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 7. Reset Password Modal */}
      <Modal visible={Boolean(resetModalUser)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <TouchableOpacity onPress={() => setResetModalUser(null)}>
                <X size={18} color="#2D2D2A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.resetSubText}>
              Set a new account login password for <Text style={{ fontWeight: '700' }}>{resetModalUser?.name}</Text>.
            </Text>

            <Text style={styles.inputLabel}>New Password *</Text>
            <View style={styles.passwordInputWrap}>
              <TextInput
                value={newPasswordInput}
                onChangeText={setNewPasswordInput}
                placeholder="At least 6 characters"
                placeholderTextColor="#A1A1AA"
                secureTextEntry={!showNewPw}
                style={styles.passwordInput}
              />
              <TouchableOpacity
                onPress={() => setShowNewPw((v) => !v)}
                style={styles.eyeBtn}
              >
                {showNewPw ? (
                  <EyeOff size={16} color="#71717A" />
                ) : (
                  <Eye size={16} color="#71717A" />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                onPress={() => setResetModalUser(null)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmResetPassword}
                disabled={resettingPw || !newPasswordInput.trim()}
                style={styles.modalSubmitBtn}
              >
                {resettingPw ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Confirm Reset</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 8. Salary & Target Contract Modal (Exact match with EditSalaryContractModal) */}
      <Modal visible={Boolean(contractStaff)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {contractStaff?.role === 'manager'
                  ? 'Set Fixed Monthly Salary'
                  : 'Target & Salary Contract Settings'}
              </Text>
              <TouchableOpacity onPress={() => setContractStaff(null)}>
                <X size={18} color="#2D2D2A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.resetSubText}>
              Staff: <Text style={{ fontWeight: '700' }}>{contractStaff?.name}</Text> (
              {contractStaff?.role})
            </Text>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {contractStaff?.role === 'manager' ? (
                <>
                  <Text style={styles.inputLabel}>Monthly Fixed Salary (FCFA) *</Text>
                  <TextInput
                    value={contractFixed}
                    onChangeText={setContractFixed}
                    placeholder="e.g. 300000"
                    placeholderTextColor="#A1A1AA"
                    keyboardType="numeric"
                    style={styles.modalInput}
                  />
                  <Text style={styles.helperText}>
                    Monthly executive remuneration for branch management.
                  </Text>
                </>
              ) : (
                <>
                  {/* Target Scope */}
                  <Text style={styles.inputLabel}>Target Quota Scope</Text>
                  <View style={styles.scopeToggleRow}>
                    <TouchableOpacity
                      onPress={() => setContractScope('INDIVIDUAL')}
                      style={[
                        styles.scopeBtn,
                        contractScope === 'INDIVIDUAL' && styles.scopeBtnActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.scopeBtnText,
                          contractScope === 'INDIVIDUAL' && styles.scopeBtnTextActive,
                        ]}
                      >
                        Individual Quota
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setContractScope('SPA_TOTAL')}
                      style={[
                        styles.scopeBtn,
                        contractScope === 'SPA_TOTAL' && styles.scopeBtnActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.scopeBtnText,
                          contractScope === 'SPA_TOTAL' && styles.scopeBtnTextActive,
                        ]}
                      >
                        Spa Total Quota
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Monthly Target */}
                  <Text style={styles.inputLabel}>Monthly Target Revenue (FCFA)</Text>
                  <TextInput
                    value={contractTarget}
                    onChangeText={setContractTarget}
                    placeholder="e.g. 525000"
                    placeholderTextColor="#A1A1AA"
                    keyboardType="numeric"
                    style={styles.modalInput}
                  />

                  {/* Commission Rate */}
                  <Text style={styles.inputLabel}>Commission Rate (%)</Text>
                  <TextInput
                    value={contractRate}
                    onChangeText={setContractRate}
                    placeholder="e.g. 15"
                    placeholderTextColor="#A1A1AA"
                    keyboardType="numeric"
                    style={styles.modalInput}
                  />

                  {/* Base Pay */}
                  <Text style={styles.inputLabel}>Base Pay Guarantee (FCFA)</Text>
                  <TextInput
                    value={contractBase}
                    onChangeText={setContractBase}
                    placeholder="e.g. 50000"
                    placeholderTextColor="#A1A1AA"
                    keyboardType="numeric"
                    style={styles.modalInput}
                  />

                  {/* Fixed Salary */}
                  <Text style={styles.inputLabel}>Fixed Salary Retainer (FCFA)</Text>
                  <TextInput
                    value={contractFixed}
                    onChangeText={setContractFixed}
                    placeholder="e.g. 110000"
                    placeholderTextColor="#A1A1AA"
                    keyboardType="numeric"
                    style={styles.modalInput}
                  />
                </>
              )}

              {contractError ? (
                <Text style={styles.modalErrorText}>{contractError}</Text>
              ) : null}
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                onPress={() => setContractStaff(null)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveContract}
                disabled={submittingContract}
                style={styles.modalSubmitBtn}
              >
                {submittingContract ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Save Contract</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 9. Disciplinary Penalty Modal (Exact match with RecordPenaltyModal) */}
      <Modal visible={Boolean(penaltyStaff)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Disciplinary Penalty</Text>
              <TouchableOpacity onPress={() => setPenaltyStaff(null)}>
                <X size={18} color="#2D2D2A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.resetSubText}>
              Staff: <Text style={{ fontWeight: '700' }}>{penaltyStaff?.name}</Text>
            </Text>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {/* Infraction Rule */}
              <Text style={styles.inputLabel}>Violation Rule *</Text>
              <View style={styles.rulePillList}>
                {STANDARD_PENALTY_RULES.map((r) => {
                  const isSelected = selectedPenaltyRule === r.id;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      onPress={() => handlePenaltyRuleChange(r.id)}
                      style={[styles.rulePill, isSelected && styles.rulePillActive]}
                    >
                      <Text
                        style={[styles.rulePillText, isSelected && styles.rulePillTextActive]}
                      >
                        {r.name} ({r.defaultAmount.toLocaleString()} FCFA)
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Penalty Amount */}
              <Text style={styles.inputLabel}>Penalty Deduction Amount (FCFA) *</Text>
              <TextInput
                value={penaltyAmount}
                onChangeText={setPenaltyAmount}
                keyboardType="numeric"
                style={styles.modalInput}
              />

              {/* Date */}
              <Text style={styles.inputLabel}>Infraction Date (YYYY-MM-DD)</Text>
              <TextInput
                value={penaltyDate}
                onChangeText={setPenaltyDate}
                style={styles.modalInput}
              />

              {/* Notes */}
              <Text style={styles.inputLabel}>Explanatory Notes / Incident Report</Text>
              <TextInput
                value={penaltyNotes}
                onChangeText={setPenaltyNotes}
                placeholder="Details of the violation..."
                placeholderTextColor="#A1A1AA"
                multiline
                numberOfLines={3}
                style={[styles.modalInput, { height: 60, textAlignVertical: 'top' }]}
              />

              {penaltyError ? (
                <Text style={styles.modalErrorText}>{penaltyError}</Text>
              ) : null}
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                onPress={() => setPenaltyStaff(null)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSavePenalty}
                disabled={submittingPenalty}
                style={[styles.modalSubmitBtn, { backgroundColor: '#DC2626' }]}
              >
                {submittingPenalty ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Apply Penalty</Text>
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
    padding: 16,
    paddingBottom: 48,
    gap: 14,
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0ECE4',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Top Action Row (Specialties & Add Staff) */
  topActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  specialtiesBtn: {
    flex: 1,
    height: 42,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  specialtiesBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  addStaffBtn: {
    flex: 1.2,
    height: 42,
    backgroundColor: '#94A78A',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addStaffBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Specialty Management Panel */
  specialtyPanelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    gap: 10,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
  },
  panelTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  addSpecRow: {
    flexDirection: 'row',
    gap: 8,
  },
  specInput: {
    flex: 1,
    height: 38,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#2D2D2A',
  },
  addSpecBtn: {
    height: 38,
    paddingHorizontal: 14,
    backgroundColor: '#4F6748',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addSpecBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  specErrorText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },
  specsList: {
    gap: 6,
    marginTop: 4,
  },
  specItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  specItemRowInactive: {
    opacity: 0.6,
  },
  specItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  specItemNameInactive: {
    textDecorationLine: 'line-through',
    color: '#71717A',
  },
  specActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  specToggleBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  specToggleBtnDeact: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E8E2D9',
  },
  specToggleBtnAct: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  specToggleBtnText: {
    fontSize: 10,
    fontWeight: '600',
  },
  specToggleBtnTextDeact: {
    color: '#71717A',
  },
  specToggleBtnTextAct: {
    color: '#065F46',
  },
  specDeleteBtn: {
    padding: 4,
  },

  /* Active Staff Container Card */
  staffContainerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    overflow: 'hidden',
  },
  staffHeaderRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EAE1',
  },
  staffCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  /* Individual Staff Item */
  staffCardItem: {
    padding: 14,
    gap: 9,
  },
  staffCardItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0EAE1',
  },
  staffTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  staffName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  staffSubInfo: {
    fontSize: 12,
    color: '#71717A',
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  /* Specialties Pills Row */
  specialtiesPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  specialtyPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  specialtyPillText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#2D2D2A',
  },

  /* Salary / Target Boxes */
  salaryBoxManager: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 10,
    gap: 2,
  },
  salaryTitleManager: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  salarySubManager: {
    fontSize: 10,
    color: '#71717A',
  },
  salaryBoxTech: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 10,
    gap: 2,
  },
  salaryTitleTech: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  salarySubTech: {
    fontSize: 10,
    color: '#047857',
  },
  pendingBadgeBox: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400E',
  },

  /* Action Buttons */
  actionButtonsContainer: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F4EFEB',
    gap: 6,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  contractBtn: {
    flex: 1.1,
    height: 34,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  contractBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  editBtn: {
    flex: 1,
    height: 34,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  resetPwBtn: {
    flex: 1.1,
    height: 34,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  resetPwBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#71717A',
  },
  penaltyBtn: {
    flex: 1,
    height: 34,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  penaltyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#BE123C',
  },
  deactBtn: {
    flex: 0.9,
    height: 34,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  deactBtnFull: {
    height: 34,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  deactBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
  },
  activateBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activateBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },

  /* Modals Common Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    gap: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EAE1',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  resetSubText: {
    fontSize: 12,
    color: '#71717A',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#71717A',
    marginTop: 8,
    marginBottom: 4,
  },
  helperText: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 3,
  },
  modalInput: {
    height: 40,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#2D2D2A',
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  passwordInput: {
    flex: 1,
    fontSize: 13,
    color: '#2D2D2A',
  },
  eyeBtn: {
    padding: 4,
  },
  rolePickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  roleSelectPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  roleSelectPillActive: {
    backgroundColor: '#4F6748',
    borderColor: '#4F6748',
  },
  roleSelectPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#71717A',
  },
  roleSelectPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  specMultiSelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  specMultiPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  specMultiPillActive: {
    backgroundColor: '#4F6748',
    borderColor: '#4F6748',
  },
  specMultiPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#71717A',
  },
  specMultiPillTextActive: {
    color: '#FFFFFF',
  },
  scopeToggleRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  scopeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    alignItems: 'center',
  },
  scopeBtnActive: {
    backgroundColor: '#4F6748',
    borderColor: '#4F6748',
  },
  scopeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#71717A',
  },
  scopeBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  rulePillList: {
    gap: 5,
  },
  rulePill: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  rulePillActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECDD3',
  },
  rulePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  rulePillTextActive: {
    color: '#DC2626',
    fontWeight: '700',
  },
  modalErrorText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
    marginTop: 6,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#71717A',
  },
  modalSubmitBtn: {
    flex: 1.2,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#4F6748',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default StaffManagementScreen;
