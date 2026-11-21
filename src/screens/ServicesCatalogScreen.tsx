/**
 * ServicesCatalogScreen — 1-to-1 Match with Omega Spa POS Web Software (/services)
 * Matches frontend/src/pages/Services.jsx:
 * - Header: "Services"
 * - Subtitle: "Manage spa services, pricing, duration, and categories."
 * - Top Action Buttons:
 *     [ 🔀 Manage Categories ]  [ ➕ Add Service ] (Sage Green)
 * - Active Services Card:
 *     - Header: "ACTIVE SERVICES (X)"
 *     - Mobile Service Card:
 *         - Line 1: Service Name & Price ("45,000 FCFA")
 *         - Line 2: Category Badge (colored by category), Clock icon + Duration ("15 min"), Active pill
 *         - Line 3 (Manager actions): [ ✏ Edit ]  [ Deactivate ]  [ 🗑 Delete ]
 * - Inactive Services Card:
 *     - Header: "INACTIVE SERVICES (Y)"
 *     - Strikethrough service name, Inactive pill, [ Reactivate ] (green), [ 🗑 Delete ]
 * - Complete Add & Edit Service Modal with category picker, price, duration presets, active switch
 * - Complete Manage Categories Modal with Add, Edit, Delete specialty categories
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Switch,
  Platform,
} from 'react-native';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Clock,
  FolderTree,
  AlertCircle,
  CheckCircle2,
  Layers,
  Sparkles,
  Search,
} from 'lucide-react-native';
import THEME from '../constants/theme';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { useServices, ServiceItem, SpecialtyItem } from '../context/ServicesContext';
import { servicesApi, specialtiesApi } from '../services/api';

const COLORS = {
  ...THEME.colors,
  sage: '#8F9E84',
  sageDark: '#4F6748',
  sageSoft: '#EEF3EA',
  bgCream: '#FBF7F2',
  surface: '#FFFFFF',
  softCream: '#F6F1EB',
  textDark: '#2D2D2A',
  textMuted: '#76766E',
  border: '#EAE3D9',
  borderLight: '#F0EBE3',
  danger: '#B34040',
  dangerSoft: '#FAECEC',
  dangerBorder: '#ECCACA',
  success: '#15803D',
  successSoft: '#DCFCE7',
  successBorder: '#86EFAC',
};

const CATEGORY_STYLES: { [cat: string]: { bg: string; text: string; border: string } } = {
  Nails: { bg: '#F8ECE8', text: '#C98C7F', border: '#E1B6AC' },
  Facial: { bg: '#E8EFF8', text: '#4A6B8A', border: '#B8D0E8' },
  Massage: { bg: '#EEF3EA', text: '#4F6748', border: '#C5D8BD' },
  'Body Massage': { bg: '#EEF3EA', text: '#4F6748', border: '#C5D8BD' },
  BARBER: { bg: '#F4EFEA', text: '#57534E', border: '#E7DFD5' },
  Barber: { bg: '#F4EFEA', text: '#57534E', border: '#E7DFD5' },
};

const getCategoryStyle = (cat: string) => {
  return (
    CATEGORY_STYLES[cat] || {
      bg: '#F6F1EB',
      text: '#2D2D2A',
      border: '#EAE3D9',
    }
  );
};

const DURATION_PRESETS = ['15 min', '30 min', '45 min', '60 min', '90 min', '120 min'];

export const ServicesCatalogScreen: React.FC<{ onOpenMenu?: () => void }> = ({ onOpenMenu }) => {
  const { user } = useAuth();
  const role = (user?.role || '').toLowerCase();
  const isManager = role === 'manager';

  const {
    services,
    specialties,
    loading,
    refreshServices,
    addService,
    updateService,
    deleteService,
  } = useServices();

  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // ── Modals State ──
  const [showServiceModal, setShowServiceModal] = useState<boolean>(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);

  // ── Service Form State ──
  const [formName, setFormName] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('Nails');
  const [formPrice, setFormPrice] = useState<string>('15,000');
  const [formDuration, setFormDuration] = useState<string>('45 min');
  const [formActive, setFormActive] = useState<boolean>(true);
  const [submittingService, setSubmittingService] = useState<boolean>(false);

  // ── Category Modal State ──
  const [categoriesList, setCategoriesList] = useState<SpecialtyItem[]>([]);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState<string>('');
  const [submittingCategory, setSubmittingCategory] = useState<boolean>(false);

  // Sync categories list from context specialties
  useEffect(() => {
    if (specialties && specialties.length > 0) {
      setCategoriesList(specialties);
    }
  }, [specialties]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshServices();
    setRefreshing(false);
  };

  // Distinct active category names
  const activeCategories = useMemo(() => {
    const list = categoriesList
      .filter((c) => c.active !== false && c.isActive !== false)
      .map((c) => c.name);
    if (list.length === 0) {
      return ['Nails', 'Facial', 'Body Massage', 'BARBER'];
    }
    return list;
  }, [categoriesList]);

  // Active & Inactive Services
  const activeServices = useMemo(() => {
    return services.filter((s) => s.active !== false && s.status !== 'INACTIVE');
  }, [services]);

  const inactiveServices = useMemo(() => {
    return services.filter((s) => s.active === false || s.status === 'INACTIVE');
  }, [services]);

  const filteredActiveServices = useMemo(() => {
    return activeServices.filter((s) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.name?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q)
      );
    });
  }, [activeServices, searchQuery]);

  const filteredInactiveServices = useMemo(() => {
    return inactiveServices.filter((s) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.name?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q)
      );
    });
  }, [inactiveServices, searchQuery]);

  // Open Add Service Modal
  const openAddServiceModal = () => {
    setEditingService(null);
    setFormName('');
    setFormCategory(activeCategories[0] || 'Nails');
    setFormPrice('15,000');
    setFormDuration('45 min');
    setFormActive(true);
    setShowServiceModal(true);
  };

  // Open Edit Service Modal
  const openEditServiceModal = (svc: ServiceItem) => {
    setEditingService(svc);
    setFormName(svc.name);
    setFormCategory(svc.category || activeCategories[0] || 'Nails');
    setFormPrice(svc.numericPrice ? Number(svc.numericPrice).toLocaleString('en-US') : svc.price || '15,000');
    setFormDuration(svc.duration || '45 min');
    setFormActive(svc.active !== false && svc.status !== 'INACTIVE');
    setShowServiceModal(true);
  };

  // Save Service (Add / Edit)
  const handleSaveService = async () => {
    const trimmedName = formName.trim();
    if (!trimmedName) {
      Alert.alert('Required', 'Please enter a service name.');
      return;
    }

    const cleanPrice = parseInt(String(formPrice).replace(/[^0-9]/g, ''), 10) || 0;
    const cleanDurationNum = parseInt(String(formDuration).replace(/[^0-9]/g, ''), 10) || 45;
    const durStr = `${cleanDurationNum} min`;

    setSubmittingService(true);
    try {
      const payload = {
        name: trimmedName,
        category: formCategory,
        price: cleanPrice,
        duration: cleanDurationNum,
        isActive: formActive,
        status: formActive ? 'ACTIVE' : 'INACTIVE',
      };

      if (editingService) {
        await updateService(editingService.id, payload);
        showToast(`"${trimmedName}" updated successfully`);
      } else {
        await addService(payload);
        showToast(`"${trimmedName}" created successfully`);
      }
      setShowServiceModal(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save service.');
    } finally {
      setSubmittingService(false);
    }
  };

  // Toggle Active / Deactivate Service
  const handleToggleActive = async (svc: ServiceItem) => {
    const newActive = !svc.active;
    try {
      await updateService(svc.id, {
        isActive: newActive,
        status: newActive ? 'ACTIVE' : 'INACTIVE',
      });
      showToast(`"${svc.name}" marked as ${newActive ? 'Active' : 'Inactive'}`);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update service status.');
    }
  };

  // Delete Service with confirmation
  const handleDeleteService = (svc: ServiceItem) => {
    Alert.alert(
      'Delete Service',
      `Are you sure you want to delete "${svc.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteService(svc.id);
              showToast(`"${svc.name}" deleted successfully`);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete service.');
            }
          },
        },
      ]
    );
  };

  // ── Category Handlers ──
  const handleAddCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setSubmittingCategory(true);
    try {
      const res = await specialtiesApi.create({ name: trimmed, isActive: true });
      const newId = String(res?.data?.id || res?.data?._id || Date.now());
      setCategoriesList((prev) => [
        ...prev,
        { id: newId, name: trimmed, active: true, isActive: true },
      ]);
      setNewCategoryName('');
      showToast(`Category "${trimmed}" added`);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to add category.');
    } finally {
      setSubmittingCategory(false);
    }
  };

  const handleSaveCategoryEdit = async (id: string) => {
    const trimmed = editingCategoryName.trim();
    if (!trimmed) return;
    try {
      await specialtiesApi.update(id, { name: trimmed });
      setCategoriesList((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: trimmed } : c))
      );
      setEditingCategoryId(null);
      showToast(`Category updated to "${trimmed}"`);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update category.');
    }
  };

  const handleDeleteCategory = (cat: SpecialtyItem) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete category "${cat.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await specialtiesApi.delete(cat.id);
              setCategoriesList((prev) => prev.filter((c) => c.id !== cat.id));
              showToast(`Category "${cat.name}" deleted`);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete category.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Services"
        subtitle={
          isManager
            ? 'Manage spa services, pricing, duration, and categories.'
            : 'View spa services, pricing, duration, and categories.'
        }
        onOpenMenu={onOpenMenu}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || loading}
            onRefresh={onRefresh}
            colors={[COLORS.sageDark]}
          />
        }
      >
        {/* Toast notification */}
        {toastMessage && (
          <View style={styles.toastContainer}>
            <Check size={16} color={COLORS.success} strokeWidth={2.5} />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        )}

        {/* Top Action Buttons (Manager Only) — Matching Web Software Image 1 */}
        {isManager && (
          <View style={styles.topActionsRow}>
            <TouchableOpacity
              style={styles.manageCategoriesBtn}
              onPress={() => setShowCategoryModal(true)}
              activeOpacity={0.8}
            >
              <FolderTree size={16} color={COLORS.textDark} />
              <Text style={styles.manageCategoriesBtnText}>Manage Categories</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addServiceBtn}
              onPress={openAddServiceModal}
              activeOpacity={0.8}
            >
              <Plus size={16} color={COLORS.textDark} strokeWidth={2.5} />
              <Text style={styles.addServiceBtnText}>Add Service</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── ACTIVE SERVICES CARD CONTAINER ── */}
        <View style={styles.servicesCardContainer}>
          <View style={styles.servicesCardHeader}>
            <View style={styles.servicesCardTitleRow}>
              <Text style={styles.servicesCardTitle}>
                ACTIVE SERVICES ({filteredActiveServices.length})
              </Text>
              {searchQuery ? (
                <Text style={styles.searchCountSub}>
                  (of {activeServices.length})
                </Text>
              ) : null}
            </View>

            {/* Live Search Input Bar */}
            <View style={styles.searchBarContainer}>
              <Search size={15} color={COLORS.textMuted} />
              <TextInput
                style={styles.searchBarInput}
                placeholder="Search services or categories..."
                placeholderTextColor={COLORS.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                autoCorrect={false}
              />
              {searchQuery ? (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={styles.searchClearBtn}
                  activeOpacity={0.7}
                >
                  <X size={14} color={COLORS.textDark} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {filteredActiveServices.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Sparkles size={32} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>
                {searchQuery
                  ? `No services found matching "${searchQuery}"`
                  : 'No active services found.'}
              </Text>
              {searchQuery ? (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={styles.clearSearchBtn}
                >
                  <Text style={styles.clearSearchBtnText}>Clear Search</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <View style={styles.servicesList}>
              {filteredActiveServices.map((svc) => {
                const catStyle = getCategoryStyle(svc.category);
                const formattedPrice = svc.numericPrice
                  ? Number(svc.numericPrice).toLocaleString('en-US')
                  : svc.price;

                return (
                  <View key={svc.id} style={styles.serviceItemCard}>
                    {/* Line 1: Service Name & Price */}
                    <View style={styles.serviceRow1}>
                      <Text style={styles.serviceName} numberOfLines={1}>
                        {svc.name}
                      </Text>
                      <Text style={styles.servicePrice}>{formattedPrice} FCFA</Text>
                    </View>

                    {/* Line 2: Category Badge, Duration, and Active Badge */}
                    <View style={styles.serviceRow2}>
                      <View style={styles.serviceMetaLeft}>
                        <View
                          style={[
                            styles.categoryBadge,
                            {
                              backgroundColor: catStyle.bg,
                              borderColor: catStyle.border,
                            },
                          ]}
                        >
                          <Text style={[styles.categoryBadgeText, { color: catStyle.text }]}>
                            {svc.category}
                          </Text>
                        </View>

                        <View style={styles.durationBadge}>
                          <Clock size={11} color={COLORS.textMuted} />
                          <Text style={styles.durationText}>{svc.duration}</Text>
                        </View>
                      </View>

                      <View style={styles.activeStatusPill}>
                        <Text style={styles.activeStatusText}>Active</Text>
                      </View>
                    </View>

                    {/* Line 3: Manager Action Buttons: [ Edit ] [ Deactivate ] [ Delete ] */}
                    {isManager && (
                      <View style={styles.serviceActionsRow}>
                        <TouchableOpacity
                          style={styles.actionBtnEdit}
                          onPress={() => openEditServiceModal(svc)}
                          activeOpacity={0.8}
                        >
                          <Pencil size={13} color={COLORS.textDark} />
                          <Text style={styles.actionBtnEditText}>Edit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.actionBtnDeactivate}
                          onPress={() => handleToggleActive(svc)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.actionBtnDeactivateText}>Deactivate</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.actionBtnDelete}
                          onPress={() => handleDeleteService(svc)}
                          activeOpacity={0.8}
                        >
                          <Trash2 size={14} color={COLORS.danger} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── INACTIVE SERVICES CARD CONTAINER (IF ANY) ── */}
        {inactiveServices.length > 0 && filteredInactiveServices.length > 0 && (
          <View style={[styles.servicesCardContainer, styles.inactiveCardContainer]}>
            <View style={styles.servicesCardHeader}>
              <Text style={[styles.servicesCardTitle, { color: COLORS.textMuted }]}>
                INACTIVE SERVICES ({filteredInactiveServices.length})
              </Text>
            </View>

            <View style={styles.servicesList}>
              {filteredInactiveServices.map((svc) => {
                const catStyle = getCategoryStyle(svc.category);
                const formattedPrice = svc.numericPrice
                  ? Number(svc.numericPrice).toLocaleString('en-US')
                  : svc.price;

                return (
                  <View key={svc.id} style={styles.serviceItemCard}>
                    {/* Line 1: Service Name & Price */}
                    <View style={styles.serviceRow1}>
                      <Text
                        style={[styles.serviceName, styles.serviceNameInactive]}
                        numberOfLines={1}
                      >
                        {svc.name}
                      </Text>
                      <Text style={[styles.servicePrice, { color: COLORS.textMuted }]}>
                        {formattedPrice} FCFA
                      </Text>
                    </View>

                    {/* Line 2: Category Badge, Duration, and Inactive Badge */}
                    <View style={styles.serviceRow2}>
                      <View style={styles.serviceMetaLeft}>
                        <View
                          style={[
                            styles.categoryBadge,
                            {
                              backgroundColor: catStyle.bg,
                              borderColor: catStyle.border,
                            },
                          ]}
                        >
                          <Text style={[styles.categoryBadgeText, { color: catStyle.text }]}>
                            {svc.category}
                          </Text>
                        </View>

                        <View style={styles.durationBadge}>
                          <Clock size={11} color={COLORS.textMuted} />
                          <Text style={styles.durationText}>{svc.duration}</Text>
                        </View>
                      </View>

                      <View style={styles.inactiveStatusPill}>
                        <Text style={styles.inactiveStatusText}>Inactive</Text>
                      </View>
                    </View>

                    {/* Line 3: Manager Action Buttons: [ Reactivate ] [ Delete ] */}
                    {isManager && (
                      <View style={styles.serviceActionsRow}>
                        <TouchableOpacity
                          style={styles.actionBtnReactivate}
                          onPress={() => handleToggleActive(svc)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.actionBtnReactivateText}>Reactivate</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.actionBtnDelete}
                          onPress={() => handleDeleteService(svc)}
                          activeOpacity={0.8}
                        >
                          <Trash2 size={14} color={COLORS.danger} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ============================================================ */}
      {/* MODAL 1: ADD / EDIT SERVICE                                  */}
      {/* ============================================================ */}
      <Modal
        visible={showServiceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowServiceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingService ? 'Edit Service' : 'Add Service'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Service name, category, pricing, and duration.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowServiceModal(false)}
                style={styles.modalCloseBtn}
              >
                <X size={18} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            {/* Body */}
            <ScrollView style={styles.modalBody}>
              {/* Service Name */}
              <Text style={styles.formLabel}>Service Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Deep Tissue Massage"
                placeholderTextColor={COLORS.textMuted}
                value={formName}
                onChangeText={setFormName}
              />

              {/* Category Selector */}
              <Text style={[styles.formLabel, { marginTop: 14 }]}>Category *</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryPillsScroll}
              >
                {activeCategories.map((cat) => {
                  const isSelected = formCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.catSelectPill,
                        isSelected && styles.catSelectPillActive,
                      ]}
                      onPress={() => setFormCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.catSelectPillText,
                          isSelected && styles.catSelectPillTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Price */}
              <Text style={[styles.formLabel, { marginTop: 14 }]}>Price (FCFA) *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. 15,000"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
                value={formPrice}
                onChangeText={setFormPrice}
              />

              {/* Duration Presets */}
              <Text style={[styles.formLabel, { marginTop: 14 }]}>Duration</Text>
              <View style={styles.durationPresetsRow}>
                {DURATION_PRESETS.map((dur) => {
                  const isSelected = formDuration === dur;
                  return (
                    <TouchableOpacity
                      key={dur}
                      style={[
                        styles.durPresetPill,
                        isSelected && styles.durPresetPillActive,
                      ]}
                      onPress={() => setFormDuration(dur)}
                    >
                      <Text
                        style={[
                          styles.durPresetPillText,
                          isSelected && styles.durPresetPillTextActive,
                        ]}
                      >
                        {dur}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Active Status Switch (when editing) */}
              {editingService && (
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Active Status</Text>
                  <Switch
                    value={formActive}
                    onValueChange={setFormActive}
                    trackColor={{ false: '#E2E8F0', true: COLORS.sageDark }}
                  />
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowServiceModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveService}
                disabled={submittingService}
              >
                {submittingService ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>
                    {editingService ? 'Save Changes' : 'Create Service'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 2: MANAGE CATEGORIES                                   */}
      {/* ============================================================ */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentLarge}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Manage Categories</Text>
                <Text style={styles.modalSubtitle}>
                  Create and manage service specialty categories.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowCategoryModal(false)}
                style={styles.modalCloseBtn}
              >
                <X size={18} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            {/* Body */}
            <ScrollView style={styles.modalBodyScroll}>
              {/* Add New Category Box */}
              <View style={styles.addCategoryBox}>
                <Text style={styles.addCategoryTitle}>+ Add New Category</Text>
                <View style={styles.addCategoryInputRow}>
                  <TextInput
                    style={styles.addCategoryInput}
                    placeholder="e.g. Hair Styling"
                    placeholderTextColor={COLORS.textMuted}
                    value={newCategoryName}
                    onChangeText={setNewCategoryName}
                  />
                  <TouchableOpacity
                    style={styles.addCategoryConfirmBtn}
                    onPress={handleAddCategory}
                    disabled={submittingCategory}
                  >
                    {submittingCategory ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.addCategoryConfirmBtnText}>Add</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Categories List */}
              <Text style={[styles.formLabel, { marginTop: 16, marginBottom: 8 }]}>
                Existing Categories ({categoriesList.length})
              </Text>

              {categoriesList.map((cat) => {
                const isEditingThis = editingCategoryId === cat.id;

                return (
                  <View key={cat.id} style={styles.categoryItemRow}>
                    {isEditingThis ? (
                      <View style={styles.categoryEditInputRow}>
                        <TextInput
                          style={styles.categoryEditInput}
                          value={editingCategoryName}
                          onChangeText={setEditingCategoryName}
                          autoFocus
                        />
                        <TouchableOpacity
                          style={styles.catSaveEditBtn}
                          onPress={() => handleSaveCategoryEdit(cat.id)}
                        >
                          <Check size={14} color="#FFFFFF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.catCancelEditBtn}
                          onPress={() => setEditingCategoryId(null)}
                        >
                          <X size={14} color={COLORS.textDark} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <>
                        <View style={styles.categoryInfoLeft}>
                          <FolderTree size={15} color={COLORS.sageDark} />
                          <Text style={styles.categoryItemName}>{cat.name}</Text>
                        </View>

                        <View style={styles.categoryActionsRow}>
                          <TouchableOpacity
                            style={styles.categoryActionBtn}
                            onPress={() => {
                              setEditingCategoryId(cat.id);
                              setEditingCategoryName(cat.name);
                            }}
                          >
                            <Pencil size={13} color={COLORS.textDark} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.categoryActionBtn, { backgroundColor: COLORS.dangerSoft }]}
                            onPress={() => handleDeleteCategory(cat)}
                          >
                            <Trash2 size={13} color={COLORS.danger} />
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {/* Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalFullWidthBtn}
                onPress={() => setShowCategoryModal(false)}
              >
                <Text style={styles.modalFullWidthBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ServicesCatalogScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgCream,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successSoft,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    gap: 8,
  },
  toastText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.success,
    flex: 1,
  },
  // Top 2 Action Buttons Row
  topActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  manageCategoriesBtn: {
    flex: 1,
    height: 44,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  manageCategoriesBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  addServiceBtn: {
    flex: 1,
    height: 44,
    backgroundColor: COLORS.sage,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  addServiceBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  // Services Card Container
  servicesCardContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 16,
  },
  inactiveCardContainer: {
    opacity: 0.85,
  },
  servicesCardHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 10,
  },
  servicesCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  servicesCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textDark,
    letterSpacing: 0.5,
  },
  searchCountSub: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCream,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    height: 40,
    gap: 8,
  },
  searchBarInput: {
    flex: 1,
    height: 40,
    fontSize: 13,
    color: COLORS.textDark,
  },
  searchClearBtn: {
    padding: 4,
  },
  clearSearchBtn: {
    marginTop: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: COLORS.softCream,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  clearSearchBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.sageDark,
  },
  servicesList: {
    flexDirection: 'column',
  },
  serviceItemCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    gap: 8,
  },
  serviceRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  serviceName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textDark,
    flex: 1,
  },
  serviceNameInactive: {
    textDecorationLine: 'line-through',
    color: COLORS.textMuted,
  },
  servicePrice: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  serviceRow2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  activeStatusPill: {
    backgroundColor: COLORS.successSoft,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  activeStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.success,
  },
  inactiveStatusPill: {
    backgroundColor: COLORS.softCream,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  inactiveStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  serviceActionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 4,
    alignItems: 'center',
  },
  actionBtnEdit: {
    flex: 1,
    height: 38,
    backgroundColor: COLORS.softCream,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  actionBtnEditText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  actionBtnDeactivate: {
    flex: 1,
    height: 38,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDeactivateText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  actionBtnReactivate: {
    flex: 1,
    height: 38,
    backgroundColor: COLORS.successSoft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnReactivateText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.success,
  },
  actionBtnDelete: {
    width: 44,
    height: 38,
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  // Modal Common Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    maxHeight: '82%',
    overflow: 'hidden',
  },
  modalContentLarge: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    maxHeight: '86%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  modalSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  modalBodyScroll: {
    padding: 16,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: COLORS.bgCream,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 13,
    color: COLORS.textDark,
  },
  categoryPillsScroll: {
    flexDirection: 'row',
  },
  catSelectPill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.bgCream,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
  },
  catSelectPillActive: {
    backgroundColor: COLORS.sage,
    borderColor: COLORS.sage,
  },
  catSelectPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  catSelectPillTextActive: {
    color: COLORS.textDark,
  },
  durationPresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  durPresetPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: COLORS.bgCream,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  durPresetPillActive: {
    backgroundColor: COLORS.sage,
    borderColor: COLORS.sage,
  },
  durPresetPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  durPresetPillTextActive: {
    color: COLORS.textDark,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: COLORS.bgCream,
    padding: 12,
    borderRadius: 10,
  },
  switchLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  modalSaveBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  modalFullWidthBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFullWidthBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  // Category Modal Styles
  addCategoryBox: {
    backgroundColor: COLORS.bgCream,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addCategoryTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 8,
  },
  addCategoryInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addCategoryInput: {
    flex: 1,
    height: 38,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    fontSize: 12,
    color: COLORS.textDark,
  },
  addCategoryConfirmBtn: {
    backgroundColor: COLORS.sage,
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCategoryConfirmBtnText: {
    color: COLORS.textDark,
    fontWeight: '700',
    fontSize: 12,
  },
  categoryItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bgCream,
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    minHeight: 44,
  },
  categoryInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  categoryActionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  categoryActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryEditInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  categoryEditInput: {
    flex: 1,
    height: 34,
    backgroundColor: COLORS.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 8,
    fontSize: 12,
  },
  catSaveEditBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: COLORS.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catCancelEditBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: COLORS.softCream,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
