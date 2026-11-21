/**
 * ExpensesScreen — 1-to-1 Match with Omega Spa POS Expenses.jsx & Mobile WebView
 * Matches frontend/src/pages/Expenses.jsx and screenshot:
 * - Header: "Expenses" + "Normal spa operating expenses tracking and history." + "+ New Expense" button
 * - 3 Metric Cards:
 *     1. AUTHORIZED ROLES (Manager & Reception)
 *     2. EXPENSES TODAY (0 FCFA or today total)
 *     3. TOTAL RECORDED ENTRIES (e.g. 8)
 * - Expense History Box:
 *     - Header: Green receipt icon + "Expense History" + "Showing X of Y records"
 *     - Search: "Search note, category, staff..."
 *     - Category Dropdown: "All Categories" + categories list
 * - Expense Cards (Exact match with screenshot media_1793794191829_a08403bd.png):
 *     - Pills: Category pill (e.g. OTHER) in sage-soft + Payment method pill (e.g. CASH)
 *     - Amount: e.g. "11,000 FCFA" in bold dark charcoal (not red!)
 *     - Description Box: Soft cream background with "DESCRIPTION:" label and note text
 *     - Footer: Date (e.g. 2026-11-03) + "Added by Chebou Kemle"
 *     - Action Buttons: [ ✏️ Edit ] button and [ 🗑️ Delete ] button!
 * - Modals for New Expense and Edit Expense
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Calendar,
  DollarSign,
  User,
  Building,
  Pencil,
  Trash2,
  X,
  Check,
  ChevronDown,
} from 'lucide-react-native';
import THEME from '../constants/theme';
import Header from '../components/Header';
import { formatFCFA } from '../utils/currency';
import { formatDate } from '../utils/date';
import {
  useExpenses,
  ExpenseItem,
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
} from '../context/ExpensesContext';
import { useAuth } from '../context/AuthContext';

interface ExpensesScreenProps {
  onOpenMenu?: () => void;
}

export const ExpensesScreen: React.FC<ExpensesScreenProps> = ({ onOpenMenu }) => {
  const { user } = useAuth();
  const isManager = (user?.role || '').toLowerCase() === 'manager';

  const {
    expenses,
    todayExpensesTotal,
    loading,
    refreshExpenses,
    addExpense,
    updateExpense,
    deleteExpense,
  } = useExpenses();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);

  // Form states
  const todayStr = new Date().toISOString().slice(0, 10);
  const [formDate, setFormDate] = useState(todayStr);
  const [formCategory, setFormCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [formAmount, setFormAmount] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState(EXPENSE_PAYMENT_METHODS[0]);
  const [formNote, setFormNote] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Open modal for new expense
  const openNewExpenseModal = () => {
    setEditingExpense(null);
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormCategory(EXPENSE_CATEGORIES[0]);
    setFormAmount('');
    setFormPaymentMethod('CASH');
    setFormNote('');
    setErrorMessage('');
    setIsSubmitting(false);
    setIsModalOpen(true);
  };

  // Open modal for editing (Manager only)
  const openEditExpenseModal = (exp: ExpenseItem) => {
    if (!isManager) return;
    setEditingExpense(exp);
    setFormDate(exp.date);
    setFormCategory(exp.category);
    setFormAmount(String(exp.amount));
    setFormPaymentMethod(exp.paymentMethod || 'CASH');
    setFormNote(exp.note || '');
    setErrorMessage('');
    setIsSubmitting(false);
    setIsModalOpen(true);
  };

  // Close modal
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
    setErrorMessage('');
    setIsSubmitting(false);
  };

  // Save handler with validation
  const handleSave = async () => {
    if (isSubmitting) return;
    setErrorMessage('');

    const trimmedNote = formNote.trim();
    if (!trimmedNote) {
      setErrorMessage('Please enter the reason for this expense.');
      return;
    }

    const numAmount = parseInt(String(formAmount).replace(/[^0-9]/g, ''), 10);
    if (!numAmount || numAmount <= 0) {
      setErrorMessage('Please enter a valid expense amount in FCFA.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingExpense) {
        const res = await updateExpense(editingExpense.id, {
          date: formDate,
          category: formCategory,
          amount: numAmount,
          paymentMethod: formPaymentMethod,
          note: trimmedNote,
        });

        if (!res.success) {
          setErrorMessage(res.error || 'Failed to update expense.');
          setIsSubmitting(false);
          return;
        }

        Alert.alert('Updated', 'Expense updated successfully.');
        closeModal();
      } else {
        const res = await addExpense({
          date: formDate,
          category: formCategory,
          amount: numAmount,
          paymentMethod: formPaymentMethod,
          note: trimmedNote,
        });

        if (!res.success) {
          setErrorMessage(res.error || 'Failed to record expense.');
          setIsSubmitting(false);
          return;
        }

        Alert.alert('Recorded', 'Expense recorded successfully.');
        closeModal();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save expense.');
      setIsSubmitting(false);
    }
  };

  // Delete handler (Manager only)
  const handleDelete = (item: ExpenseItem) => {
    if (!isManager) return;
    Alert.alert(
      'Delete Expense',
      `Delete expense of ${formatFCFA(item.amount)} (${item.category})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteExpense(item.id);
            if (!res.success) {
              Alert.alert('Error', res.error || 'Failed to delete expense.');
            }
          },
        },
      ]
    );
  };

  // Filtered expense history
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const matchesCategory =
        selectedCategory === 'ALL' ||
        exp.category?.toLowerCase() === selectedCategory.toLowerCase();

      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        exp.category?.toLowerCase().includes(q) ||
        exp.note?.toLowerCase().includes(q) ||
        exp.paymentMethod?.toLowerCase().includes(q) ||
        (exp.createdBy && exp.createdBy.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [expenses, selectedCategory, searchTerm]);

  return (
    <View style={styles.container}>
      {/* Header — Exact Web Software Parity */}
      <Header
        title="Expenses"
        subtitle="Normal spa operating expenses tracking and history."
        onOpenMenu={onOpenMenu}
        rightAction={
          <TouchableOpacity
            onPress={openNewExpenseModal}
            style={styles.newExpenseBtn}
            activeOpacity={0.8}
          >
            <Plus size={15} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.newExpenseBtnText}>New Expense</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainScrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refreshExpenses}
            tintColor={THEME.colors.primaryDark}
          />
        }
      >
        {/* ========================================================================= */}
        {/* TOP 3 METRIC CARDS (Exact match with Web Software Expenses.jsx) */}
        {/* ========================================================================= */}
        <View style={styles.metricCardsRow}>
          {/* Card 1: Authorized Roles */}
          <View style={styles.metricCard}>
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text style={styles.metricCardLabel}>AUTHORIZED ROLES</Text>
              <Text style={styles.metricCardTitle} numberOfLines={1}>
                Manager & Reception
              </Text>
              <Text style={styles.metricCardSub} numberOfLines={1}>
                Current User: <Text style={{ fontWeight: '700', color: '#2D2D2A' }}>{isManager ? 'Manager (Full Management)' : `${user?.name || 'Reception'} (Recording Only)`}</Text>
              </Text>
            </View>
            <View style={[styles.metricIconBox, { backgroundColor: '#FDEEE9' }]}>
              <Building size={18} color="#C2410C" />
            </View>
          </View>

          {/* Card 2: Expenses Today */}
          <View style={styles.metricCard}>
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text style={styles.metricCardLabel}>EXPENSES TODAY</Text>
              <Text style={[styles.metricCardValue, { color: '#2D2D2A' }]}>
                {formatFCFA(todayExpensesTotal)}
              </Text>
            </View>
            <View style={[styles.metricIconBox, { backgroundColor: '#E8F2E6' }]}>
              <DollarSign size={18} color="#4F6748" />
            </View>
          </View>

          {/* Card 3: Total Recorded Entries */}
          <View style={styles.metricCard}>
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text style={styles.metricCardLabel}>TOTAL ENTRIES</Text>
              <Text style={[styles.metricCardValue, { color: '#2D2D2A' }]}>
                {expenses.length}
              </Text>
            </View>
            <View style={[styles.metricIconBox, { backgroundColor: '#F6F1EB' }]}>
              <Receipt size={18} color="#2D2D2A" />
            </View>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* EXPENSE HISTORY CONTAINER (Exact match with Web Software) */}
        {/* ========================================================================= */}
        <View style={styles.historyContainer}>
          {/* Section Header */}
          <View style={styles.historyHeader}>
            <View style={styles.historyTitleRow}>
              <View style={styles.receiptIconBadge}>
                <Receipt size={18} color="#4F6748" />
              </View>
              <View>
                <Text style={styles.historyTitle}>Expense History</Text>
                <Text style={styles.historySub}>
                  Showing {filteredExpenses.length} of {expenses.length} records
                </Text>
              </View>
            </View>
          </View>

          {/* Search & Category Filter Controls */}
          <View style={styles.controlsRow}>
            {/* Search Input */}
            <View style={styles.searchBar}>
              <Search size={14} color="#737373" style={{ marginRight: 6 }} />
              <TextInput
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Search note, category, staff..."
                placeholderTextColor="#737373"
                style={styles.searchInput}
              />
              {searchTerm ? (
                <TouchableOpacity onPress={() => setSearchTerm('')} style={{ padding: 4 }}>
                  <X size={13} color="#737373" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Category Dropdown Button */}
            <TouchableOpacity
              onPress={() => setShowCategoryPicker(true)}
              style={styles.categoryDropdownBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.categoryDropdownText} numberOfLines={1}>
                {selectedCategory === 'ALL' ? 'All Categories' : selectedCategory}
              </Text>
              <ChevronDown size={14} color="#737373" />
            </TouchableOpacity>
          </View>

          {/* ========================================================================= */}
          {/* EXPENSE CARDS LIST (Exact match with screenshot media_1793794191829_a08403bd.png) */}
          {/* ========================================================================= */}
          <View style={styles.cardsList}>
            {filteredExpenses.length === 0 ? (
              <View style={styles.emptyBox}>
                <Receipt size={32} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>No expenses found</Text>
                <Text style={styles.emptySub}>
                  {searchTerm || selectedCategory !== 'ALL'
                    ? 'Try adjusting your search query or category filter.'
                    : 'Click "+ New Expense" to record normal spa operating costs.'}
                </Text>
              </View>
            ) : (
              filteredExpenses.map((exp) => (
                <View key={exp.id} style={styles.expenseCard}>
                  {/* Top Row: Category pill + Payment Method pill + Amount */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.pillGroup}>
                      <View style={styles.categoryPill}>
                        <Text style={styles.categoryPillText}>{exp.category.toUpperCase()}</Text>
                      </View>
                      <View style={styles.methodPill}>
                        <Text style={styles.methodPillText}>{exp.paymentMethod.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardAmount}>{formatFCFA(exp.amount)}</Text>
                  </View>

                  {/* Description Box — Soft cream rounded container */}
                  <View style={styles.descriptionBox}>
                    <Text style={styles.descriptionLabel}>DESCRIPTION:</Text>
                    <Text style={styles.descriptionText}>{exp.note}</Text>
                  </View>

                  {/* Footer Row: Date + Added by + Action buttons [ ✏️ Edit ] [ 🗑️ Delete ] */}
                  <View style={styles.cardFooterRow}>
                    <View style={styles.metaCol}>
                      <View style={styles.dateTagRow}>
                        <Calendar size={12} color="#737373" />
                        <Text style={styles.dateTagText}>{exp.date}</Text>
                      </View>
                      <View style={styles.userTagRow}>
                        <User size={12} color="#737373" />
                        <Text style={styles.userTagText}>
                          Added by <Text style={styles.userTagBold}>{exp.createdBy || 'Chebou Kemle'}</Text>
                        </Text>
                      </View>
                    </View>

                    {/* Action buttons: Edit & Delete (Manager Only) */}
                    {isManager && (
                      <View style={styles.actionsRow}>
                        <TouchableOpacity
                          onPress={() => openEditExpenseModal(exp)}
                          style={styles.actionIconBtn}
                          activeOpacity={0.7}
                        >
                          <Pencil size={15} color="#4B5563" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleDelete(exp)}
                          style={styles.actionIconBtn}
                          activeOpacity={0.7}
                        >
                          <Trash2 size={15} color="#6B7280" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODAL 1: New / Edit Expense Modal */}
      {/* ========================================================================= */}
      <Modal visible={isModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingExpense ? 'Edit Operating Expense' : 'Record Operating Expense'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {editingExpense
                    ? `Update record from ${editingExpense.date}`
                    : 'Log normal spa costs with required reason.'}
                </Text>
              </View>
              <TouchableOpacity onPress={closeModal} style={styles.modalCloseBtn}>
                <X size={20} color="#737373" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              {/* Error Alert */}
              {errorMessage ? (
                <View style={styles.errorAlert}>
                  <Text style={styles.errorAlertText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* Date */}
              <Text style={styles.fieldLabel}>DATE (YYYY-MM-DD) *</Text>
              <TextInput
                value={formDate}
                onChangeText={setFormDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#737373"
                style={styles.formInput}
              />

              {/* Category */}
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>CATEGORY *</Text>
              <View style={styles.catGrid}>
                {EXPENSE_CATEGORIES.map((cat) => {
                  const isSel = formCategory.toLowerCase() === cat.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setFormCategory(cat)}
                      style={[styles.catChip, isSel && styles.catChipActive]}
                    >
                      <Text style={[styles.catChipText, isSel && styles.catChipTextActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Amount */}
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>AMOUNT (FCFA) *</Text>
              <TextInput
                value={formAmount}
                onChangeText={setFormAmount}
                keyboardType="numeric"
                placeholder="e.g. 10000"
                placeholderTextColor="#737373"
                style={styles.formInput}
              />

              {/* Payment Method */}
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>PAYMENT METHOD *</Text>
              <View style={styles.methodRow}>
                {EXPENSE_PAYMENT_METHODS.map((m) => {
                  const isSel = formPaymentMethod === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setFormPaymentMethod(m)}
                      style={[styles.methodBtn, isSel && styles.methodBtnActive]}
                    >
                      <Text style={[styles.methodBtnText, isSel && styles.methodBtnTextActive]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Description / Reason */}
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>DESCRIPTION / REASON *</Text>
              <TextInput
                value={formNote}
                onChangeText={setFormNote}
                placeholder="Reason for this expense..."
                placeholderTextColor="#737373"
                multiline
                numberOfLines={3}
                style={[styles.formInput, styles.formTextArea]}
              />
            </ScrollView>

            <View style={styles.modalActionButtons}>
              <TouchableOpacity onPress={closeModal} style={styles.cancelModalBtn}>
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSave}
                disabled={isSubmitting}
                style={styles.saveModalBtn}
                activeOpacity={0.8}
              >
                <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.saveModalBtnText}>
                  {isSubmitting
                    ? 'Saving...'
                    : editingExpense
                    ? 'Update Expense'
                    : 'Record Expense'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: Category Filter Picker Modal */}
      {/* ========================================================================= */}
      <Modal visible={showCategoryPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryPicker(false)}
        >
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Filter by Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <X size={18} color="#737373" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => {
                setSelectedCategory('ALL');
                setShowCategoryPicker(false);
              }}
              style={[
                styles.pickerOption,
                selectedCategory === 'ALL' && styles.pickerOptionActive,
              ]}
            >
              <Text
                style={[
                  styles.pickerOptionText,
                  selectedCategory === 'ALL' && styles.pickerOptionTextActive,
                ]}
              >
                All Categories
              </Text>
              {selectedCategory === 'ALL' && <Check size={16} color="#4F6748" />}
            </TouchableOpacity>

            {EXPENSE_CATEGORIES.map((cat) => {
              const isSel = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => {
                    setSelectedCategory(cat);
                    setShowCategoryPicker(false);
                  }}
                  style={[styles.pickerOption, isSel && styles.pickerOptionActive]}
                >
                  <Text style={[styles.pickerOptionText, isSel && styles.pickerOptionTextActive]}>
                    {cat}
                  </Text>
                  {isSel && <Check size={16} color="#4F6748" />}
                </TouchableOpacity>
              );
            })}
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
  newExpenseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4F6748',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  newExpenseBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  // Top 3 Metric Cards
  metricCardsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...THEME.shadows.sm,
  },
  metricCardLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#737373',
    letterSpacing: 0.5,
  },
  metricCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
    marginTop: 2,
  },
  metricCardSub: {
    fontSize: 9,
    color: '#737373',
    marginTop: 1,
  },
  metricCardValue: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  metricIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Expense History Container
  historyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    overflow: 'hidden',
    ...THEME.shadows.sm,
  },
  historyHeader: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE3',
    backgroundColor: '#FAF7F3',
  },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  receiptIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E8F2E6',
    borderWidth: 1,
    borderColor: 'rgba(79, 103, 72, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  historySub: {
    fontSize: 11,
    color: '#737373',
    marginTop: 1,
  },
  // Filter Controls
  controlsRow: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE3',
    gap: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#2D2D2A',
    paddingVertical: 2,
  },
  categoryDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 38,
  },
  categoryDropdownText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  // Cards List
  cardsList: {
    padding: 12,
    gap: 12,
  },
  emptyBox: {
    paddingVertical: 36,
    alignItems: 'center',
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
  },
  // Expense Card (Exact screenshot media_1793794191829_a08403bd.png)
  expenseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    padding: 12,
    gap: 10,
    ...THEME.shadows.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryPill: {
    backgroundColor: '#E8F2E6',
    borderWidth: 1,
    borderColor: 'rgba(79, 103, 72, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4F6748',
    letterSpacing: 0.5,
  },
  methodPill: {
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  methodPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#737373',
  },
  cardAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2D2D2A',
  },
  // Description Box
  descriptionBox: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    padding: 10,
  },
  descriptionLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#737373',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  descriptionText: {
    fontSize: 12,
    color: '#2D2D2A',
    lineHeight: 17,
  },
  // Card Footer Row
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  metaCol: {
    gap: 2,
  },
  dateTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateTagText: {
    fontSize: 11,
    color: '#737373',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  userTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  userTagText: {
    fontSize: 11,
    color: '#737373',
  },
  userTagBold: {
    fontWeight: '700',
    color: '#2D2D2A',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal Sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D9',
    paddingBottom: 12,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#737373',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  errorAlert: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  errorAlertText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#737373',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#2D2D2A',
  },
  formTextArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  catChipActive: {
    backgroundColor: '#E8F2E6',
    borderColor: '#4F6748',
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#737373',
  },
  catChipTextActive: {
    color: '#4F6748',
    fontWeight: '700',
  },
  methodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  methodBtnActive: {
    backgroundColor: '#E8F2E6',
    borderColor: '#4F6748',
  },
  methodBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#737373',
  },
  methodBtnTextActive: {
    color: '#4F6748',
    fontWeight: '700',
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancelModalBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  cancelModalBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  saveModalBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#4F6748',
  },
  saveModalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Picker Modal
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    maxHeight: '80%',
    ...THEME.shadows.md,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D9',
    paddingBottom: 10,
    marginBottom: 8,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE3',
  },
  pickerOptionActive: {
    backgroundColor: '#F6F9F5',
  },
  pickerOptionText: {
    fontSize: 13,
    color: '#2D2D2A',
    fontWeight: '500',
  },
  pickerOptionTextActive: {
    color: '#4F6748',
    fontWeight: '700',
  },
});

export default ExpensesScreen;
