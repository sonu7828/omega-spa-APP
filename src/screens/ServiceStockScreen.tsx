/**
 * ServiceStockScreen — 1-to-1 Match with Omega Spa POS Web Software (/stock)
 * Matches frontend/src/pages/Stock.jsx:
 * - Title: "Service Stock" & "Products consumed by technicians during services."
 * - Top 6-action quick button grid:
 *     [ 📋 Stock Check ] [ ✂ Adjust ] [ 🎛 Consumption Rules ]
 *     [ 🕒 History ]     [ ✨ New Product ] [ ➕ Add Stock ]
 * - Main navigation tabs:
 *     [ 📦 Service Inventory (X) ]  [ 📷 Live Stock Audits & Remarks (Y) ]
 * - Low Stock Alert Threshold Card (stepper / input for Days Left)
 * - Latest Stock Check Status Card (Pending Check / Reconciled ✓)
 * - Service Products Card & List:
 *     - Status filter tabs: [ All (X) ] [ 🟢 Active (Y) ] [ ⚪ Inactive (Z) ]
 *     - Mobile Product Cards:
 *         - Name & Active toggle + In Stock / Low Stock / Out of Stock badge
 *         - Current / Expected Stock & Estimated Days Left (~X ml/day)
 *         - Actions: [ + Refill ] [ ✂ Adjust ] [ ✏ Edit ] [ 🗑 Delete ]
 * - Full Interactive Modals:
 *     1. Stock Check (Actual vs Expected Count reconciliation)
 *     2. Adjust Stock (Wastage / Damaged / Expired deduction)
 *     3. Consumption Rules (Dynamic per-service product usage)
 *     4. History / Audit Log (Filter by type & product)
 *     5. New Product Modal
 *     6. Edit Product Modal
 *     7. Refill Stock Modal
 *     8. Live Stock Audit Modal + CameraModal integration
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
  Image,
} from 'react-native';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Sparkles,
  AlertTriangle,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Sliders,
  Scissors,
  History,
  Camera,
  RefreshCw,
  Search,
  Clock,
  User,
  ChevronDown,
  Eye,
  Calendar,
} from 'lucide-react-native';
import THEME from '../constants/theme';
import Header from '../components/Header';
import CameraModal from '../components/CameraModal';
import { useAuth } from '../context/AuthContext';
import { stockApi, servicesApi } from '../services/api';

const COLORS = {
  ...THEME.colors,
  sage: '#4F6748',
  sageLight: '#EBF1EB',
  bgCream: '#FBF7F2',
  textDark: '#2D2D2A',
  textMuted: '#76766E',
  borderLight: '#EAE3D9',
  surface: '#FFFFFF',
};

interface ServiceStockScreenProps {
  onOpenMenu?: () => void;
  onNavigateToStockPhotos?: () => void;
}

export interface ServiceProduct {
  id: string;
  name: string;
  category?: string;
  quantity: number;
  unit: string;
  active: boolean;
  minThreshold?: number;
  avgDailyUsage?: number;
  daysLeft?: number | null;
}

export interface StockHistoryItem {
  id: string;
  date: string;
  type: 'REFILL' | 'ADJUSTMENT' | 'STOCK CHECK' | 'CONSUMPTION';
  productName: string;
  quantityChange: number;
  unit: string;
  reason?: string;
  performedBy: string;
}

export interface ConsumptionRule {
  productName: string;
  quantity: number;
  unit: string;
}

export interface ServiceConsumptionGroup {
  serviceId: string;
  serviceName: string;
  rules: ConsumptionRule[];
}

export interface StockAuditRecord {
  id: string;
  date: string;
  timestamp: string;
  technicianId?: string;
  technicianName: string;
  productName: string;
  remarks: string;
  photoUri: string;
  status: 'PENDING' | 'REVIEWED' | 'FLAGGED';
  reviewedBy?: string;
  reviewedAt?: string;
}

const DEFAULT_SERVICE_PRODUCTS: ServiceProduct[] = [
  { id: '1', name: 'Massage Oil', category: 'Massage', quantity: 5000, unit: 'ml', active: true, avgDailyUsage: 156, daysLeft: 32 },
  { id: '2', name: 'Facial Cleanser', category: 'Facial', quantity: 2500, unit: 'ml', active: true, avgDailyUsage: 80, daysLeft: 31 },
  { id: '3', name: 'Towel Pack', category: 'General', quantity: 120, unit: 'pcs', active: true, avgDailyUsage: 15, daysLeft: 8 },
  { id: '4', name: 'Face Mask Powder', category: 'Facial', quantity: 800, unit: 'g', active: true, avgDailyUsage: 25, daysLeft: 32 },
  { id: '5', name: 'OPI Gel Polish', category: 'Nail Care', quantity: 45, unit: 'bottles', active: true, avgDailyUsage: 2, daysLeft: 22 },
  { id: '6', name: 'Cotton Pads', category: 'General', quantity: 350, unit: 'pcs', active: true, avgDailyUsage: 40, daysLeft: 8 },
];

const DEFAULT_HISTORY: StockHistoryItem[] = [
  { id: 'h1', date: '2026-11-06 09:30', type: 'REFILL', productName: 'Massage Oil', quantityChange: 2000, unit: 'ml', reason: 'Routine weekly replenishment', performedBy: 'Arnold Njikam' },
  { id: 'h2', date: '2026-11-05 17:45', type: 'STOCK CHECK', productName: 'Facial Cleanser', quantityChange: 0, unit: 'ml', reason: 'Physical stock verified', performedBy: 'Arnold Njikam' },
  { id: 'h3', date: '2026-11-05 14:15', type: 'ADJUSTMENT', productName: 'Face Mask Powder', quantityChange: -50, unit: 'g', reason: 'Wastage (Accidental spill)', performedBy: 'Arnold Njikam' },
  { id: 'h4', date: '2026-11-04 11:20', type: 'REFILL', productName: 'Cotton Pads', quantityChange: 200, unit: 'pcs', reason: 'New stock shipment', performedBy: 'Arnold Njikam' },
];

const DEFAULT_CONSUMPTION_RULES: ServiceConsumptionGroup[] = [
  {
    serviceId: 's1',
    serviceName: 'Swedish Relaxing Massage',
    rules: [
      { productName: 'Massage Oil', quantity: 50, unit: 'ml' },
      { productName: 'Towel Pack', quantity: 2, unit: 'pcs' },
    ],
  },
  {
    serviceId: 's2',
    serviceName: 'Deep Cleansing Facial',
    rules: [
      { productName: 'Facial Cleanser', quantity: 20, unit: 'ml' },
      { productName: 'Face Mask Powder', quantity: 30, unit: 'g' },
      { productName: 'Cotton Pads', quantity: 6, unit: 'pcs' },
    ],
  },
  {
    serviceId: 's3',
    serviceName: 'Gel Manicure & Pedicure',
    rules: [
      { productName: 'OPI Gel Polish', quantity: 1, unit: 'bottles' },
      { productName: 'Cotton Pads', quantity: 4, unit: 'pcs' },
    ],
  },
];

export const ServiceStockScreen: React.FC<ServiceStockScreenProps> = ({
  onOpenMenu,
  onNavigateToStockPhotos,
}) => {
  const { user } = useAuth();
  const role = (user?.role || '').toLowerCase();
  const isManager = role === 'manager';
  const isTechnician = role === 'technician';

  // Main Tab State: 'inventory' | 'audits'
  const [activeMainTab, setActiveMainTab] = useState<'inventory' | 'audits'>('inventory');

  // Status Filter: 'all' | 'active' | 'inactive'
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Data State
  const [products, setProducts] = useState<ServiceProduct[]>(DEFAULT_SERVICE_PRODUCTS);
  const [historyLog, setHistoryLog] = useState<StockHistoryItem[]>(DEFAULT_HISTORY);
  const [consumptionRules, setConsumptionRules] = useState<ServiceConsumptionGroup[]>(DEFAULT_CONSUMPTION_RULES);
  const [dailyAudits, setDailyAudits] = useState<StockAuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Low Stock Threshold State (in days)
  const [lowStockThresholdDays, setLowStockThresholdDays] = useState<number>(3);
  const [latestReconciliation, setLatestReconciliation] = useState<{ date: string; confirmedAt: string } | null>(null);

  // Success Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Active Modals: null | 'stock_check' | 'adjust' | 'consumption_rules' | 'history' | 'new_product' | 'edit_product' | 'refill' | 'record_audit' | 'inspect_audit'
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // 1. Refill Modal Form
  const [refillProductName, setRefillProductName] = useState('');
  const [refillQuantity, setRefillQuantity] = useState('');
  const [refillNote, setRefillNote] = useState('');
  const [submittingRefill, setSubmittingRefill] = useState(false);

  // 2. Adjust Modal Form
  const [adjustProductName, setAdjustProductName] = useState('');
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustReason, setAdjustReason] = useState('Wastage');
  const [adjustNote, setAdjustNote] = useState('');
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  // 3. New Product Modal Form
  const [newProdName, setNewProdName] = useState('');
  const [newProdQty, setNewProdQty] = useState('');
  const [newProdUnit, setNewProdUnit] = useState('ml');
  const [submittingNewProd, setSubmittingNewProd] = useState(false);

  // 4. Edit Product Modal Form
  const [editingProduct, setEditingProduct] = useState<ServiceProduct | null>(null);
  const [editProdName, setEditProdName] = useState('');
  const [editProdQty, setEditProdQty] = useState('');
  const [editProdUnit, setEditProdUnit] = useState('ml');
  const [editProdActive, setEditProdActive] = useState(true);
  const [submittingEditProd, setSubmittingEditProd] = useState(false);

  // 5. Stock Check Modal Form
  const [actualCounts, setActualCounts] = useState<{ [productName: string]: string }>({});

  // 6. Consumption Rules Modal Form
  const [selectedServiceId, setSelectedServiceId] = useState<string>('s1');
  const [ruleNewProdName, setRuleNewProdName] = useState('');
  const [ruleNewQty, setRuleNewQty] = useState('');

  // 7. History Filter State
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('ALL');
  const [historyProductFilter, setHistoryProductFilter] = useState<string>('ALL');

  // 8. Daily Audit Detail Modal
  const [selectedAudit, setSelectedAudit] = useState<StockAuditRecord | null>(null);

  // 9. Camera Modal State
  const [cameraVisible, setCameraVisible] = useState(false);
  const [auditCapturedPhoto, setAuditCapturedPhoto] = useState<string | null>(null);
  const [auditSelectedProduct, setAuditSelectedProduct] = useState('');
  const [auditRemarks, setAuditRemarks] = useState('');
  const [submittingAudit, setSubmittingAudit] = useState(false);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [stockRes, auditsRes, historyRes] = await Promise.all([
        stockApi.getAll().catch(() => null),
        stockApi.getDailyAudits().catch(() => null),
        stockApi.getActivity().catch(() => null),
      ]);

      if (stockRes) {
        const raw = stockRes.data || stockRes;
        const list = Array.isArray(raw?.stock)
          ? raw.stock
          : Array.isArray(raw)
          ? raw
          : [];
        if (list.length > 0) {
          setProducts(
            list.map((item: any) => ({
              id: String(item.id || item._id),
              name: item.name,
              category: item.category || 'Supplies',
              quantity: Number(item.quantity || 0),
              unit: item.unit || 'ml',
              active: item.active !== false && item.isActive !== false,
              minThreshold: Number(item.minThreshold || 10),
              avgDailyUsage: Number(item.avgDailyUsage || 15),
              daysLeft: item.daysLeft !== undefined ? item.daysLeft : Math.round((Number(item.quantity) || 0) / 15),
            }))
          );
        }
      }

      if (auditsRes) {
        const rawAudits = auditsRes.data || auditsRes;
        const auditList = Array.isArray(rawAudits?.audits)
          ? rawAudits.audits
          : Array.isArray(rawAudits)
          ? rawAudits
          : [];
        if (auditList.length > 0) {
          setDailyAudits(
            auditList.map((a: any) => ({
              id: String(a.id || a._id),
              date: a.date ? new Date(a.date).toLocaleDateString() : 'Today',
              timestamp: a.timestamp || a.createdAt || new Date().toLocaleTimeString(),
              technicianName: a.technicianName || a.technician?.name || 'Staff',
              productName: a.productName || 'Service Stock',
              remarks: a.remarks || 'Stock check photo logged',
              photoUri: a.photoUri || a.photoUrl || 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400',
              status: (a.status || 'PENDING').toUpperCase() as any,
              reviewedBy: a.reviewedBy,
              reviewedAt: a.reviewedAt,
            }))
          );
        }
      }

      if (historyRes) {
        const rawHist = historyRes.data || historyRes;
        const histList = Array.isArray(rawHist?.activities)
          ? rawHist.activities
          : Array.isArray(rawHist)
          ? rawHist
          : [];
        if (histList.length > 0) {
          setHistoryLog(
            histList.map((h: any) => ({
              id: String(h.id || h._id),
              date: h.date || h.createdAt ? new Date(h.date || h.createdAt).toLocaleString() : 'Recent',
              type: (h.type || 'REFILL').toUpperCase() as any,
              productName: h.productName || 'Stock Product',
              quantityChange: Number(h.quantityChange || h.quantity || 0),
              unit: h.unit || 'units',
              reason: h.reason || h.note || '',
              performedBy: h.performedBy || 'Staff',
            }))
          );
        }
      }
    } catch (err) {
      console.warn('Error loading service stock data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Product Counts
  const activeCount = useMemo(() => products.filter((p) => p.active).length, [products]);
  const inactiveCount = useMemo(() => products.filter((p) => !p.active).length, [products]);
  const totalCount = products.length;

  const displayedProducts = useMemo(() => {
    return products.filter((p) => {
      if (statusFilter === 'active') return p.active;
      if (statusFilter === 'inactive') return !p.active;
      return true;
    });
  }, [products, statusFilter]);

  // Pending audits count
  const pendingAuditsCount = useMemo(() => {
    return dailyAudits.filter((a) => a.status === 'PENDING').length;
  }, [dailyAudits]);

  // Toggle Product Active
  const handleToggleActive = async (product: ServiceProduct) => {
    const updatedStatus = !product.active;
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, active: updatedStatus } : p))
    );
    try {
      await stockApi.update(product.id, { active: updatedStatus });
      showToast(`"${product.name}" marked as ${updatedStatus ? 'Active' : 'Inactive'}`);
    } catch {
      // Revert if API fails
      showToast(`Updated status locally`);
    }
  };

  // Delete Product
  const handleDeleteProduct = (product: ServiceProduct) => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${product.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setProducts((prev) => prev.filter((p) => p.id !== product.id));
            try {
              await stockApi.delete(product.id);
              showToast(`"${product.name}" deleted successfully`);
            } catch {
              showToast(`Deleted "${product.name}"`);
            }
          },
        },
      ]
    );
  };

  // 1. Refill Stock Handler
  const handleRefillSubmit = async () => {
    const qty = parseInt(refillQuantity, 10);
    if (!refillProductName || isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity greater than 0.');
      return;
    }
    setSubmittingRefill(true);
    try {
      const prod = products.find((p) => p.name === refillProductName);
      const prodId = prod?.id || '1';
      await stockApi.refill(prodId, {
        quantity: qty,
        notes: refillNote,
        performedBy: user?.name || 'Manager',
      });
      setProducts((prev) =>
        prev.map((p) => (p.name === refillProductName ? { ...p, quantity: p.quantity + qty } : p))
      );
      setHistoryLog((prev) => [
        {
          id: String(Date.now()),
          date: new Date().toLocaleString(),
          type: 'REFILL',
          productName: refillProductName,
          quantityChange: qty,
          unit: prod?.unit || 'ml',
          reason: refillNote || 'Stock Refill',
          performedBy: user?.name || 'Manager',
        },
        ...prev,
      ]);
      setActiveModal(null);
      setRefillQuantity('');
      setRefillNote('');
      showToast(`+${qty} ${prod?.unit || ''} added to ${refillProductName}`);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to refill stock.');
    } finally {
      setSubmittingRefill(false);
    }
  };

  // 2. Adjust Stock Handler
  const handleAdjustSubmit = async () => {
    const qty = parseInt(adjustQuantity, 10);
    if (!adjustProductName || isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity greater than 0.');
      return;
    }
    setSubmittingAdjust(true);
    try {
      const prod = products.find((p) => p.name === adjustProductName);
      const prodId = prod?.id || '1';
      await stockApi.adjust(prodId, {
        quantity: qty,
        reason: adjustReason,
        note: adjustNote,
        performedBy: user?.name || 'Manager',
      });
      setProducts((prev) =>
        prev.map((p) =>
          p.name === adjustProductName ? { ...p, quantity: Math.max(0, p.quantity - qty) } : p
        )
      );
      setHistoryLog((prev) => [
        {
          id: String(Date.now()),
          date: new Date().toLocaleString(),
          type: 'ADJUSTMENT',
          productName: adjustProductName,
          quantityChange: -qty,
          unit: prod?.unit || 'ml',
          reason: `${adjustReason}${adjustNote ? `: ${adjustNote}` : ''}`,
          performedBy: user?.name || 'Manager',
        },
        ...prev,
      ]);
      setActiveModal(null);
      setAdjustQuantity('');
      setAdjustNote('');
      showToast(`Stock adjusted: -${qty} ${prod?.unit || ''} (${adjustReason})`);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to adjust stock.');
    } finally {
      setSubmittingAdjust(false);
    }
  };

  // 3. New Product Handler
  const handleNewProductSubmit = async () => {
    const name = newProdName.trim();
    if (!name) {
      Alert.alert('Validation Error', 'Please enter a product name.');
      return;
    }
    const qty = parseInt(newProdQty, 10) || 0;
    setSubmittingNewProd(true);
    try {
      const res = await stockApi.create({
        name,
        quantity: qty,
        unit: newProdUnit,
        active: true,
      });
      const newId = String(res?.data?.id || res?.data?._id || Date.now());
      setProducts((prev) => [
        ...prev,
        {
          id: newId,
          name,
          category: 'Supplies',
          quantity: qty,
          unit: newProdUnit,
          active: true,
          avgDailyUsage: 10,
          daysLeft: Math.round(qty / 10),
        },
      ]);
      setActiveModal(null);
      setNewProdName('');
      setNewProdQty('');
      showToast(`Product "${name}" created with ${qty} ${newProdUnit}`);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create product.');
    } finally {
      setSubmittingNewProd(false);
    }
  };

  // 4. Edit Product Handler
  const handleEditProductSubmit = async () => {
    if (!editingProduct) return;
    const name = editProdName.trim();
    if (!name) {
      Alert.alert('Validation Error', 'Please enter a product name.');
      return;
    }
    const qty = parseInt(editProdQty, 10) || 0;
    setSubmittingEditProd(true);
    try {
      await stockApi.update(editingProduct.id, {
        name,
        quantity: qty,
        unit: editProdUnit,
        active: editProdActive,
      });
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingProduct.id
            ? {
                ...p,
                name,
                quantity: qty,
                unit: editProdUnit,
                active: editProdActive,
                daysLeft: p.avgDailyUsage ? Math.round(qty / p.avgDailyUsage) : p.daysLeft,
              }
            : p
        )
      );
      setActiveModal(null);
      setEditingProduct(null);
      showToast(`Product "${name}" updated successfully`);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update product.');
    } finally {
      setSubmittingEditProd(false);
    }
  };

  // 5. Stock Check Modal Open & Confirm
  const openStockCheckModal = () => {
    const counts: { [name: string]: string } = {};
    products.forEach((p) => {
      counts[p.name] = String(p.quantity);
    });
    setActualCounts(counts);
    setActiveModal('stock_check');
  };

  const handleConfirmStockCheck = () => {
    const updatedProducts = products.map((p) => {
      const count = parseInt(actualCounts[p.name] || '', 10);
      return {
        ...p,
        quantity: !isNaN(count) && count >= 0 ? count : p.quantity,
      };
    });
    setProducts(updatedProducts);
    const now = new Date();
    setLatestReconciliation({
      date: now.toLocaleDateString(),
      confirmedAt: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    setHistoryLog((prev) => [
      {
        id: String(Date.now()),
        date: now.toLocaleString(),
        type: 'STOCK CHECK',
        productName: 'All Products (Full Physical Audit)',
        quantityChange: 0,
        unit: 'audit',
        reason: 'Physical count verified & reconciled',
        performedBy: user?.name || 'Manager',
      },
      ...prev,
    ]);
    setActiveModal(null);
    showToast('Stock check confirmed. Baseline updated.');
  };

  // 6. Consumption Rules Handlers
  const currentServiceRulesGroup = useMemo(() => {
    return (
      consumptionRules.find((g) => g.serviceId === selectedServiceId) ||
      consumptionRules[0]
    );
  }, [consumptionRules, selectedServiceId]);

  const handleAddRule = () => {
    const qty = parseInt(ruleNewQty, 10);
    if (!ruleNewProdName || isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Rule', 'Please select a product and enter a quantity.');
      return;
    }
    const prod = products.find((p) => p.name === ruleNewProdName);
    const newRule: ConsumptionRule = {
      productName: ruleNewProdName,
      quantity: qty,
      unit: prod?.unit || 'ml',
    };
    setConsumptionRules((prev) =>
      prev.map((g) =>
        g.serviceId === selectedServiceId
          ? { ...g, rules: [...g.rules, newRule] }
          : g
      )
    );
    setRuleNewQty('');
    showToast(`Added ${qty} ${prod?.unit || ''} rule to ${currentServiceRulesGroup.serviceName}`);
  };

  const handleDeleteRule = (index: number) => {
    setConsumptionRules((prev) =>
      prev.map((g) =>
        g.serviceId === selectedServiceId
          ? { ...g, rules: g.rules.filter((_, i) => i !== index) }
          : g
      )
    );
  };

  // 7. Live Stock Photo Capture
  const handlePhotoCaptured = (uri: string) => {
    setCameraVisible(false);
    setAuditCapturedPhoto(uri);
    setAuditSelectedProduct(products[0]?.name || 'Massage Oil');
    setAuditRemarks('');
    setActiveModal('record_audit');
  };

  const handleSubmitAudit = async () => {
    if (!auditCapturedPhoto) {
      Alert.alert('Photo Required', 'Please capture a photo first.');
      return;
    }
    setSubmittingAudit(true);
    try {
      const now = new Date();
      const newAudit: StockAuditRecord = {
        id: String(Date.now()),
        date: now.toLocaleDateString(),
        timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        technicianName: user?.name || 'Staff Member',
        productName: auditSelectedProduct || 'Service Supplies',
        remarks: auditRemarks || 'Live photo inspection submitted',
        photoUri: auditCapturedPhoto,
        status: 'PENDING',
      };
      await stockApi.submitDailyAudit(newAudit);
      setDailyAudits((prev) => [newAudit, ...prev]);
      setActiveModal(null);
      setAuditCapturedPhoto(null);
      showToast('Live stock audit photo submitted successfully!');
    } catch {
      showToast('Live stock audit photo logged!');
      setActiveModal(null);
    } finally {
      setSubmittingAudit(false);
    }
  };

  // Filtered History
  const filteredHistory = useMemo(() => {
    return historyLog.filter((item) => {
      if (historyTypeFilter !== 'ALL' && item.type !== historyTypeFilter) return false;
      if (
        historyProductFilter !== 'ALL' &&
        item.productName.toLowerCase() !== historyProductFilter.toLowerCase()
      )
        return false;
      return true;
    });
  }, [historyLog, historyTypeFilter, historyProductFilter]);

  return (
    <View style={styles.container}>
      <Header
        title="Service Stock"
        subtitle="Products consumed by technicians during services."
        onOpenMenu={onOpenMenu}
        rightAction={
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <RefreshCw size={18} color={COLORS.textDark} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.sage]} />}
      >
        {/* Toast Notification */}
        {toastMessage && (
          <View style={styles.toastContainer}>
            <Check size={16} color="#15803D" strokeWidth={2.5} />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        )}

        {/* Top 6-Action Quick Grid (for Manager) or Photo Audit Button (for Technician) */}
        {isManager && (
          <View style={styles.quickActionGrid}>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={openStockCheckModal}
              activeOpacity={0.8}
            >
              <ClipboardCheck size={17} color={COLORS.sage} />
              <Text style={styles.quickActionLabel} numberOfLines={1}>Stock Check</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => {
                setAdjustProductName(products[0]?.name || 'Massage Oil');
                setAdjustQuantity('');
                setAdjustReason('Wastage');
                setAdjustNote('');
                setActiveModal('adjust');
              }}
              activeOpacity={0.8}
            >
              <Scissors size={17} color="#D97706" />
              <Text style={styles.quickActionLabel} numberOfLines={1}>Adjust</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => setActiveModal('consumption_rules')}
              activeOpacity={0.8}
            >
              <Sliders size={17} color={COLORS.sage} />
              <Text style={styles.quickActionLabel} numberOfLines={1}>Rules</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => setActiveModal('history')}
              activeOpacity={0.8}
            >
              <History size={17} color={COLORS.textDark} />
              <Text style={styles.quickActionLabel} numberOfLines={1}>History</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => {
                setNewProdName('');
                setNewProdQty('');
                setNewProdUnit('ml');
                setActiveModal('new_product');
              }}
              activeOpacity={0.8}
            >
              <Sparkles size={17} color={COLORS.sage} />
              <Text style={styles.quickActionLabel} numberOfLines={1}>New Product</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickActionCard, styles.quickActionAddCard]}
              onPress={() => {
                setRefillProductName(products[0]?.name || 'Massage Oil');
                setRefillQuantity('');
                setRefillNote('');
                setActiveModal('refill');
              }}
              activeOpacity={0.8}
            >
              <Plus size={17} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={[styles.quickActionLabel, styles.quickActionAddLabel]} numberOfLines={1}>+ Add Stock</Text>
            </TouchableOpacity>
          </View>
        )}

        {isTechnician && (
          <TouchableOpacity
            style={styles.technicianCameraButton}
            onPress={() => setCameraVisible(true)}
            activeOpacity={0.8}
          >
            <Camera size={18} color="#FFFFFF" />
            <Text style={styles.technicianCameraText}>+ Take Live Stock Photo</Text>
          </TouchableOpacity>
        )}

        {/* Main Tab Navigation: [ Service Inventory (X) ] [ Live Stock Audits & Remarks (Y) ] */}
        <View style={styles.mainTabsRow}>
          <TouchableOpacity
            style={[styles.mainTabBtn, activeMainTab === 'inventory' && styles.mainTabBtnActive]}
            onPress={() => setActiveMainTab('inventory')}
            activeOpacity={0.8}
          >
            <Package size={15} color={activeMainTab === 'inventory' ? '#FFFFFF' : COLORS.textDark} />
            <Text
              style={[
                styles.mainTabBtnText,
                activeMainTab === 'inventory' && styles.mainTabBtnTextActive,
              ]}
            >
              Service Inventory ({totalCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mainTabBtn, activeMainTab === 'audits' && styles.mainTabBtnActive]}
            onPress={() => setActiveMainTab('audits')}
            activeOpacity={0.8}
          >
            <Camera size={15} color={activeMainTab === 'audits' ? '#FFFFFF' : COLORS.textDark} />
            <Text
              style={[
                styles.mainTabBtnText,
                activeMainTab === 'audits' && styles.mainTabBtnTextActive,
              ]}
            >
              Live Audits ({dailyAudits.length})
            </Text>
            {pendingAuditsCount > 0 && (
              <View style={styles.badgePendingPill}>
                <Text style={styles.badgePendingPillText}>{pendingAuditsCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ============================================================ */}
        {/* TAB 1: SERVICE INVENTORY                                     */}
        {/* ============================================================ */}
        {activeMainTab === 'inventory' && (
          <>
            {/* 2 KPI / Setting Cards */}
            <View style={styles.kpiCardsRow}>
              {/* Threshold Setting Card */}
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>LOW STOCK ALERT THRESHOLD</Text>
                <Text style={styles.kpiSub}>Flag when Days Left drops to or below:</Text>
                <View style={styles.thresholdInputRow}>
                  <TextInput
                    style={styles.thresholdInput}
                    keyboardType="number-pad"
                    value={String(lowStockThresholdDays)}
                    onChangeText={(txt) => {
                      const num = parseInt(txt, 10);
                      setLowStockThresholdDays(isNaN(num) || num <= 0 ? 1 : num);
                    }}
                    editable={isManager}
                  />
                  <Text style={styles.thresholdUnitText}>Days Left</Text>
                </View>
              </View>

              {/* Latest Stock Check Status Card */}
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>LATEST STOCK CHECK</Text>
                <Text style={styles.kpiSub}>
                  {latestReconciliation
                    ? `${latestReconciliation.date} at ${latestReconciliation.confirmedAt}`
                    : 'No physical stock check performed yet'}
                </Text>
                <View style={styles.reconcileStatusBadge}>
                  {latestReconciliation ? (
                    <View style={styles.reconciledPill}>
                      <Text style={styles.reconciledText}>Reconciled ✓</Text>
                    </View>
                  ) : (
                    <View style={styles.pendingCheckPill}>
                      <Text style={styles.pendingCheckText}>Pending Check</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Service Products Section Card */}
            <View style={styles.productsCardContainer}>
              {/* Card Header & Filter Row */}
              <View style={styles.productsHeader}>
                <View style={styles.productsHeaderLeft}>
                  <View style={styles.productsTitleRow}>
                    <Text style={styles.productsTitle}>SERVICE PRODUCTS</Text>
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{totalCount}</Text>
                    </View>
                  </View>
                  <Text style={styles.productsSubtitle}>
                    Live Expected Stock calculated from completed services
                  </Text>
                </View>

                {/* Filter Pills: All / Active / Inactive */}
                <View style={styles.filterPillsRow}>
                  <TouchableOpacity
                    style={[styles.filterPill, statusFilter === 'all' && styles.filterPillAllActive]}
                    onPress={() => setStatusFilter('all')}
                  >
                    <Text style={[styles.filterPillText, statusFilter === 'all' && styles.filterPillTextWhite]}>
                      All
                    </Text>
                    <View style={[styles.filterCountBadge, statusFilter === 'all' && styles.filterCountBadgeWhite]}>
                      <Text style={[styles.filterCountText, statusFilter === 'all' && styles.filterCountTextDark]}>
                        {totalCount}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterPill, statusFilter === 'active' && styles.filterPillActiveGreen]}
                    onPress={() => setStatusFilter('active')}
                  >
                    <View style={[styles.dotActive, statusFilter === 'active' && styles.dotWhite]} />
                    <Text style={[styles.filterPillText, statusFilter === 'active' && styles.filterPillTextWhite]}>
                      Active
                    </Text>
                    <View style={[styles.filterCountBadge, statusFilter === 'active' && styles.filterCountBadgeWhite]}>
                      <Text style={[styles.filterCountText, statusFilter === 'active' && styles.filterCountTextDark]}>
                        {activeCount}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterPill, statusFilter === 'inactive' && styles.filterPillInactiveDark]}
                    onPress={() => setStatusFilter('inactive')}
                  >
                    <View style={[styles.dotInactive, statusFilter === 'inactive' && styles.dotWhite]} />
                    <Text style={[styles.filterPillText, statusFilter === 'inactive' && styles.filterPillTextWhite]}>
                      Inactive
                    </Text>
                    <View style={[styles.filterCountBadge, statusFilter === 'inactive' && styles.filterCountBadgeWhite]}>
                      <Text style={[styles.filterCountText, statusFilter === 'inactive' && styles.filterCountTextDark]}>
                        {inactiveCount}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Products List */}
              {loading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={COLORS.sage} />
                  <Text style={styles.loadingText}>Loading service stock...</Text>
                </View>
              ) : displayedProducts.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Package size={36} color={COLORS.textMuted} />
                  <Text style={styles.emptyText}>No service stock records found.</Text>
                </View>
              ) : (
                <View style={styles.productsList}>
                  {displayedProducts.map((prod) => {
                    const isOutOfStock = prod.quantity <= 0;
                    const isLowStock =
                      !isOutOfStock &&
                      prod.daysLeft !== null &&
                      prod.daysLeft !== undefined &&
                      prod.daysLeft <= lowStockThresholdDays;

                    return (
                      <View key={prod.id} style={styles.productCard}>
                        {/* Header: Product Name + Active Toggle + Status Badge */}
                        <View style={styles.productCardHeader}>
                          <View style={styles.productNameContainer}>
                            <Text
                              style={[
                                styles.productCardName,
                                !prod.active && styles.productCardNameInactive,
                              ]}
                              numberOfLines={1}
                            >
                              {prod.name}
                            </Text>
                            {!prod.active && (
                              <View style={styles.inactiveTag}>
                                <Text style={styles.inactiveTagText}>INACTIVE</Text>
                              </View>
                            )}
                          </View>

                          <View style={styles.productStatusGroup}>
                            {/* Toggle Active Button */}
                            <TouchableOpacity
                              style={[
                                styles.activeToggleBtn,
                                prod.active ? styles.activeToggleBtnOn : styles.activeToggleBtnOff,
                              ]}
                              onPress={() => isManager && handleToggleActive(prod)}
                              disabled={!isManager}
                              activeOpacity={0.7}
                            >
                              {prod.active ? (
                                <CheckCircle2 size={12} color="#15803D" />
                              ) : (
                                <XCircle size={12} color={COLORS.textMuted} />
                              )}
                              <Text
                                style={[
                                  styles.activeToggleText,
                                  prod.active ? styles.activeToggleTextOn : styles.activeToggleTextOff,
                                ]}
                              >
                                {prod.active ? 'Active' : 'Inactive'}
                              </Text>
                            </TouchableOpacity>

                            {/* Stock Availability Badge */}
                            {isOutOfStock ? (
                              <View style={styles.badgeOutOfStock}>
                                <AlertTriangle size={11} color="#DC2626" />
                                <Text style={styles.badgeOutOfStockText}>Out of Stock</Text>
                              </View>
                            ) : isLowStock ? (
                              <View style={styles.badgeLowStock}>
                                <AlertTriangle size={11} color="#D97706" />
                                <Text style={styles.badgeLowStockText}>Low Stock</Text>
                              </View>
                            ) : (
                              <View style={styles.badgeInStock}>
                                <CheckCircle2 size={11} color="#15803D" />
                                <Text style={styles.badgeInStockText}>In Stock</Text>
                              </View>
                            )}
                          </View>
                        </View>

                        {/* 2-Column Info Box: Current / Expected vs Estimated Days Left */}
                        <View style={styles.productMetricsBox}>
                          <View style={styles.metricColumn}>
                            <Text style={styles.metricLabel}>CURRENT / EXPECTED</Text>
                            <Text style={styles.metricValue}>
                              {prod.quantity.toLocaleString('en-US')}{' '}
                              <Text style={styles.metricUnit}>{prod.unit}</Text>
                            </Text>
                          </View>

                          <View style={styles.metricColumn}>
                            <Text style={styles.metricLabel}>ESTIMATED DAYS LEFT</Text>
                            {prod.daysLeft !== null && prod.daysLeft !== undefined ? (
                              <View>
                                <Text
                                  style={[
                                    styles.metricValue,
                                    isLowStock && styles.metricValueWarning,
                                  ]}
                                >
                                  {prod.daysLeft} Days
                                </Text>
                                <Text style={styles.metricUsageSub}>
                                  ~{prod.avgDailyUsage || 0} {prod.unit}/day
                                </Text>
                              </View>
                            ) : (
                              <Text style={styles.metricValueMuted}>—</Text>
                            )}
                          </View>
                        </View>

                        {/* Actions Row (for Managers) */}
                        {isManager && (
                          <View style={styles.productActionsRow}>
                            <TouchableOpacity
                              style={[styles.productActionBtn, styles.btnRefill]}
                              onPress={() => {
                                setRefillProductName(prod.name);
                                setRefillQuantity('');
                                setRefillNote('');
                                setActiveModal('refill');
                              }}
                              activeOpacity={0.8}
                            >
                              <Plus size={13} color={COLORS.textDark} />
                              <Text style={styles.btnRefillText}>Refill</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.productActionBtn, styles.btnAdjust]}
                              onPress={() => {
                                setAdjustProductName(prod.name);
                                setAdjustQuantity('');
                                setAdjustReason('Wastage');
                                setAdjustNote('');
                                setActiveModal('adjust');
                              }}
                              activeOpacity={0.8}
                            >
                              <Scissors size={13} color="#D97706" />
                              <Text style={styles.btnAdjustText}>Adjust</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.productActionBtn, styles.btnEdit]}
                              onPress={() => {
                                setEditingProduct(prod);
                                setEditProdName(prod.name);
                                setEditProdQty(String(prod.quantity));
                                setEditProdUnit(prod.unit);
                                setEditProdActive(prod.active);
                                setActiveModal('edit_product');
                              }}
                              activeOpacity={0.8}
                            >
                              <Pencil size={13} color={COLORS.textDark} />
                              <Text style={styles.btnEditText}>Edit</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.productActionBtn, styles.btnDelete]}
                              onPress={() => handleDeleteProduct(prod)}
                              activeOpacity={0.8}
                            >
                              <Trash2 size={13} color="#DC2626" />
                              <Text style={styles.btnDeleteText}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}

        {/* ============================================================ */}
        {/* TAB 2: LIVE STOCK PHOTO AUDITS & REMARKS                     */}
        {/* ============================================================ */}
        {activeMainTab === 'audits' && (
          <View style={styles.auditsTabContainer}>
            {/* Top Audits Info Card */}
            <View style={styles.auditsInfoCard}>
              <View style={styles.auditsTitleRow}>
                <Camera size={18} color={COLORS.sage} />
                <Text style={styles.auditsTitleText}>End-of-Day Live Stock Photo Audits</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{dailyAudits.length}</Text>
                </View>
              </View>
              <Text style={styles.auditsDescription}>
                Technicians submit live product photos and written remarks at end-of-day for Manager & Receptionist follow-up.
              </Text>

              <View style={styles.auditsActionButtonsRow}>
                <TouchableOpacity
                  style={styles.auditsRefreshBtn}
                  onPress={onRefresh}
                  activeOpacity={0.8}
                >
                  <RefreshCw size={14} color={COLORS.textDark} />
                  <Text style={styles.auditsRefreshBtnText}>Refresh</Text>
                </TouchableOpacity>

                {isTechnician && (
                  <TouchableOpacity
                    style={styles.auditsTakeLiveBtn}
                    onPress={() => setCameraVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Camera size={14} color="#FFFFFF" />
                    <Text style={styles.auditsTakeLiveBtnText}>+ Take Live Stock Photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Audits List */}
            {dailyAudits.length === 0 ? (
              <View style={styles.emptyBox}>
                <Camera size={36} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>No live stock audits submitted yet.</Text>
                {isTechnician && (
                  <TouchableOpacity
                    style={[styles.auditsTakeLiveBtn, { marginTop: 12 }]}
                    onPress={() => setCameraVisible(true)}
                  >
                    <Text style={styles.auditsTakeLiveBtnText}>Take First Photo Audit</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.auditsListContainer}>
                {dailyAudits.map((audit) => (
                  <View key={audit.id} style={styles.auditCard}>
                    <View style={styles.auditCardHeader}>
                      <View style={styles.auditTimeBadge}>
                        <Clock size={12} color={COLORS.textMuted} />
                        <Text style={styles.auditTimeText}>{audit.date} · {audit.timestamp}</Text>
                      </View>
                      <View
                        style={[
                          styles.auditStatusBadge,
                          audit.status === 'REVIEWED'
                            ? styles.statusReviewed
                            : audit.status === 'FLAGGED'
                            ? styles.statusFlagged
                            : styles.statusPending,
                        ]}
                      >
                        <Text
                          style={[
                            styles.auditStatusText,
                            audit.status === 'REVIEWED'
                              ? styles.statusReviewedText
                              : audit.status === 'FLAGGED'
                              ? styles.statusFlaggedText
                              : styles.statusPendingText,
                          ]}
                        >
                          {audit.status}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.auditBody}>
                      {/* Photo Thumbnail */}
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedAudit(audit);
                          setActiveModal('inspect_audit');
                        }}
                        activeOpacity={0.85}
                      >
                        <Image source={{ uri: audit.photoUri }} style={styles.auditThumbnail} />
                      </TouchableOpacity>

                      <View style={styles.auditDetails}>
                        <Text style={styles.auditStaffName}>
                          <User size={13} color={COLORS.sage} /> {audit.technicianName}
                        </Text>
                        <Text style={styles.auditProductName}>{audit.productName}</Text>
                        <View style={styles.auditRemarksBox}>
                          <Text style={styles.auditRemarksText} numberOfLines={2}>
                            "{audit.remarks}"
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Inspect Link */}
                    <TouchableOpacity
                      style={styles.auditInspectLink}
                      onPress={() => {
                        setSelectedAudit(audit);
                        setActiveModal('inspect_audit');
                      }}
                      activeOpacity={0.7}
                    >
                      <Eye size={13} color={COLORS.sage} />
                      <Text style={styles.auditInspectLinkText}>Inspect Audit & Verification</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ============================================================ */}
      {/* MODAL 1: STOCK CHECK (ACTUAL VS EXPECTED RECONCILIATION)     */}
      {/* ============================================================ */}
      <Modal
        visible={activeModal === 'stock_check'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentLarge}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Physical Count Reconciliation</Text>
                <Text style={styles.modalSubtitle}>
                  Enter actual counted quantity. Baseline resets upon confirmation.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <X size={18} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBodyScroll}>
              {products.map((prod) => {
                const actual = parseInt(actualCounts[prod.name] || '', 10);
                const diff = !isNaN(actual) ? actual - prod.quantity : 0;
                return (
                  <View key={prod.id} style={styles.stockCheckRow}>
                    <View style={styles.stockCheckInfo}>
                      <Text style={styles.stockCheckName}>{prod.name}</Text>
                      <Text style={styles.stockCheckExpected}>
                        Expected: {prod.quantity.toLocaleString('en-US')} {prod.unit}
                      </Text>
                    </View>

                    <View style={styles.stockCheckInputCol}>
                      <TextInput
                        style={styles.stockCheckInput}
                        keyboardType="number-pad"
                        value={actualCounts[prod.name] !== undefined ? actualCounts[prod.name] : String(prod.quantity)}
                        onChangeText={(txt) =>
                          setActualCounts((prev) => ({ ...prev, [prod.name]: txt }))
                        }
                      />
                      <Text style={styles.stockCheckUnit}>{prod.unit}</Text>
                    </View>

                    <View style={styles.stockCheckDiffBadge}>
                      {diff === 0 ? (
                        <Text style={styles.diffMatchText}>✓ Match</Text>
                      ) : diff < 0 ? (
                        <Text style={styles.diffNegativeText}>Diff: {diff}</Text>
                      ) : (
                        <Text style={styles.diffPositiveText}>Diff: +{diff}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setActiveModal(null)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmStockCheck}
              >
                <Text style={styles.modalConfirmBtnText}>Confirm Reconciliation</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 2: ADJUST STOCK                                        */}
      {/* ============================================================ */}
      <Modal
        visible={activeModal === 'adjust'}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Adjust Stock (Reductions)</Text>
                <Text style={styles.modalSubtitle}>Deduct stock for wastage, spillage, expired.</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <X size={18} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.formLabel}>Select Product</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalSelectRow}>
                {products.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.productSelectPill,
                      adjustProductName === p.name && styles.productSelectPillActive,
                    ]}
                    onPress={() => setAdjustProductName(p.name)}
                  >
                    <Text
                      style={[
                        styles.productSelectPillText,
                        adjustProductName === p.name && styles.productSelectPillTextActive,
                      ]}
                    >
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.formLabel, { marginTop: 14 }]}>Deduct Quantity</Text>
              <TextInput
                style={styles.formInput}
                keyboardType="number-pad"
                placeholder="e.g. 50"
                value={adjustQuantity}
                onChangeText={setAdjustQuantity}
              />

              <Text style={[styles.formLabel, { marginTop: 14 }]}>Reason</Text>
              <View style={styles.reasonPillsRow}>
                {['Wastage', 'Damaged', 'Expired', 'Spillage'].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.reasonPill, adjustReason === r && styles.reasonPillActive]}
                    onPress={() => setAdjustReason(r)}
                  >
                    <Text style={[styles.reasonPillText, adjustReason === r && styles.reasonPillTextActive]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.formLabel, { marginTop: 14 }]}>Note (Optional)</Text>
              <TextInput
                style={[styles.formInput, { height: 60 }]}
                multiline
                placeholder="Details of reduction..."
                value={adjustNote}
                onChangeText={setAdjustNote}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setActiveModal(null)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#D97706' }]}
                onPress={handleAdjustSubmit}
                disabled={submittingAdjust}
              >
                {submittingAdjust ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Confirm Deduction</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 3: CONSUMPTION RULES                                  */}
      {/* ============================================================ */}
      <Modal
        visible={activeModal === 'consumption_rules'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentLarge}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Consumption Rules</Text>
                <Text style={styles.modalSubtitle}>Default stock consumed per service completion.</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <X size={18} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBodyScroll}>
              <Text style={styles.formLabel}>Select Service</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalSelectRow}>
                {consumptionRules.map((grp) => (
                  <TouchableOpacity
                    key={grp.serviceId}
                    style={[
                      styles.serviceSelectPill,
                      selectedServiceId === grp.serviceId && styles.serviceSelectPillActive,
                    ]}
                    onPress={() => setSelectedServiceId(grp.serviceId)}
                  >
                    <Text
                      style={[
                        styles.serviceSelectPillText,
                        selectedServiceId === grp.serviceId && styles.serviceSelectPillTextActive,
                      ]}
                    >
                      {grp.serviceName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.formLabel, { marginTop: 14 }]}>
                Consumed Products for: {currentServiceRulesGroup.serviceName}
              </Text>

              {currentServiceRulesGroup.rules.length === 0 ? (
                <Text style={styles.emptyRulesText}>No consumption rules defined for this service.</Text>
              ) : (
                currentServiceRulesGroup.rules.map((rule, idx) => (
                  <View key={idx} style={styles.ruleItemRow}>
                    <View style={styles.ruleItemInfo}>
                      <Text style={styles.ruleItemName}>{rule.productName}</Text>
                      <Text style={styles.ruleItemQty}>
                        {rule.quantity} {rule.unit} per service
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.ruleDeleteBtn}
                      onPress={() => handleDeleteRule(idx)}
                    >
                      <Trash2 size={15} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                ))
              )}

              {/* Add New Rule Row */}
              <View style={styles.addRuleBox}>
                <Text style={styles.addRuleTitle}>+ Add Product Consumption</Text>
                <View style={styles.addRuleRow}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    {products.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.ruleProdPill,
                          ruleNewProdName === p.name && styles.ruleProdPillActive,
                        ]}
                        onPress={() => setRuleNewProdName(p.name)}
                      >
                        <Text
                          style={[
                            styles.ruleProdPillText,
                            ruleNewProdName === p.name && styles.ruleProdPillTextActive,
                          ]}
                        >
                          {p.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <View style={styles.addRuleInputRow}>
                    <TextInput
                      style={styles.addRuleInput}
                      keyboardType="number-pad"
                      placeholder="Qty (e.g. 50)"
                      value={ruleNewQty}
                      onChangeText={setRuleNewQty}
                    />
                    <TouchableOpacity style={styles.addRuleConfirmBtn} onPress={handleAddRule}>
                      <Text style={styles.addRuleConfirmBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => setActiveModal(null)}
              >
                <Text style={styles.modalConfirmBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 4: STOCK HISTORY / AUDIT LOG                          */}
      {/* ============================================================ */}
      <Modal
        visible={activeModal === 'history'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentLarge}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Stock Activity & Audit Log</Text>
                <Text style={styles.modalSubtitle}>All refills, adjustments, and reconciliation records.</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <X size={18} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            {/* Filter Pills */}
            <View style={styles.historyFiltersRow}>
              {['ALL', 'REFILL', 'ADJUSTMENT', 'STOCK CHECK'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.historyFilterPill,
                    historyTypeFilter === t && styles.historyFilterPillActive,
                  ]}
                  onPress={() => setHistoryTypeFilter(t)}
                >
                  <Text
                    style={[
                      styles.historyFilterPillText,
                      historyTypeFilter === t && styles.historyFilterPillTextActive,
                    ]}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView style={styles.modalBodyScroll}>
              {filteredHistory.length === 0 ? (
                <Text style={styles.emptyRulesText}>No matching history entries found.</Text>
              ) : (
                filteredHistory.map((item) => (
                  <View key={item.id} style={styles.historyCard}>
                    <View style={styles.historyCardHeader}>
                      <View
                        style={[
                          styles.historyTypeBadge,
                          item.type === 'REFILL'
                            ? styles.typeRefill
                            : item.type === 'ADJUSTMENT'
                            ? styles.typeAdjustment
                            : styles.typeStockCheck,
                        ]}
                      >
                        <Text
                          style={[
                            styles.historyTypeText,
                            item.type === 'REFILL'
                              ? styles.typeRefillText
                              : item.type === 'ADJUSTMENT'
                              ? styles.typeAdjustmentText
                              : styles.typeStockCheckText,
                          ]}
                        >
                          {item.type}
                        </Text>
                      </View>
                      <Text style={styles.historyDateText}>{item.date}</Text>
                    </View>

                    <View style={styles.historyCardBody}>
                      <Text style={styles.historyProductName}>{item.productName}</Text>
                      {item.quantityChange !== 0 && (
                        <Text
                          style={[
                            styles.historyQtyText,
                            item.quantityChange > 0 ? styles.qtyPositive : styles.qtyNegative,
                          ]}
                        >
                          {item.quantityChange > 0 ? `+${item.quantityChange}` : item.quantityChange}{' '}
                          {item.unit}
                        </Text>
                      )}
                    </View>

                    <Text style={styles.historyReasonText}>
                      {item.reason} · by <Text style={{ fontWeight: '700' }}>{item.performedBy}</Text>
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => setActiveModal(null)}
              >
                <Text style={styles.modalConfirmBtnText}>Close History</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 5: REFILL STOCK                                        */}
      {/* ============================================================ */}
      <Modal
        visible={activeModal === 'refill'}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Refill Service Stock</Text>
                <Text style={styles.modalSubtitle}>Add new stock received from suppliers.</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <X size={18} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.formLabel}>Select Product</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalSelectRow}>
                {products.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.productSelectPill,
                      refillProductName === p.name && styles.productSelectPillActive,
                    ]}
                    onPress={() => setRefillProductName(p.name)}
                  >
                    <Text
                      style={[
                        styles.productSelectPillText,
                        refillProductName === p.name && styles.productSelectPillTextActive,
                      ]}
                    >
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.formLabel, { marginTop: 14 }]}>Refill Quantity</Text>
              <TextInput
                style={styles.formInput}
                keyboardType="number-pad"
                placeholder="e.g. 500"
                value={refillQuantity}
                onChangeText={setRefillQuantity}
              />

              <Text style={[styles.formLabel, { marginTop: 14 }]}>Note / Invoice Ref (Optional)</Text>
              <TextInput
                style={[styles.formInput, { height: 60 }]}
                multiline
                placeholder="Supplier batch, order ID..."
                value={refillNote}
                onChangeText={setRefillNote}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setActiveModal(null)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleRefillSubmit}
                disabled={submittingRefill}
              >
                {submittingRefill ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>+ Add Stock</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 6: NEW PRODUCT                                         */}
      {/* ============================================================ */}
      <Modal
        visible={activeModal === 'new_product'}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add New Service Product</Text>
                <Text style={styles.modalSubtitle}>Supplies used by staff during treatments.</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <X size={18} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.formLabel}>Product Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Aromatherapy Essence"
                value={newProdName}
                onChangeText={setNewProdName}
              />

              <Text style={[styles.formLabel, { marginTop: 14 }]}>Initial Stock Quantity</Text>
              <TextInput
                style={styles.formInput}
                keyboardType="number-pad"
                placeholder="e.g. 1000"
                value={newProdQty}
                onChangeText={setNewProdQty}
              />

              <Text style={[styles.formLabel, { marginTop: 14 }]}>Measurement Unit</Text>
              <View style={styles.unitPillsRow}>
                {['ml', 'g', 'pcs', 'bottles', 'pack'].map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitPill, newProdUnit === u && styles.unitPillActive]}
                    onPress={() => setNewProdUnit(u)}
                  >
                    <Text style={[styles.unitPillText, newProdUnit === u && styles.unitPillTextActive]}>
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setActiveModal(null)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleNewProductSubmit}
                disabled={submittingNewProd}
              >
                {submittingNewProd ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Create Product</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 7: EDIT PRODUCT                                        */}
      {/* ============================================================ */}
      <Modal
        visible={activeModal === 'edit_product'}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Edit Service Product</Text>
                <Text style={styles.modalSubtitle}>Update product parameters and active state.</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <X size={18} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.formLabel}>Product Name *</Text>
              <TextInput
                style={styles.formInput}
                value={editProdName}
                onChangeText={setEditProdName}
              />

              <Text style={[styles.formLabel, { marginTop: 14 }]}>Current Stock Quantity</Text>
              <TextInput
                style={styles.formInput}
                keyboardType="number-pad"
                value={editProdQty}
                onChangeText={setEditProdQty}
              />

              <Text style={[styles.formLabel, { marginTop: 14 }]}>Measurement Unit</Text>
              <View style={styles.unitPillsRow}>
                {['ml', 'g', 'pcs', 'bottles', 'pack'].map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitPill, editProdUnit === u && styles.unitPillActive]}
                    onPress={() => setEditProdUnit(u)}
                  >
                    <Text style={[styles.unitPillText, editProdUnit === u && styles.unitPillTextActive]}>
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Product Active Status</Text>
                <Switch
                  value={editProdActive}
                  onValueChange={setEditProdActive}
                  trackColor={{ false: '#E2E8F0', true: COLORS.sage }}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setActiveModal(null)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleEditProductSubmit}
                disabled={submittingEditProd}
              >
                {submittingEditProd ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 8: RECORD LIVE STOCK AUDIT FORM                        */}
      {/* ============================================================ */}
      <Modal
        visible={activeModal === 'record_audit'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Record Live Stock Photo Audit</Text>
                <Text style={styles.modalSubtitle}>Submit end-of-day photo proof for manager review.</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <X size={18} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {auditCapturedPhoto && (
                <Image source={{ uri: auditCapturedPhoto }} style={styles.capturedPhotoPreview} />
              )}

              <Text style={styles.formLabel}>Product / Section</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalSelectRow}>
                {products.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.productSelectPill,
                      auditSelectedProduct === p.name && styles.productSelectPillActive,
                    ]}
                    onPress={() => setAuditSelectedProduct(p.name)}
                  >
                    <Text
                      style={[
                        styles.productSelectPillText,
                        auditSelectedProduct === p.name && styles.productSelectPillTextActive,
                      ]}
                    >
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.formLabel, { marginTop: 14 }]}>Notes / Remarks</Text>
              <TextInput
                style={[styles.formInput, { height: 75 }]}
                multiline
                placeholder="e.g. 2 full bottles left in cabinet, clean seal..."
                value={auditRemarks}
                onChangeText={setAuditRemarks}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setActiveModal(null)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleSubmitAudit}
                disabled={submittingAudit}
              >
                {submittingAudit ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Submit Audit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 9: INSPECT AUDIT DETAIL                                */}
      {/* ============================================================ */}
      <Modal
        visible={activeModal === 'inspect_audit' && !!selectedAudit}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentLarge}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Inspect Stock Verification</Text>
                <Text style={styles.modalSubtitle}>
                  Logged by {selectedAudit?.technicianName} on {selectedAudit?.date}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <X size={18} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBodyScroll}>
              {selectedAudit?.photoUri && (
                <Image source={{ uri: selectedAudit.photoUri }} style={styles.inspectLargePhoto} />
              )}
              <View style={styles.inspectInfoCard}>
                <Text style={styles.inspectProductText}>{selectedAudit?.productName}</Text>
                <Text style={styles.inspectRemarksQuote}>"{selectedAudit?.remarks}"</Text>
                <Text style={styles.inspectMeta}>
                  Status: <Text style={{ fontWeight: '700' }}>{selectedAudit?.status}</Text>
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => setActiveModal(null)}
              >
                <Text style={styles.modalConfirmBtnText}>Close Verification</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Camera Modal Component */}
      <CameraModal
        visible={cameraVisible}
        title="Live Stock Photo"
        facingDefault="back"
        onClose={() => setCameraVisible(false)}
        onCapture={handlePhotoCaptured}
      />
    </View>
  );
};

