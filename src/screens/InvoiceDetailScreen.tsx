import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  ArrowLeft,
  Plus,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle,
} from 'lucide-react-native';
import THEME from '../constants/theme';
import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import ReceiptModal from '../components/ReceiptModal';
import { formatFCFA } from '../utils/currency';
import { formatDate } from '../utils/date';
import { useInvoices, Invoice } from '../context/InvoiceContext';
import { useStock } from '../context/StockContext';

interface InvoiceDetailScreenProps {
  invoiceId: string;
  onBack?: () => void;
  onPaymentSuccess?: () => void;
}

export const InvoiceDetailScreen: React.FC<InvoiceDetailScreenProps> = ({
  invoiceId,
  onBack,
  onPaymentSuccess,
}) => {
  const { getInvoice, collectPayment, addRetailToInvoice } = useInvoices();
  const { retailProducts } = useStock();

  const invoice = getInvoice(invoiceId);

  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MTN_MOMO' | 'ORANGE_MONEY'>('CASH');
  const [loading, setLoading] = useState<boolean>(false);
  const [receiptVisible, setReceiptVisible] = useState<boolean>(false);

  if (!invoice) {
    return (
      <View style={styles.container}>
        <Header title="Invoice Details" />
        <View style={styles.center}>
          <Text style={styles.notFound}>Invoice not found.</Text>
          {onBack && <Button title="Go Back" onPress={onBack} style={{ marginTop: 12 }} />}
        </View>
      </View>
    );
  }

  const handleAddRetail = async (retailId: string) => {
    try {
      await addRetailToInvoice(invoice.id, retailId, 1);
      Alert.alert('Added', 'Retail product added to invoice.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add retail product.');
    }
  };

  const handleSettlePayment = async () => {
    try {
      setLoading(true);
      await collectPayment(invoice.id, invoice.total, paymentMethod);
      setLoading(false);
      setReceiptVisible(true);
    } catch (e: any) {
      setLoading(false);
      Alert.alert('Payment Error', e?.message || 'Failed to collect payment.');
    }
  };

  const paymentMethods = [
    { label: 'Cash in Hand', value: 'CASH', icon: Banknote },
    { label: 'MTN Mobile Money', value: 'MTN_MOMO', icon: Smartphone },
    { label: 'Orange Money', value: 'ORANGE_MONEY', icon: Smartphone },
  ];

  return (
    <View style={styles.container}>
      <Header
        title={`Invoice #${invoice.invoiceNumber}`}
        subtitle={`Client: ${invoice.clientName}`}
        rightAction={
          onBack ? (
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <ArrowLeft size={20} color={THEME.colors.text} />
            </TouchableOpacity>
          ) : null
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Invoice Summary Card */}
        <Card>
          <View style={styles.clientRow}>
            <View>
              <Text style={styles.clientName}>{invoice.clientName}</Text>
              <Text style={styles.clientPhone}>{invoice.clientPhone}</Text>
            </View>
            <Text style={styles.dateText}>{formatDate(invoice.createdAt)}</Text>
          </View>
        </Card>

        {/* Line Items */}
        <Card>
          <Text style={styles.sectionTitle}>Invoice Line Items</Text>
          {invoice.items.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>
                  {item.name} {item.quantity > 1 ? `x${item.quantity}` : ''}
                </Text>
                {item.technicianName && (
                  <Text style={styles.itemTech}>By {item.technicianName}</Text>
                )}
              </View>
              <Text style={styles.itemPrice}>
                {formatFCFA(item.price * item.quantity)}
              </Text>
            </View>
          ))}

          <View style={styles.subtotalRow}>
            <Text style={styles.subtotalLabel}>Subtotal</Text>
            <Text style={styles.subtotalValue}>{formatFCFA(invoice.subtotal)}</Text>
          </View>
          {invoice.discount > 0 && (
            <View style={styles.subtotalRow}>
              <Text style={styles.subtotalLabel}>Discount</Text>
              <Text style={[styles.subtotalValue, { color: THEME.colors.success }]}>
                -{formatFCFA(invoice.discount)}
              </Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL TO PAY</Text>
            <Text style={styles.totalValue}>{formatFCFA(invoice.total)}</Text>
          </View>
        </Card>

        {/* Add Retail Items Upsell */}
        {invoice.status === 'PENDING_PAYMENT' && (
          <Card>
            <Text style={styles.sectionTitle}>Add Retail Products to Invoice</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.retailScroll}>
              {retailProducts.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => handleAddRetail(p.id)}
                  style={styles.retailCard}
                >
                  <Text style={styles.retailName}>{p.name}</Text>
                  <Text style={styles.retailPrice}>{formatFCFA(p.price)}</Text>
                  <View style={styles.addPill}>
                    <Plus size={12} color={THEME.colors.primaryDark} />
                    <Text style={styles.addPillText}>Add</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Card>
        )}

        {/* Payment Method Selector */}
        {invoice.status === 'PENDING_PAYMENT' && (
          <Card>
            <Text style={styles.sectionTitle}>Select Payment Method</Text>
            {paymentMethods.map((m) => {
              const isSelected = paymentMethod === m.value;
              const Icon = m.icon;
              return (
                <TouchableOpacity
                  key={m.value}
                  onPress={() => setPaymentMethod(m.value as any)}
                  style={[styles.methodRow, isSelected && styles.methodRowSelected]}
                >
                  <View style={styles.methodLeft}>
                    <Icon
                      size={20}
                      color={isSelected ? THEME.colors.primaryDark : THEME.colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.methodLabel,
                        isSelected && styles.methodLabelSelected,
                      ]}
                    >
                      {m.label}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.radioCircle,
                      isSelected && styles.radioCircleSelected,
                    ]}
                  />
                </TouchableOpacity>
              );
            })}

            <Button
              title={`Collect ${formatFCFA(invoice.total)} & Print Receipt`}
              onPress={handleSettlePayment}
              loading={loading}
              variant="primary"
              style={{ marginTop: 16 }}
            />
          </Card>
        )}
      </ScrollView>

      {/* Printable Receipt Modal */}
      <ReceiptModal
        visible={receiptVisible}
        invoice={invoice}
        onClose={() => {
          setReceiptVisible(false);
          if (onPaymentSuccess) onPaymentSuccess();
          else if (onBack) onBack();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scrollContent: {
    padding: THEME.spacing.lg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFound: {
    color: THEME.colors.textMuted,
    fontSize: 16,
  },
  backBtn: {
    padding: 8,
  },
  clientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  clientName: {
    fontSize: THEME.typography.sizes.lg,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  clientPhone: {
    fontSize: THEME.typography.sizes.sm,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  dateText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  sectionTitle: {
    fontSize: THEME.typography.sizes.base,
    fontWeight: '700',
    color: THEME.colors.text,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  itemTech: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  subtotalLabel: {
    fontSize: 13,
    color: THEME.colors.textMuted,
  },
  subtotalValue: {
    fontSize: 13,
    color: THEME.colors.text,
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    paddingTop: 10,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: THEME.typography.sizes.base,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  totalValue: {
    fontSize: THEME.typography.sizes.xxl,
    fontWeight: '900',
    color: THEME.colors.primaryDark,
  },
  retailScroll: {
    flexDirection: 'row',
  },
  retailCard: {
    width: 130,
    padding: 10,
    borderRadius: THEME.radii.md,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginRight: 10,
  },
  retailName: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.text,
    marginBottom: 4,
  },
  retailPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primaryDark,
    marginBottom: 8,
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: THEME.colors.primarySoft,
    paddingVertical: 4,
    borderRadius: THEME.radii.sm,
  },
  addPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primaryDark,
  },
  methodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: THEME.radii.md,
    backgroundColor: THEME.colors.surface,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  methodRowSelected: {
    backgroundColor: THEME.colors.primarySoft,
    borderColor: THEME.colors.primary,
  },
  methodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  methodLabel: {
    fontSize: 14,
    color: THEME.colors.text,
    fontWeight: '500',
  },
  methodLabelSelected: {
    color: THEME.colors.primaryDark,
    fontWeight: '700',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: THEME.colors.textMuted,
  },
  radioCircleSelected: {
    borderColor: THEME.colors.primaryDark,
    backgroundColor: THEME.colors.primaryDark,
  },
});

export default InvoiceDetailScreen;

