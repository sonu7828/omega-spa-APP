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
  Sparkles,
  Users,
  X,
  Plus,
  Trash2,
  ChevronDown,
  ShoppingBag,
  Coffee,
  Check,
  Search,
  Layers,
  AlertCircle,
  User,
} from 'lucide-react-native';
import THEME from '../constants/theme';
import { formatFCFA } from '../utils/currency';
import { useAuth, isMarketerUser } from '../context/AuthContext';
import { useServices } from '../context/ServicesContext';
import { useClients } from '../context/ClientsContext';
import { useStock } from '../context/StockContext';
import { useInvoices } from '../context/InvoiceContext';

interface NewWalkInServiceModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (invoice: any, isPaid: boolean) => void;
  initialSharedMode?: boolean;
}

export const NewWalkInServiceModal: React.FC<NewWalkInServiceModalProps> = ({
  visible,
  onClose,
  onSuccess,
  initialSharedMode = false,
}) => {
  const { user, allUsers } = useAuth();
  const { services } = useServices();
  const { clients } = useClients();
  const { retailProducts, refreshStock } = useStock();
  const { createWalkInServiceInvoice } = useInvoices();

  const userRole = (user?.role || '').toLowerCase();
  const isTechnician = userRole === 'technician';
  const isMarketer = userRole === 'marketer' || isMarketerUser(user);

  // Technicians list
  const technicians = useMemo(() => {
    const list = (allUsers || []).filter((u: any) => u.role === 'technician' && u.active !== false);
    if (list.length > 0) return list;
    return [
      { id: 'tech-1', name: 'Samira Djouwa', role: 'technician', specialties: ['Nail Tech'], active: true },
      { id: 'tech-2', name: 'Fortune Fotso', role: 'technician', specialties: ['Body Massage'], active: true },
      { id: 'tech-3', name: 'Justice B', role: 'technician', specialties: ['BARBER'], active: true },
      { id: 'tech-4', name: 'Celia Whapi', role: 'technician', specialties: ['Facial'], active: true },
    ];
  }, [allUsers]);

  // Referral / Introducer staff list
  const referralStaff = useMemo(() => {
    return (allUsers || []).filter((u: any) => u.active !== false);
  }, [allUsers]);

  // Active catalog services
  const activeServices = useMemo(() => {
    return (services || []).filter((s: any) => s.active !== false);
  }, [services]);

  // Retail products split by Drinks & Cosmetics
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

  // Form State
  const [clientType, setClientType] = useState<'walkin' | 'registered'>('walkin');
  const [clientId, setClientId] = useState<string>('');
  const [walkInName, setWalkInName] = useState<string>('');
  const [walkInPhone, setWalkInPhone] = useState<string>('+237 ');
  const [introducedById, setIntroducedById] = useState<string>('');

  const [serviceLines, setServiceLines] = useState<
    Array<{
      id: number;
      serviceId: string;
      serviceName: string;
      technicianId: string;
      technicianName: string;
      price: string | number;
      product: string;
    }>
  >([]);

  // Retail optional in service invoice
  const [showRetailSection, setShowRetailSection] = useState(false);
  const [retailTab, setRetailTab] = useState<'drinks' | 'cosmetics'>('drinks');
  const [retailCart, setRetailCart] = useState<
    Array<{
      productId: string;
      name: string;
      price: number;
      qty: number;
      type: string;
    }>
  >([]);

  const [notes, setNotes] = useState('');
  const [actionChoice, setActionChoice] = useState<'pending' | 'collect_now'>('pending');

  // Payment State if Collect Now
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MTN_MOMO' | 'ORANGE_MONEY'>('CASH');
  const [isSplit, setIsSplit] = useState(false);
  const [splitCash, setSplitCash] = useState('');
  const [splitMomo, setSplitMomo] = useState('');
  const [splitOrange, setSplitOrange] = useState('');

  // UI pickers & error
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pickers
  const [isServicePickerOpen, setIsServicePickerOpen] = useState(false);
  const [servicePickerLineIdx, setServicePickerLineIdx] = useState<number>(0);
  const [serviceCategory, setServiceCategory] = useState<string>('ALL');
  const [serviceSearch, setServiceSearch] = useState('');

  const [isTechPickerOpen, setIsTechPickerOpen] = useState(false);
  const [techPickerLineIdx, setTechPickerLineIdx] = useState<number>(0);

  const [isClientPickerOpen, setIsClientPickerOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  const [isReferralPickerOpen, setIsReferralPickerOpen] = useState(false);

  // Initialize service lines on modal open
  React.useEffect(() => {
    if (visible) {
      setClientType('walkin');
      setClientId('');
      setWalkInName('');
      setWalkInPhone('+237 ');
      setIntroducedById(isMarketer ? String(user?.id) : '');
      setActionChoice('pending');

      const defaultTechId = isTechnician
        ? String(user?.id)
        : technicians[0]?.id
        ? String(technicians[0].id)
        : '';
      const defaultTechName = isTechnician
        ? user?.name || ''
        : technicians[0]?.name || '';

      const otherTech = technicians.find(
        (t) => String(t.id) !== defaultTechId && t.name !== defaultTechName
      ) || technicians[1] || technicians[0];

      if (initialSharedMode) {
        setServiceLines([
          {
            id: Date.now(),
            serviceId: '',
            serviceName: '',
            technicianId: defaultTechId,
            technicianName: defaultTechName,
            price: '',
            product: '',
          },
          {
            id: Date.now() + 1,
            serviceId: '',
            serviceName: '',
            technicianId: otherTech?.id ? String(otherTech.id) : defaultTechId,
            technicianName: otherTech?.name || defaultTechName,
            price: '',
            product: '',
          },
        ]);
      } else {
        setServiceLines([
          {
            id: Date.now(),
            serviceId: '',
            serviceName: '',
            technicianId: defaultTechId,
            technicianName: defaultTechName,
            price: '',
            product: '',
          },
        ]);
      }

      setRetailCart([]);
      setShowRetailSection(false);
      setRetailTab('drinks');
      setNotes('');
      setActionChoice('pending');
      setPaymentMethod('CASH');
      setIsSplit(false);
      setSplitCash('');
      setSplitMomo('');
      setSplitOrange('');
      setErrorMessage('');
    }
  }, [visible]);

  // Selected client
  const selectedClient = useMemo(() => {
    if (!clientId) return null;
    return (clients || []).find((c) => String(c.id) === String(clientId));
  }, [clientId, clients]);

  // Selected referral staff
  const selectedReferral = useMemo(() => {
    if (!introducedById) return null;
    return (referralStaff || []).find((s) => String(s.id) === String(introducedById));
  }, [introducedById, referralStaff]);

  // Totals
  const servicesTotal = useMemo(() => {
    return serviceLines.reduce((sum, l) => {
      const p = typeof l.price === 'number' ? l.price : parseInt(String(l.price).replace(/[^0-9]/g, ''), 10) || 0;
      return sum + p;
    }, 0);
  }, [serviceLines]);

  const retailTotal = useMemo(() => {
    return retailCart.reduce((sum, it) => sum + (it.price || 0), 0);
  }, [retailCart]);

  const grandTotal = servicesTotal + retailTotal;

  // Split calculation
  const cashNum = parseInt(splitCash.replace(/[^0-9]/g, ''), 10) || 0;
  const momoNum = parseInt(splitMomo.replace(/[^0-9]/g, ''), 10) || 0;
  const orangeNum = parseInt(splitOrange.replace(/[^0-9]/g, ''), 10) || 0;
  const splitTotal = cashNum + momoNum + orangeNum;
  const splitRemaining = grandTotal - splitTotal;
  const isSplitValid = !isSplit || (splitTotal === grandTotal && grandTotal > 0);

  // Line actions
  const addServiceLine = () => {
    const assignedTechIds = new Set(serviceLines.map((l) => String(l.technicianId)).filter(Boolean));
    const nextTech = technicians.find((t) => !assignedTechIds.has(String(t.id))) || technicians[0];

    setServiceLines((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        serviceId: '',
        serviceName: '',
        technicianId: nextTech ? String(nextTech.id) : '',
        technicianName: nextTech ? nextTech.name : '',
        price: '',
        product: '',
      },
    ]);
  };

  const removeServiceLine = (idx: number) => {
    if (serviceLines.length <= 1) return;
    setServiceLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateServiceLineField = (idx: number, field: string, value: any) => {
    setServiceLines((prev) =>
      prev.map((line, i) => (i === idx ? { ...line, [field]: value } : line))
    );
  };

  // Retail Cart in Service Modal
  const addRetailItem = (product: any) => {
    const existing = retailCart.find((it) => it.productId === product.id);
    if (existing) {
      setRetailCart((prev) =>
        prev.map((it) =>
          it.productId === product.id
            ? { ...it, qty: it.qty + 1, price: product.price * (it.qty + 1) }
            : it
        )
      );
    } else {
      setRetailCart((prev) => [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          qty: 1,
          type: product.category ? String(product.category).toLowerCase() : 'drink',
        },
      ]);
    }
  };

  const removeRetailItem = (productId: string) => {
    setRetailCart((prev) => prev.filter((it) => it.productId !== productId));
  };

  const handleQuick5050 = () => {
    const half1 = Math.round(grandTotal / 2);
    const half2 = grandTotal - half1;
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

  const handleSubmit = async () => {
    if (isSubmitting) return;

    let clientName = '';
    let clientPhone = '';
    let resolvedClient: any = null;

    if (clientType === 'registered') {
      if (!clientId) {
        setErrorMessage('Please select a registered client.');
        return;
      }
      resolvedClient = clients.find((c) => String(c.id) === String(clientId));
      clientName = resolvedClient?.name || 'Client';
      clientPhone = resolvedClient?.phone || resolvedClient?.whatsapp || '';
    } else {
      clientName = walkInName.trim() || 'Walk in';
      const rawPhone = walkInPhone.trim();
      clientPhone = rawPhone && rawPhone !== '+237' && rawPhone !== '+237 ' ? rawPhone : '';
    }

    if (!serviceLines || serviceLines.length === 0) {
      setErrorMessage('Please add at least one service.');
      return;
    }

    for (let i = 0; i < serviceLines.length; i++) {
      const line = serviceLines[i];
      if (!line.serviceName && !line.serviceId) {
        setErrorMessage(`Service #${i + 1}: Please select a service.`);
        return;
      }
      if (!line.technicianName && !line.technicianId) {
        setErrorMessage(`Service #${i + 1}: Please assign a technician.`);
        return;
      }
      const priceNum = typeof line.price === 'number' ? line.price : parseInt(String(line.price).replace(/[^0-9]/g, ''), 10);
      if (isNaN(priceNum) || priceNum < 0) {
        setErrorMessage(`Service #${i + 1}: Please enter a valid price.`);
        return;
      }
    }

    if (grandTotal <= 0) {
      setErrorMessage('Invoice grand total must be greater than 0 FCFA.');
      return;
    }

    const collectNow = isMarketer || isTechnician ? false : actionChoice === 'collect_now';

    if (collectNow && isSplit && !isSplitValid) {
      setErrorMessage('Split amounts must exactly match the grand total.');
      return;
    }

    const refStaff = isMarketer
      ? (allUsers?.find((s: any) => String(s.id) === String(user?.id)) || { id: user?.id, name: user?.name })
      : referralStaff.find((s) => String(s.id) === String(introducedById));

    setIsSubmitting(true);
    try {
      const formattedServices = serviceLines.map((line) => ({
        serviceId: line.serviceId || null,
        service: line.serviceName,
        name: line.serviceName,
        technician: line.technicianName,
        technicianId: line.technicianId || null,
        price: typeof line.price === 'number' ? line.price : parseInt(String(line.price).replace(/[^0-9]/g, ''), 10) || 0,
        product: line.product || null,
      }));

      const splits: any[] = [];
      if (collectNow && isSplit) {
        if (cashNum > 0) splits.push({ amount: cashNum, method: 'CASH', paymentMethod: 'CASH' });
        if (momoNum > 0) splits.push({ amount: momoNum, method: 'MTN_MOMO', paymentMethod: 'MTN_MOMO' });
        if (orangeNum > 0) splits.push({ amount: orangeNum, method: 'ORANGE_MONEY', paymentMethod: 'ORANGE_MONEY' });
      }

      const effectivePaymentMethod = collectNow && isSplit
        ? splits.map((s) => `${s.paymentMethod.replace(/_/g, ' ')} (${s.amount.toLocaleString('en-US')})`).join(' + ')
        : paymentMethod;

      const invoice = await createWalkInServiceInvoice({
        client: resolvedClient,
        clientId: resolvedClient?.id || null,
        clientName,
        clientPhone,
        services: formattedServices,
        retailItems: retailCart,
        status: collectNow ? 'PAID' : 'PENDING_PAYMENT',
        paymentMethod: collectNow ? effectivePaymentMethod : null,
        splits: collectNow && isSplit ? splits : [],
        notes,
        introducedBy: refStaff ? refStaff.name : null,
        introducedById: refStaff ? refStaff.id : null,
        discount: 0,
      });

      if (refreshStock) refreshStock();
      onSuccess(invoice, collectNow);
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to create service invoice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter categories
  const categories = ['ALL', 'NAIL CARE', 'FACIAL', 'MASSAGE', 'BARBER', 'BODY TREATMENTS', 'OTHER'];
  const filteredServices = useMemo(() => {
    let list = activeServices;
    if (serviceCategory !== 'ALL') {
      list = list.filter((s) => s.category.toUpperCase().includes(serviceCategory));
    }
    if (serviceSearch.trim()) {
      const q = serviceSearch.toLowerCase().trim();
      list = list.filter((s) => s.name.toLowerCase().includes(q));
    }
    return list;
  }, [activeServices, serviceCategory, serviceSearch]);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients || [];
    const q = clientSearch.toLowerCase().trim();
    return (clients || []).filter(
      (c) => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))
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
                <Sparkles size={18} color="#4F6748" />
              </View>
              <View>
                <View style={styles.titleWithBadge}>
                  <Text style={styles.headerTitle}>New Walk-In / Service Invoice</Text>
                  {serviceLines.length > 1 && (
                    <View style={styles.sharedBadge}>
                      <Users size={10} color="#2C422E" />
                      <Text style={styles.sharedBadgeText}>Shared ({serviceLines.length})</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.headerSub}>
                  Create service invoice & assign performing technicians
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={18} color="#737373" />
            </TouchableOpacity>
          </View>

          {/* Error Banner */}
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <AlertCircle size={14} color="#DC2626" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Scrollable Form Body */}
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* 1. Customer Info */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>CUSTOMER INFO</Text>
                <View style={styles.typeToggleRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setClientType('walkin');
                      setErrorMessage('');
                    }}
                    style={[styles.typeToggleBtn, clientType === 'walkin' && styles.typeToggleBtnActive]}
                  >
                    <Text style={[styles.typeToggleText, clientType === 'walkin' && styles.typeToggleTextActive]}>
                      Walk-in
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setClientType('registered');
                      setErrorMessage('');
                    }}
                    style={[styles.typeToggleBtn, clientType === 'registered' && styles.typeToggleBtnActive]}
                  >
                    <Text style={[styles.typeToggleText, clientType === 'registered' && styles.typeToggleTextActive]}>
                      Registered Client
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {clientType === 'walkin' ? (
                <View style={styles.walkInInputsRow}>
                  <View style={styles.walkInInputCol}>
                    <Text style={styles.inputLabel}>Client Name (Optional)</Text>
                    <TextInput
                      value={walkInName}
                      onChangeText={setWalkInName}
                      placeholder="e.g. Marie or leave blank for 'Walk in'"
                      style={styles.textInput}
                    />
                  </View>
                  <View style={styles.walkInInputCol}>
                    <Text style={styles.inputLabel}>Phone Number (Optional)</Text>
                    <TextInput
                      value={walkInPhone}
                      onChangeText={setWalkInPhone}
                      placeholder="+237 6XX XX XX XX"
                      keyboardType="phone-pad"
                      style={styles.textInput}
                    />
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => setIsClientPickerOpen(true)}
                  style={styles.clientPickerTrigger}
                  activeOpacity={0.8}
                >
                  <View style={styles.clientPickerLeft}>
                    <User size={16} color="#737373" />
                    <View>
                      <Text style={styles.clientPickerName}>
                        {selectedClient ? selectedClient.name : 'Select Registered Client...'}
                      </Text>
                      <Text style={styles.clientPickerSub}>
                        {selectedClient
                          ? `${selectedClient.phone || 'No phone'} · ${selectedClient.loyaltyBalance || 0} pts`
                          : 'Tap to browse registered client database'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.changeText}>Choose</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 2. Referral Staff Introducer (Optional) */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>STAFF INTRODUCER / REFERRAL</Text>
              {isMarketer ? (
                <View style={styles.marketerCreditedBox}>
                  <Sparkles size={14} color="#6D28D9" />
                  <Text style={styles.marketerCreditedText}>
                    Credited to you: <Text style={{ fontWeight: '800' }}>{user?.name}</Text> (Marketer Referral)
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => setIsReferralPickerOpen(true)}
                  style={styles.selectorTrigger}
                  activeOpacity={0.8}
                >
                  <Text style={styles.selectorTriggerText}>
                    {selectedReferral ? selectedReferral.name : 'None / Walk-in Direct'}
                  </Text>
                  <ChevronDown size={16} color="#737373" />
                </TouchableOpacity>
              )}
            </View>

            {/* 3. Services Performed (with Shared Work Support) */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>SERVICES PERFORMED</Text>
                <Text style={styles.servicesCountBadge}>
                  {serviceLines.length} {serviceLines.length === 1 ? 'Service' : 'Services'}
                </Text>
              </View>

              {serviceLines.map((line, idx) => (
                <View key={line.id} style={styles.serviceLineBox}>
                  <View style={styles.serviceLineHeader}>
                    <Text style={styles.serviceLineTitle}>Service #{idx + 1}</Text>
                    {serviceLines.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeServiceLine(idx)}
                        style={styles.removeLineBtn}
                      >
                        <Trash2 size={14} color="#DC2626" />
                        <Text style={styles.removeLineText}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Service selector */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.inputLabel}>Service</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setServicePickerLineIdx(idx);
                        setIsServicePickerOpen(true);
                      }}
                      style={styles.selectorTrigger}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.selectorTriggerText,
                          !line.serviceName && { color: '#9CA3AF' },
                        ]}
                      >
                        {line.serviceName || '— Select Service —'}
                      </Text>
                      <ChevronDown size={16} color="#737373" />
                    </TouchableOpacity>
                  </View>

                  {/* Technician selector */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.inputLabel}>Performing Technician</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setTechPickerLineIdx(idx);
                        setIsTechPickerOpen(true);
                      }}
                      style={styles.selectorTrigger}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.selectorTriggerText,
                          !line.technicianName && { color: '#9CA3AF' },
                        ]}
                      >
                        {line.technicianName || '— Assign Technician —'}
                      </Text>
                      <ChevronDown size={16} color="#737373" />
                    </TouchableOpacity>
                  </View>

                  {/* Price & Product Used */}
                  <View style={styles.priceProductRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Price (FCFA)</Text>
                      <TextInput
                        keyboardType="numeric"
                        value={String(line.price)}
                        onChangeText={(val) => updateServiceLineField(idx, 'price', val)}
                        placeholder="0"
                        style={styles.textInput}
                      />
                    </View>
                    <View style={{ flex: 1.2 }}>
                      <Text style={styles.inputLabel}>Product Used (Optional)</Text>
                      <TextInput
                        value={line.product}
                        onChangeText={(val) => updateServiceLineField(idx, 'product', val)}
                        placeholder="e.g. OPI Polish"
                        style={styles.textInput}
                      />
                    </View>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                onPress={addServiceLine}
                style={styles.addSharedWorkBtn}
                activeOpacity={0.8}
              >
                <Plus size={15} color="#4F6748" strokeWidth={2.5} />
                <Text style={styles.addSharedWorkBtnText}>
                  + Add Another Service / Shared Work
                </Text>
              </TouchableOpacity>
            </View>

            {/* 4. Optional Retail Additions */}
            {!isMarketer && (
              <View style={styles.sectionCard}>
                <TouchableOpacity
                  onPress={() => setShowRetailSection((prev) => !prev)}
                  style={styles.retailToggleBtn}
                  activeOpacity={0.8}
                >
                  <View style={styles.retailToggleLeft}>
                    <ShoppingBag size={16} color="#4F6748" />
                    <Text style={styles.retailToggleText}>
                      Add Retail Products (Optional)
                    </Text>
                    {retailCart.length > 0 && (
                      <View style={styles.retailCartBadge}>
                        <Text style={styles.retailCartBadgeText}>
                          {retailCart.reduce((s, it) => s + it.qty, 0)} items
                        </Text>
                      </View>
                    )}
                  </View>
                  <ChevronDown
                    size={16}
                    color="#737373"
                    style={{ transform: [{ rotate: showRetailSection ? '180deg' : '0deg' }] }}
                  />
                </TouchableOpacity>

                {showRetailSection && (
                  <View style={styles.retailExpandedBox}>
                    {/* Retail Tabs */}
                    <View style={styles.productTabsRow}>
                      <TouchableOpacity
                        onPress={() => setRetailTab('drinks')}
                        style={[styles.productTab, retailTab === 'drinks' && styles.productTabActive]}
                      >
                        <Coffee size={13} color={retailTab === 'drinks' ? '#2D2D2A' : '#737373'} />
                        <Text style={[styles.productTabText, retailTab === 'drinks' && styles.productTabTextActive]}>
                          Drinks ({drinks.length})
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setRetailTab('cosmetics')}
                        style={[styles.productTab, retailTab === 'cosmetics' && styles.productTabActive]}
                      >
                        <Sparkles size={13} color={retailTab === 'cosmetics' ? '#2D2D2A' : '#737373'} />
                        <Text style={[styles.productTabText, retailTab === 'cosmetics' && styles.productTabTextActive]}>
                          Cosmetics ({cosmetics.length})
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Available Retail Items */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.retailHorizontalScroll}>
                      {(retailTab === 'drinks' ? drinks : cosmetics).map((prod) => (
                        <View key={prod.id} style={styles.retailMiniCard}>
                          <Text style={styles.retailMiniName} numberOfLines={1}>{prod.name}</Text>
                          <Text style={styles.retailMiniPrice}>{formatFCFA(prod.price)}</Text>
                          <TouchableOpacity
                            onPress={() => addRetailItem(prod)}
                            style={styles.retailMiniAddBtn}
                          >
                            <Plus size={12} color="#FFFFFF" strokeWidth={3} />
                            <Text style={styles.retailMiniAddText}>Add</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>

                    {/* Selected Retail Items */}
                    {retailCart.length > 0 && (
                      <View style={styles.retailCartList}>
                        {retailCart.map((it) => (
                          <View key={it.productId} style={styles.retailCartRow}>
                            <Text style={styles.retailCartName}>{it.qty}x {it.name}</Text>
                            <Text style={styles.retailCartPrice}>{formatFCFA(it.price)}</Text>
                            <TouchableOpacity onPress={() => removeRetailItem(it.productId)}>
                              <X size={14} color="#DC2626" />
                            </TouchableOpacity>
                          </View>
                        ))}
                        <View style={styles.retailSubtotalRow}>
                          <Text style={styles.retailSubtotalLabel}>Retail Total:</Text>
                          <Text style={styles.retailSubtotalVal}>{formatFCFA(retailTotal)}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* 5. Notes */}
            <View style={styles.sectionCard}>
              <Text style={styles.inputLabel}>Technician Notes / Client Observations (Optional)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Add special instructions or client preferences..."
                multiline
                numberOfLines={2}
                style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
              />
            </View>

            {/* 6. SELECT WORKFLOW */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>SELECT WORKFLOW</Text>
              {isMarketer || isTechnician ? (
                <View style={styles.marketerPendingNotice}>
                  <Sparkles size={14} color="#5B6E58" />
                  <Text style={styles.marketerPendingNoticeText}>
                    Pending Invoice Mode (Payment at Reception)
                  </Text>
                </View>
              ) : (
                <View style={styles.workflowRow}>
                  <TouchableOpacity
                    onPress={() => setActionChoice('pending')}
                    style={[
                      styles.workflowBtn,
                      actionChoice === 'pending' && styles.workflowBtnActive,
                    ]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.workflowBtnText, actionChoice === 'pending' && styles.workflowBtnTextActive]}>
                      Pending Invoice
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setActionChoice('collect_now')}
                    style={[
                      styles.workflowBtn,
                      actionChoice === 'collect_now' && styles.workflowBtnActiveSuccess,
                    ]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.workflowBtnText, actionChoice === 'collect_now' && styles.workflowBtnTextActive]}>
                      Collect Now
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Payment Details if Collect Now */}
              {actionChoice === 'collect_now' && (
                <View style={styles.paymentSectionBox}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.inputLabel}>PAYMENT METHOD</Text>
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
                    >
                      <Text style={[styles.modeToggleText, !isSplit && styles.modeToggleTextActive]}>
                        Single Payment
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setIsSplit(true);
                        if (splitTotal === 0 && grandTotal > 0) handleQuick5050();
                      }}
                      style={[styles.modeToggleBtn, isSplit && styles.modeToggleBtnActive]}
                    >
                      <Text style={[styles.modeToggleText, isSplit && styles.modeToggleTextActive]}>
                        Split Payment
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {!isSplit ? (
                    <View style={styles.methodsRow}>
                      {(['CASH', 'MTN_MOMO', 'ORANGE_MONEY'] as const).map((m) => {
                        const isSelected = paymentMethod === m;
                        const label = m === 'CASH' ? 'CASH' : m === 'MTN_MOMO' ? 'MTN MOMO' : 'ORANGE MONEY';
                        return (
                          <TouchableOpacity
                            key={m}
                            onPress={() => setPaymentMethod(m)}
                            style={[styles.methodBtn, isSelected && styles.methodBtnActive]}
                          >
                            <Text style={[styles.methodBtnText, isSelected && styles.methodBtnTextActive]}>
                              {label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
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
                            ? '✓ Exact Match: Split amounts match grand total'
                            : splitRemaining > 0
                            ? `Remaining: ${formatFCFA(splitRemaining)}`
                            : `Over by: ${formatFCFA(Math.abs(splitRemaining))}`}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer Bar */}
          <View style={styles.footer}>
            <View style={styles.footerTotalCol}>
              <Text style={styles.footerTotalLabel}>
                GRAND TOTAL ({serviceLines.length} SERVICE{serviceLines.length > 1 ? 'S' : ''})
              </Text>
              <Text style={styles.footerTotalValue}>{formatFCFA(grandTotal)}</Text>
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
                onPress={handleSubmit}
                disabled={
                  isSubmitting ||
                  grandTotal <= 0 ||
                  (actionChoice === 'collect_now' && isSplit && !isSplitValid)
                }
                style={[
                  styles.submitBtn,
                  actionChoice === 'collect_now' ? styles.submitBtnCollect : styles.submitBtnPending,
                  (isSubmitting ||
                    grandTotal <= 0 ||
                    (actionChoice === 'collect_now' && isSplit && !isSplitValid)) && {
                    opacity: 0.6,
                  },
                ]}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : actionChoice === 'collect_now' ? (
                  <Check size={16} color="#FFFFFF" />
                ) : (
                  <Sparkles size={16} color="#FFFFFF" />
                )}
                <Text style={styles.submitBtnText}>
                  {isSubmitting
                    ? 'Saving...'
                    : actionChoice === 'collect_now'
                    ? isSplit && !isSplitValid
                      ? splitRemaining > 0
                        ? `Allocate ${formatFCFA(splitRemaining)} Remaining`
                        : `Over by ${formatFCFA(Math.abs(splitRemaining))}`
                      : `Collect Payment (${formatFCFA(grandTotal)})`
                    : `Create Pending (${formatFCFA(grandTotal)})`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Service Picker Modal */}
      <Modal visible={isServicePickerOpen} transparent animationType="slide">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Service</Text>
              <TouchableOpacity onPress={() => setIsServicePickerOpen(false)}>
                <X size={18} color="#2D2D2A" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
              <Search size={16} color="#737373" />
              <TextInput
                value={serviceSearch}
                onChangeText={setServiceSearch}
                placeholder="Search services..."
                style={styles.searchInput}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryChipsScroll}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setServiceCategory(cat)}
                  style={[
                    styles.categoryChip,
                    serviceCategory === cat && styles.categoryChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      serviceCategory === cat && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView style={{ maxHeight: 350 }}>
              {filteredServices.map((svc) => (
                <TouchableOpacity
                  key={svc.id}
                  onPress={() => {
                    updateServiceLineField(servicePickerLineIdx, 'serviceId', svc.id);
                    updateServiceLineField(servicePickerLineIdx, 'serviceName', svc.name);
                    updateServiceLineField(servicePickerLineIdx, 'price', svc.numericPrice);
                    setIsServicePickerOpen(false);
                  }}
                  style={styles.serviceItem}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.serviceItemName}>{svc.name}</Text>
                    <Text style={styles.serviceItemMeta}>
                      {svc.category} · {svc.duration}
                    </Text>
                  </View>
                  <Text style={styles.serviceItemPrice}>{formatFCFA(svc.numericPrice)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Technician Picker Modal */}
      <Modal visible={isTechPickerOpen} transparent animationType="slide">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Assign Performing Technician</Text>
              <TouchableOpacity onPress={() => setIsTechPickerOpen(false)}>
                <X size={18} color="#2D2D2A" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 350 }}>
              {technicians.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => {
                    updateServiceLineField(techPickerLineIdx, 'technicianId', String(t.id));
                    updateServiceLineField(techPickerLineIdx, 'technicianName', t.name);
                    setIsTechPickerOpen(false);
                  }}
                  style={styles.techItem}
                >
                  <View>
                    <Text style={styles.techItemName}>{t.name}</Text>
                    <Text style={styles.techItemSub}>
                      {(t.specialties || []).join(', ') || 'Technician'}
                    </Text>
                  </View>
                  {serviceLines[techPickerLineIdx]?.technicianId === String(t.id) && (
                    <Check size={16} color="#4F6748" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

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

      {/* Staff Introducer Picker Modal */}
      <Modal visible={isReferralPickerOpen} transparent animationType="slide">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Staff Introducer</Text>
              <TouchableOpacity onPress={() => setIsReferralPickerOpen(false)}>
                <X size={18} color="#2D2D2A" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 350 }}>
              <TouchableOpacity
                onPress={() => {
                  setIntroducedById('');
                  setIsReferralPickerOpen(false);
                }}
                style={[styles.techItem, !introducedById && styles.clientItemActive]}
              >
                <Text style={styles.techItemName}>None / Walk-in Direct</Text>
                {!introducedById && <Check size={16} color="#4F6748" />}
              </TouchableOpacity>

              {referralStaff.map((s) => {
                const isSelected = String(s.id) === String(introducedById);
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => {
                      setIntroducedById(String(s.id));
                      setIsReferralPickerOpen(false);
                    }}
                    style={[styles.techItem, isSelected && styles.clientItemActive]}
                  >
                    <View>
                      <Text style={styles.techItemName}>{s.name}</Text>
                      <Text style={styles.techItemSub}>{s.role}</Text>
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
    maxHeight: '94%',
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
    backgroundColor: '#FAF7F2',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EBF3EA',
    borderWidth: 1,
    borderColor: '#C8DEC4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F2E6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sharedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2C422E',
  },
  headerSub: {
    fontSize: 11,
    color: '#737373',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FCA5A5',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
    flex: 1,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 14,
    gap: 14,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 14,
    padding: 12,
    gap: 10,
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
  marketerCreditedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EDE9FE',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 10,
    padding: 10,
  },
  marketerCreditedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6D28D9',
    flex: 1,
  },
  marketerPendingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EBF3EC',
    borderWidth: 1,
    borderColor: '#C7DEC9',
    borderRadius: 10,
    padding: 10,
  },
  marketerPendingNoticeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F6748',
    flex: 1,
  },
  typeToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F5EFEB',
    padding: 2,
    borderRadius: 8,
  },
  typeToggleBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  typeToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    ...THEME.shadows.sm,
  },
  typeToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#737373',
  },
  typeToggleTextActive: {
    color: '#2D2D2A',
    fontWeight: '700',
  },
  walkInInputsRow: {
    gap: 8,
  },
  walkInInputCol: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#737373',
  },
  textInput: {
    height: 40,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#2D2D2A',
  },
  clientPickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
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
  selectorTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  selectorTriggerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  servicesCountBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F6748',
    backgroundColor: '#EBF3EA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  serviceLineBox: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  serviceLineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serviceLineTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F6748',
  },
  removeLineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  removeLineText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  fieldGroup: {
    gap: 4,
  },
  priceProductRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addSharedWorkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#EBF3EA',
    borderWidth: 1,
    borderColor: '#C8DEC4',
    borderRadius: 10,
  },
  addSharedWorkBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F6748',
  },
  retailToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  retailToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retailToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  retailCartBadge: {
    backgroundColor: '#4F6748',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  retailCartBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  retailExpandedBox: {
    marginTop: 8,
    gap: 8,
  },
  productTabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  productTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#F5EFEB',
  },
  productTabActive: {
    backgroundColor: '#2D2D2A',
  },
  productTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#737373',
  },
  productTabTextActive: {
    color: '#FFFFFF',
  },
  retailHorizontalScroll: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  retailMiniCard: {
    width: 120,
    padding: 8,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    marginRight: 8,
    gap: 4,
  },
  retailMiniName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  retailMiniPrice: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4F6748',
  },
  retailMiniAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: '#4F6748',
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 2,
  },
  retailMiniAddText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  retailCartList: {
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    padding: 8,
    gap: 4,
  },
  retailCartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  retailCartName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2D2D2A',
    flex: 1,
  },
  retailCartPrice: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F6748',
    marginRight: 8,
  },
  retailSubtotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E8E2D9',
    paddingTop: 4,
    marginTop: 4,
  },
  retailSubtotalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#737373',
  },
  retailSubtotalVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2D2D2A',
  },
  workflowRow: {
    flexDirection: 'row',
    gap: 8,
  },
  workflowBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    backgroundColor: '#FAF7F2',
  },
  workflowBtnActive: {
    backgroundColor: '#2D2D2A',
    borderColor: '#2D2D2A',
  },
  workflowBtnActiveSuccess: {
    backgroundColor: '#4F6748',
    borderColor: '#4F6748',
  },
  workflowBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#737373',
  },
  workflowBtnTextActive: {
    color: '#FFFFFF',
  },
  paymentSectionBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0ECE6',
    gap: 8,
  },
  modeToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#FAF7F2',
    padding: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  modeToggleBtnActive: {
    backgroundColor: '#2D2D2A',
  },
  modeToggleText: {
    fontSize: 11,
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
    paddingVertical: 2,
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
    marginTop: 2,
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  methodBtnActive: {
    backgroundColor: '#4F6748',
    borderColor: '#4F6748',
  },
  methodBtnText: {
    fontSize: 11,
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
    borderRadius: 10,
    padding: 10,
    gap: 6,
    marginTop: 2,
  },
  splitQuickRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 2,
  },
  quickSplitBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#EBF3EA',
    borderRadius: 6,
  },
  quickSplitBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F6748',
  },
  quickSplitClearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F5EFEB',
    borderRadius: 6,
  },
  quickSplitClearText: {
    fontSize: 10,
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
    fontSize: 11,
    fontWeight: '600',
    color: '#2D2D2A',
    width: 120,
  },
  splitInput: {
    flex: 1,
    height: 34,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
    textAlign: 'right',
  },
  splitStatusBanner: {
    padding: 6,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 2,
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
  submitBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  submitBtnPending: {
    backgroundColor: '#2D2D2A',
  },
  submitBtnCollect: {
    backgroundColor: '#4F6748',
  },
  submitBtnText: {
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
  categoryChipsScroll: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F5EFEB',
    marginRight: 6,
  },
  categoryChipActive: {
    backgroundColor: '#2D2D2A',
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#737373',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5EFEB',
  },
  serviceItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  serviceItemMeta: {
    fontSize: 11,
    color: '#737373',
    marginTop: 2,
  },
  serviceItemPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4F6748',
  },
  techItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5EFEB',
  },
  techItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  techItemSub: {
    fontSize: 11,
    color: '#737373',
    marginTop: 2,
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

export default NewWalkInServiceModal;