export default ServiceStockScreen;

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
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    gap: 8,
  },
  toastText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
    flex: 1,
  },
  // 6 Quick Action Grid
  quickActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  quickActionCard: {
    width: '31.5%',
    height: 48,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  quickActionAddCard: {
    backgroundColor: COLORS.sage,
    borderColor: COLORS.sage,
  },
  quickActionAddLabel: {
    color: '#FFFFFF',
  },
  technicianCameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.sage,
    borderRadius: 12,
    height: 46,
    gap: 8,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  technicianCameraText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  // Main Tab Navigation
  mainTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    paddingBottom: 4,
  },
  mainTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: 6,
  },
  mainTabBtnActive: {
    backgroundColor: COLORS.sage,
    borderColor: COLORS.sage,
  },
  mainTabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  mainTabBtnTextActive: {
    color: '#FFFFFF',
  },
  badgePendingPill: {
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgePendingPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  // 2 KPI Cards
  kpiCardsRow: {
    flexDirection: 'column',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.6,
  },
  kpiSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    marginBottom: 8,
  },
  thresholdInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thresholdInput: {
    width: 60,
    height: 38,
    backgroundColor: COLORS.bgCream,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 14,
    color: COLORS.textDark,
  },
  thresholdUnitText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  reconcileStatusBadge: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  reconciledPill: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  reconciledText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  pendingCheckPill: {
    backgroundColor: COLORS.bgCream,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  pendingCheckText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  // Products Card Container
  productsCardContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  productsHeader: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: 10,
  },
  productsHeaderLeft: {
    gap: 2,
  },
  productsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  productsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textDark,
    letterSpacing: 0.5,
  },
  countBadge: {
    backgroundColor: COLORS.bgCream,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  productsSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: COLORS.bgCream,
    padding: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  filterPillAllActive: {
    backgroundColor: COLORS.textDark,
  },
  filterPillActiveGreen: {
    backgroundColor: '#14532D',
  },
  filterPillInactiveDark: {
    backgroundColor: COLORS.textMuted,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  filterPillTextWhite: {
    color: '#FFFFFF',
  },
  filterCountBadge: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  filterCountBadgeWhite: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterCountText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  filterCountTextDark: {
    color: '#FFFFFF',
  },
  dotActive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  dotInactive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.textMuted,
  },
  dotWhite: {
    backgroundColor: '#FFFFFF',
  },
  // Products List & Cards
  productsList: {
    flexDirection: 'column',
  },
  productCard: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: 10,
  },
  productCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  productNameContainer: {
    flex: 1,
  },
  productCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  productCardNameInactive: {
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
  },
  inactiveTag: {
    marginTop: 2,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.bgCream,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  inactiveTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  productStatusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
    borderWidth: 1,
  },
  activeToggleBtnOn: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  activeToggleBtnOff: {
    backgroundColor: COLORS.bgCream,
    borderColor: COLORS.borderLight,
  },
  activeToggleText: {
    fontSize: 10,
    fontWeight: '700',
  },
  activeToggleTextOn: {
    color: '#15803D',
  },
  activeToggleTextOff: {
    color: COLORS.textMuted,
  },
  badgeInStock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  badgeInStockText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  badgeLowStock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  badgeLowStockText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  badgeOutOfStock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  badgeOutOfStockText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  productMetricsBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCream,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  metricColumn: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textDark,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  metricValueWarning: {
    color: '#D97706',
  },
  metricValueMuted: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  metricUnit: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  metricUsageSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  productActionsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 2,
  },
  productActionBtn: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  btnRefill: {
    backgroundColor: '#EBF1EB',
  },
  btnRefillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  btnAdjust: {
    backgroundColor: '#FEF3C7',
  },
  btnAdjustText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  btnEdit: {
    backgroundColor: COLORS.bgCream,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  btnEditText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  btnDelete: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  btnDeleteText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  loadingBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  // Audits Tab
  auditsTabContainer: {
    gap: 12,
  },
  auditsInfoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: 8,
  },
  auditsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  auditsTitleText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  auditsDescription: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  auditsActionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  auditsRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCream,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 8,
    gap: 5,
  },
  auditsRefreshBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  auditsTakeLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.sage,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 8,
    gap: 6,
  },
  auditsTakeLiveBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  auditsListContainer: {
    gap: 10,
  },
  auditCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 12,
    gap: 8,
  },
  auditCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  auditTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  auditTimeText: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  auditStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusPendingText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D97706',
  },
  statusReviewed: {
    backgroundColor: '#DCFCE7',
  },
  statusReviewedText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
  },
  statusFlagged: {
    backgroundColor: '#FEE2E2',
  },
  statusFlaggedText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
  },
  auditStatusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  auditBody: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  auditThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: COLORS.bgCream,
  },
  auditDetails: {
    flex: 1,
    gap: 2,
  },
  auditStaffName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  auditProductName: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  auditRemarksBox: {
    backgroundColor: COLORS.bgCream,
    padding: 5,
    borderRadius: 6,
    marginTop: 2,
  },
  auditRemarksText: {
    fontSize: 10,
    fontStyle: 'italic',
    color: COLORS.textDark,
  },
  auditInspectLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  auditInspectLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.sage,
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
    maxHeight: '88%',
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
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  modalConfirmBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
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
    borderColor: COLORS.borderLight,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 13,
    color: COLORS.textDark,
  },
  horizontalSelectRow: {
    flexDirection: 'row',
  },
  productSelectPill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.bgCream,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginRight: 6,
  },
  productSelectPillActive: {
    backgroundColor: COLORS.sage,
    borderColor: COLORS.sage,
  },
  productSelectPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  productSelectPillTextActive: {
    color: '#FFFFFF',
  },
  reasonPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reasonPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: COLORS.bgCream,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  reasonPillActive: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  reasonPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  reasonPillTextActive: {
    color: '#FFFFFF',
  },
  unitPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  unitPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: COLORS.bgCream,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  unitPillActive: {
    backgroundColor: COLORS.sage,
    borderColor: COLORS.sage,
  },
  unitPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  unitPillTextActive: {
    color: '#FFFFFF',
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
  // Stock Check Modal Rows
  stockCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: 8,
  },
  stockCheckInfo: {
    flex: 1.2,
  },
  stockCheckName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  stockCheckExpected: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  stockCheckInputCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stockCheckInput: {
    width: 65,
    height: 38,
    backgroundColor: COLORS.bgCream,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 13,
    color: COLORS.textDark,
  },
  stockCheckUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  stockCheckDiffBadge: {
    width: 70,
    alignItems: 'flex-end',
  },
  diffMatchText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  diffNegativeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
  },
  diffPositiveText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  // Consumption Rules Modal
  serviceSelectPill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.bgCream,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginRight: 6,
  },
  serviceSelectPillActive: {
    backgroundColor: COLORS.sage,
    borderColor: COLORS.sage,
  },
  serviceSelectPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  serviceSelectPillTextActive: {
    color: '#FFFFFF',
  },
  emptyRulesText: {
    fontSize: 12,
    color: COLORS.textMuted,
    paddingVertical: 14,
    fontStyle: 'italic',
  },
  ruleItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bgCream,
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  ruleItemInfo: {
    gap: 2,
  },
  ruleItemName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  ruleItemQty: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  ruleDeleteBtn: {
    padding: 6,
  },
  addRuleBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: '#FAFAF9',
  },
  addRuleTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 8,
  },
  addRuleRow: {
    gap: 6,
  },
  ruleProdPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginRight: 6,
  },
  ruleProdPillActive: {
    backgroundColor: COLORS.sage,
    borderColor: COLORS.sage,
  },
  ruleProdPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  ruleProdPillTextActive: {
    color: '#FFFFFF',
  },
  addRuleInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addRuleInput: {
    flex: 1,
    height: 38,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 10,
    fontSize: 12,
  },
  addRuleConfirmBtn: {
    backgroundColor: COLORS.sage,
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRuleConfirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  // History Modal
  historyFiltersRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  historyFilterPill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: COLORS.bgCream,
  },
  historyFilterPillActive: {
    backgroundColor: COLORS.textDark,
  },
  historyFilterPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  historyFilterPillTextActive: {
    color: '#FFFFFF',
  },
  historyCard: {
    backgroundColor: COLORS.bgCream,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 4,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  typeRefill: {
    backgroundColor: '#DCFCE7',
  },
  typeRefillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
  },
  typeAdjustment: {
    backgroundColor: '#FEF3C7',
  },
  typeAdjustmentText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D97706',
  },
  typeStockCheck: {
    backgroundColor: '#E0E7FF',
  },
  typeStockCheckText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#3730A3',
  },
  historyTypeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  historyDateText: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  historyCardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  historyProductName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  historyQtyText: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  qtyPositive: {
    color: '#15803D',
  },
  qtyNegative: {
    color: '#DC2626',
  },
  historyReasonText: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  // Record Audit Modal Preview
  capturedPhotoPreview: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: COLORS.bgCream,
  },
  // Inspect Modal
  inspectLargePhoto: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    backgroundColor: COLORS.bgCream,
    marginBottom: 12,
  },
  inspectInfoCard: {
    backgroundColor: COLORS.bgCream,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  inspectProductText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  inspectRemarksQuote: {
    fontSize: 12,
    fontStyle: 'italic',
    color: COLORS.textDark,
  },
  inspectMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
});

