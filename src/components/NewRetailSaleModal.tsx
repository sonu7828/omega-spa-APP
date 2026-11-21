import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  ShoppingBag,
  Coffee,
  Sparkles,
  X,
  Plus,
  Check,
  Search,
  Layers,
  Trash2,
  User,
} from 'lucide-react-native';
import THEME from '../constants/theme';
import { formatFCFA } from '../utils/currency';
import { useStock } from '../context/StockContext';
import { useClients } from '../context/ClientsContext';
import { useInvoices } from '../context/InvoiceContext';

interface NewRetailSaleModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (invoice: any) => void;
}

export const NewRetailSaleModal: React.FC<NewRetailSaleModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { retailProducts, refreshStock } = useStock();
  const { clients } = useClients();
  const { createRetailSaleInvoice } = useInvoices();

  const [clientId, setClientId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'drinks' | 'cosmetics'>('drinks');
  const [quantities, setQuantities] = useState<{ [id: string]: number }>({});
  const [cart, setCart] = useState<
    Array<{
      productId: string;
      name: string;
      service: string;
      unitPrice: number;
      price: number;
      qty: number;
      type: string;
      stock: number;
    }>
  >([]);

  // Payment mode
  const [isSplit, setIsSplit] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MTN_MOMO' | 'ORANGE_MONEY'>('CASH');
  const [splitCash, setSplitCash] = useState('');
  const [splitMomo, setSplitMomo] = useState('');
  const [splitOrange, setSplitOrange] = useState('');

  // UI state
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClientPickerOpen, setIsClientPickerOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  // Filter drinks and cosmetics
  const drinks = useMemo(() => {
    return (retailProducts || []).filter(
      (p) => String(p.category).toUpperCase() === 'DRINKS' && p.isActive !== false
    );
  }, [retailProducts]);

  const cosmetics = useMemo(() => {
    return (retailProducts || []).filter(
      (p) => String(p.category).toUpperCase() === 'COSMETICS' && p.isActive !== false
    );
  }, [retailProducts]);

  const activeProducts = activeTab === 'drinks' ? drinks : cosmetics;

  // Selected client
  const selectedClient = useMemo(() => {
    if (!clientId) return null;
    return (clients || []).find((c) => String(c.id) === String(clientId));
  }, [clientId, clients]);

  // Total
  const total = useMemo(() => {
    return cart.reduce((sum, it) => sum + (it.price || 0), 0);
  }, [cart]);

  // Split calculation
  const cashNum = parseInt(splitCash.replace(/[^0-9]/g, ''), 10) || 0;
  const momoNum = parseInt(splitMomo.replace(/[^0-9]/g, ''), 10) || 0;
  const orangeNum = parseInt(splitOrange.replace(/[^0-9]/g, ''), 10) || 0;
  const splitTotal = cashNum + momoNum + orangeNum;
  const splitRemaining = total - splitTotal;
  const isSplitValid = !isSplit || (splitTotal === total && total > 0);

  const showTempNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3000);
  };

  const handleAddToCart = (product: any, qtyToAdd: number = 1) => {
    const qty = Math.max(1, qtyToAdd);
    const existing = cart.find((it) => it.productId === product.id);
    const currentInCart = existing ? existing.qty : 0;
    const stock = Number(product.quantity ?? product.stock ?? 99);
    const remainingStock = stock - currentInCart;

    if (qty > remainingStock) {
      showTempNotice(`Only ${remainingStock} more available in stock.`);
      return;
    }

    if (existing) {
      setCart((prev) =>
        prev.map((it) =>
          it.productId === product.id
            ? {
                ...it,
                qty: it.qty + qty,
                price: it.unitPrice * (it.qty + qty),
              }
            : it
        )
      );
    } else {
      setCart((prev) => [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          service: product.name,
          unitPrice: product.price,
          price: product.price * qty,
          qty,
          type: activeTab === 'drinks' ? 'drink' : 'cosmetic',
          stock,
        },
      ]);
    }

    showTempNotice(`Added ${qty}x "${product.name}" to cart`);
    setQuantities((prev) => ({ ...prev, [product.id]: 1 }));
  };

  const handleUpdateCartQty = (productId: string, newQty: number) => {
    const item = cart.find((it) => it.productId === productId);
    if (!item) return;
    const clamped = Math.max(1, Math.min(item.stock, newQty));
    setCart((prev) =>
      prev.map((it) =>
        it.productId === productId
          ? { ...it, qty: clamped, price: item.unitPrice * clamped }
          : it
      )
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((it) => it.productId !== productId));
  };

  const handleQuick5050 = () => {
    const half1 = Math.round(total / 2);
    const half2 = total - half1;
    setIsSplit(true);
    setSplitCash(String(half1));
    setSplitMomo(String(half2));
    setSplitOrange('');
  };

  const handleClearSplit = () => {
    setSplitCash('');
    setSplitMomo('');
    setSplitOrange('');
  };

  const handleCollect = async () => {
    if (cart.length === 0 || total <= 0) {
      Alert.alert('Empty Cart', 'Please add at least one product.');
      return;
    }

    if (isSplit && !isSplitValid) {
      showTempNotice('Split amounts must exactly match the total sale amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      const splits: any[] = [];
      if (isSplit) {
        if (cashNum > 0) splits.push({ amount: cashNum, method: 'CASH', paymentMethod: 'CASH' });
        if (momoNum > 0) splits.push({ amount: momoNum, method: 'MTN_MOMO', paymentMethod: 'MTN_MOMO' });
        if (orangeNum > 0) splits.push({ amount: orangeNum, method: 'ORANGE_MONEY', paymentMethod: 'ORANGE_MONEY' });
      }

      const effectivePaymentMethod = isSplit
        ? splits.map((s) => `${s.paymentMethod.replace(/_/g, ' ')} (${s.amount.toLocaleString('en-US')})`).join(' + ')
        : paymentMethod;

      const invoice = await createRetailSaleInvoice({
        client: selectedClient,
        clientId: selectedClient?.id || null,
        clientName: selectedClient?.name || 'Walk in',
        items: cart,
        paymentMethod: effectivePaymentMethod,
        splits: isSplit ? splits : [],
      });

      if (refreshStock) refreshStock();
      onSuccess(invoice);
    } catch (err: any) {
      Alert.alert('Sale Error', err?.message || 'Could not complete retail sale.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients || [];
    const q = clientSearch.toLowerCase().trim();
    return (clients || []).filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q))
    );
  }, [clients, clientSearch]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconWrap}>
                <ShoppingBag size={18} color="#4F6748" />
              </View>
              <Text style={styles.headerTitle}>New Retail Sale</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={18} color="#737373" />
            </TouchableOpacity>
          </View>

          {/* Temporary notice banner */}
          {notice ? (
            <View style={styles.noticeBanner}>
              <Check size={14} color="#4F6748" />
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}

          {/* Scrollable Body */}
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* 1. Client (Optional) */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>CLIENT (OPTIONAL)</Text>
                {selectedClient && (
                  <TouchableOpacity onPress={() => setClientId('')}>
                    <Text style={styles.resetLink}>Reset to Walk-in</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                onPress={() => setIsClientPickerOpen(true)}
                style={styles.clientPickerTrigger}
                activeOpacity={0.8}
              >
                <View style={styles.clientPickerLeft}>
                  <User size={16} color="#737373" />
                  <View>
                    <Text style={styles.clientPickerName}>
                      {selectedClient ? selectedClient.name : 'Walk in (No client profile)'}
                    </Text>
                    <Text style={styles.clientPickerSub}>
                      {selectedClient
                        ? `${selectedClient.phone || 'No phone'} · ${selectedClient.loyaltyBalance || 0} loyalty pts`
                        : 'Tap to assign a registered client'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.changeText}>Change</Text>
              </TouchableOpacity>
            </View>

            {/* 2. Product Picker Tabs */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>SELECT PRODUCTS</Text>
              <View style={styles.productTabsRow}>
                <TouchableOpacity
                  onPress={() => setActiveTab('drinks')}
                  style={[styles.productTab, activeTab === 'drinks' && styles.productTabActive]}
                  activeOpacity={0.8}
                >
                  <Coffee size={14} color={activeTab === 'drinks' ? '#2D2D2A' : '#737373'} />
                  <Text
                    style={[
                      styles.productTabText,
                      activeTab === 'drinks' && styles.productTabTextActive,
                    ]}
                  >
                    Drinks ({drinks.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveTab('cosmetics')}
                  style={[styles.productTab, activeTab === 'cosmetics' && styles.productTabActive]}
                  activeOpacity={0.8}
                >
                  <Sparkles size={14} color={activeTab === 'cosmetics' ? '#2D2D2A' : '#737373'} />
                  <Text
                    style={[
                      styles.productTabText,
                      activeTab === 'cosmetics' && styles.productTabTextActive,
                    ]}
                  >
                    Cosmetics ({cosmetics.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Products List */}
              <View style={styles.productsList}>
                {activeProducts.length === 0 ? (
                  <Text style={styles.emptyProductsText}>
                    No products available in this category.
                  </Text>
                ) : (
                  activeProducts.map((product) => {
                    const inCart = cart.find((it) => it.productId === product.id);
                    const cartQty = inCart ? inCart.qty : 0;
                    const stock = Number(product.quantity ?? 99);
                    const remainingStock = stock - cartQty;
                    const isOutOfStock = remainingStock <= 0;
                    const qty = quantities[product.id] || 1;

                    return (
                      <View key={product.id} style={styles.productCard}>
                        <View style={styles.productInfoCol}>
                          <Text style={styles.productName}>{product.name}</Text>
                          <View style={styles.productMetaRow}>
                            <Text style={styles.productPrice}>{formatFCFA(product.price)}</Text>
                            <Text style={styles.dotSeparator}>·</Text>
                            <Text
                              style={[
                                styles.stockText,
                                isOutOfStock && styles.stockOutOfStock,
                              ]}
                            >
                              {isOutOfStock ? 'Out of stock' : `${remainingStock} available`}
                            </Text>
                          </View>
                        </View>

                        {/* Stepper & Add */}
                        <View style={styles.stepperAndAddRow}>
                          <View style={styles.stepperBox}>
                            <TouchableOpacity
                              disabled={isOutOfStock || qty <= 1}
                              onPress={() =>
                                setQuantities((prev) => ({
                                  ...prev,
                                  [product.id]: Math.max(1, (prev[product.id] || 1) - 1),
                                }))
                              }
                              style={styles.stepBtn}
                            >
                              <Text style={styles.stepBtnText}>-</Text>
                            </TouchableOpacity>
                            <Text style={styles.stepQtyText}>{qty}</Text>
                            <TouchableOpacity
                              disabled={isOutOfStock || qty >= remainingStock}
                              onPress={() =>
                                setQuantities((prev) => ({
                                  ...prev,
                                  [product.id]: Math.min(
                                    remainingStock,
                                    (prev[product.id] || 1) + 1
                                  ),
                                }))
                              }
                              style={styles.stepBtn}
                            >
                              <Text style={styles.stepBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>

                          <TouchableOpacity
                            disabled={isOutOfStock}
                            onPress={() => handleAddToCart(product, qty)}
                            style={[
                              styles.addBtn,
                              isOutOfStock && styles.addBtnDisabled,
                            ]}
                            activeOpacity={0.7}
                          >
                            <Plus size={13} color={isOutOfStock ? '#9CA3AF' : '#4F6748'} strokeWidth={2.5} />
                            <Text
                              style={[
                                styles.addBtnText,
                                isOutOfStock && styles.addBtnTextDisabled,
                              ]}
                            >
                              Add
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>

            {/* 3. Selected Items (Cart Review) */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                SELECTED ITEMS ({cart.reduce((s, it) => s + it.qty, 0)})
              </Text>
              {cart.length === 0 ? (
                <View style={styles.emptyCartBox}>
                  <Text style={styles.emptyCartText}>
                    No products added yet. Select drinks or cosmetics above.
                  </Text>
                </View>
              ) : (
                <View style={styles.cartContainer}>
                  {cart.map((item) => (
                    <View key={item.productId} style={styles.cartItemRow}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.cartItemHeader}>
                          <Text style={styles.cartItemName}>{item.name}</Text>
                          <Text style={styles.cartItemBadge}>{item.type}</Text>
                        </View>
                        <Text style={styles.cartItemUnitPrice}>
                          {formatFCFA(item.unitPrice)} each
                        </Text>
                      </View>

                      {/* Controls */}
                      <View style={styles.cartControls}>
                        <View style={styles.stepperBoxSmall}>
                          <TouchableOpacity
                            disabled={item.qty <= 1}
                            onPress={() => handleUpdateCartQty(item.productId, item.qty - 1)}
                            style={styles.stepBtnSmall}
                          >
                            <Text style={styles.stepBtnTextSmall}>-</Text>
                          </TouchableOpacity>
                          <Text style={styles.stepQtyTextSmall}>{item.qty}</Text>
                          <TouchableOpacity
                            disabled={item.qty >= item.stock}
                            onPress={() => handleUpdateCartQty(item.productId, item.qty + 1)}
                            style={styles.stepBtnSmall}
                          >
                            <Text style={styles.stepBtnTextSmall}>+</Text>
                          </TouchableOpacity>
                        </View>

                        <Text style={styles.cartItemTotal}>{formatFCFA(item.price)}</Text>

                        <TouchableOpacity
                          onPress={() => handleRemoveFromCart(item.productId)}
                          style={styles.cartRemoveBtn}
                        >
                          <Trash2 size={14} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}

                  <View style={styles.cartSummaryRow}>
                    <Text style={styles.cartSummaryLabel}>Total Products</Text>
                    <Text style={styles.cartSummaryValue}>{formatFCFA(total)}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* 4. Payment Mode & Methods */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>PAYMENT MODE</Text>
                {isSplit && (
                  <View style={styles.splitActiveBadge}>
                    <Layers size={11} color="#8B6E58" />
                    <Text style={styles.splitActiveBadgeText}>Split Active</Text>
                  </View>
                )}
              </View>

              <View style={styles.modeToggleRow}>
                <TouchableOpacity
                  onPress={() => setIsSplit(false)}
                  style={[styles.modeToggleBtn, !isSplit && styles.modeToggleBtnActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modeToggleText, !isSplit && styles.modeToggleTextActive]}>
                    Single Payment
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setIsSplit(true);
                    if (splitTotal === 0 && total > 0) handleQuick5050();
                  }}
                  style={[styles.modeToggleBtn, isSplit && styles.modeToggleBtnActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modeToggleText, isSplit && styles.modeToggleTextActive]}>
                    Split Payment
                  </Text>
                </TouchableOpacity>
              </View>

              {!isSplit ? (
                /* Single Payment Method */
                <View style={styles.methodsRow}>
                  {(['CASH', 'MTN_MOMO', 'ORANGE_MONEY'] as const).map((method) => {
                    const isSelected = paymentMethod === method;
                    const label = method === 'CASH' ? 'CASH' : method === 'MTN_MOMO' ? 'MTN MOMO' : 'ORANGE MONEY';
                    return (
                      <TouchableOpacity
                        key={method}
                        onPress={() => setPaymentMethod(method)}
                        style={[styles.methodBtn, isSelected && styles.methodBtnActive]}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.methodBtnText, isSelected && styles.methodBtnTextActive]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                /* Split Payment Fields */
                <View style={styles.splitBox}>
                  <View style={styles.splitQuickRow}>
                    <TouchableOpacity onPress={handleQuick5050} style={styles.quickSplitBtn}>
                      <Text style={styles.quickSplitBtnText}>50 / 50 Cash + MoMo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleClearSplit} style={styles.quickSplitClearBtn}>
                      <Text style={styles.quickSplitClearText}>Clear</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.splitInputRow}>
                    <Text style={styles.splitInputLabel}>Cash (FCFA):</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={splitCash}
                      onChangeText={setSplitCash}
                      placeholder="0"
                      style={styles.splitInput}
                    />
                  </View>

                  <View style={styles.splitInputRow}>
                    <Text style={styles.splitInputLabel}>MTN MoMo (FCFA):</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={splitMomo}
                      onChangeText={setSplitMomo}
                      placeholder="0"
                      style={styles.splitInput}
                    />
                  </View>

                  <View style={styles.splitInputRow}>
                    <Text style={styles.splitInputLabel}>Orange Money (FCFA):</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={splitOrange}
                      onChangeText={setSplitOrange}
                      placeholder="0"
                      style={styles.splitInput}
                    />
                  </View>

                  <View
                    style={[
                      styles.splitStatusBanner,
                      isSplitValid ? styles.splitStatusValid : styles.splitStatusInvalid,
                    ]}
                  >
                    <Text
                      style={[
                        styles.splitStatusText,
                        isSplitValid ? styles.splitStatusTextValid : styles.splitStatusTextInvalid,
                      ]}
                    >
                      {isSplitValid
                        ? '✓ Exact Match: Split amounts match total sale'
                        : splitRemaining > 0
                        ? `Remaining: ${formatFCFA(splitRemaining)}`
                        : `Over by: ${formatFCFA(Math.abs(splitRemaining))}`}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer Bar */}
          <View style={styles.footer}>
            <View style={styles.footerTotalCol}>
              <Text style={styles.footerTotalLabel}>TOTAL TO COLLECT</Text>
              <Text style={styles.footerTotalValue}>{formatFCFA(total)}</Text>
            </View>

            <View style={styles.footerActions}>
              <TouchableOpacity
                onPress={onClose}
                disabled={isSubmitting}
                style={styles.cancelBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCollect}
                disabled={isSubmitting || cart.length === 0 || (isSplit && !isSplitValid)}
                style={[
                  styles.collectBtn,
                  (isSubmitting || cart.length === 0 || (isSplit && !isSplitValid)) && { opacity: 0.6 },
                ]}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Check size={16} color="#FFFFFF" />
                )}
                <Text style={styles.collectBtnText}>
                  {isSubmitting
                    ? 'Recording...'
                    : isSplit && !isSplitValid
                    ? splitRemaining > 0
                      ? `Allocate ${formatFCFA(splitRemaining)} Remaining`
                      : `Over by ${formatFCFA(Math.abs(splitRemaining))}`
                    : `Collect Payment (${formatFCFA(total)})`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Client Picker Modal */}
      <Modal visible={isClientPickerOpen} transparent animationType="slide">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Registered Client</Text>
              <TouchableOpacity onPress={() => setIsClientPickerOpen(false)}>
                <X size={18} color="#2D2D2A" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
              <Search size={16} color="#737373" />
              <TextInput
                value={clientSearch}
                onChangeText={setClientSearch}
                placeholder="Search by client name or phone..."
                style={styles.searchInput}
              />
            </View>

            <ScrollView style={{ maxHeight: 350 }}>
              <TouchableOpacity
                onPress={() => {
                  setClientId('');
                  setIsClientPickerOpen(false);
                }}
                style={[styles.clientItem, !clientId && styles.clientItemActive]}
              >
                <View>
                  <Text style={styles.clientItemName}>Walk in (No client profile)</Text>
                  <Text style={styles.clientItemSub}>Direct walk-in customer</Text>
                </View>
                {!clientId && <Check size={16} color="#4F6748" />}
              </TouchableOpacity>

              {filteredClients.map((c) => {
                const isSelected = String(c.id) === String(clientId);
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => {
                      setClientId(String(c.id));
                      setIsClientPickerOpen(false);
                    }}
                    style={[styles.clientItem, isSelected && styles.clientItemActive]}
                  >
                    <View>
                      <Text style={styles.clientItemName}>{c.name}</Text>
                      <Text style={styles.clientItemSub}>
                        {c.phone || 'No phone'} · {c.loyaltyBalance || 0} pts
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
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(45, 45, 42, 0.65)',
    justifyContent: 'center',
    padding: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    maxHeight: '92%',
    overflow: 'hidden',
    ...THEME.shadows.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE6',
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EBF3EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F5EFEB',
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EBF3EA',
    borderBottomWidth: 1,
    borderBottomColor: '#C8DEC4',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  noticeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D4027',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    gap: 16,
  },
  section: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#737373',
    letterSpacing: 0.5,
  },
  resetLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F6748',
    textDecorationLine: 'underline',
  },
  clientPickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 12,
  },
  clientPickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  clientPickerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  clientPickerSub: {
    fontSize: 11,
    color: '#737373',
    marginTop: 2,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F6748',
  },
  productTabsRow: {
    flexDirection: 'row',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D9',
    paddingBottom: 6,
  },
  productTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F5EFEB',
  },
  productTabActive: {
    backgroundColor: '#2D2D2A',
  },
  productTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#737373',
  },
  productTabTextActive: {
    color: '#FFFFFF',
  },
  productsList: {
    gap: 8,
    maxHeight: 200,
  },
  emptyProductsText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    paddingVertical: 12,
    textAlign: 'center',
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
  },
  productInfoCol: {
    flex: 1,
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  productPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F6748',
  },
  dotSeparator: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  stockText: {
    fontSize: 11,
    color: '#737373',
  },
  stockOutOfStock: {
    color: '#DC2626',
    fontWeight: '700',
  },
  stepperAndAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    backgroundColor: '#FAF7F2',
  },
  stepBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  stepQtyText: {
    width: 28,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EBF3EA',
    borderWidth: 1,
    borderColor: '#C8DEC4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F6748',
  },
  addBtnTextDisabled: {
    color: '#9CA3AF',
  },
  emptyCartBox: {
    padding: 16,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyCartText: {
    fontSize: 12,
    color: '#737373',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  cartContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE6',
    gap: 8,
  },
  cartItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cartItemName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  cartItemBadge: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: '#737373',
    backgroundColor: '#F5EFEB',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cartItemUnitPrice: {
    fontSize: 11,
    color: '#737373',
    marginTop: 2,
  },
  cartControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBoxSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 6,
    backgroundColor: '#FAF7F2',
  },
  stepBtnSmall: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnTextSmall: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  stepQtyTextSmall: {
    width: 22,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  cartItemTotal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2D2D2A',
    minWidth: 65,
    textAlign: 'right',
  },
  cartRemoveBtn: {
    padding: 4,
  },
  cartSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FAF7F2',
  },
  cartSummaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  cartSummaryValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4F6748',
  },
  modeToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#FAF7F2',
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeToggleBtnActive: {
    backgroundColor: '#2D2D2A',
  },
  modeToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#737373',
  },
  modeToggleTextActive: {
    color: '#FFFFFF',
  },
  splitActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5EFEB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  splitActiveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8B6E58',
  },
  methodsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  methodBtnActive: {
    backgroundColor: '#4F6748',
    borderColor: '#4F6748',
  },
  methodBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  methodBtnTextActive: {
    color: '#FFFFFF',
  },
  splitBox: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginTop: 4,
  },
  splitQuickRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  quickSplitBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#EBF3EA',
    borderRadius: 6,
  },
  quickSplitBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F6748',
  },
  quickSplitClearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#F5EFEB',
    borderRadius: 6,
  },
  quickSplitClearText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#737373',
  },
  splitInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  splitInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
    width: 120,
  },
  splitInput: {
    flex: 1,
    height: 36,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
    textAlign: 'right',
  },
  splitStatusBanner: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  splitStatusValid: {
    backgroundColor: '#EBF3EA',
  },
  splitStatusInvalid: {
    backgroundColor: '#FEE2E2',
  },
  splitStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  splitStatusTextValid: {
    color: '#16A34A',
  },
  splitStatusTextInvalid: {
    color: '#DC2626',
  },
  footer: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0ECE6',
    backgroundColor: '#FAF7F2',
    gap: 12,
  },
  footerTotalCol: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerTotalLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#737373',
    letterSpacing: 0.5,
  },
  footerTotalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2D2D2A',
  },
  footerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#737373',
  },
  collectBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#4F6748',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  collectBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(45, 45, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  pickerCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '80%',
    gap: 12,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE6',
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#2D2D2A',
  },
  clientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5EFEB',
  },
  clientItemActive: {
    backgroundColor: '#EBF3EA',
    borderRadius: 8,
  },
  clientItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  clientItemSub: {
    fontSize: 11,
    color: '#737373',
    marginTop: 2,
  },
});

export default NewRetailSaleModal;

