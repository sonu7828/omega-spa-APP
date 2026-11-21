import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { CheckCircle2, MessageSquare, X, Printer } from 'lucide-react-native';
import THEME from '../constants/theme';
import Button from './Button';
import { formatFCFA } from '../utils/currency';
import { formatDate } from '../utils/date';
import { useInvoices } from '../context/InvoiceContext';
import { API_BASE_URL } from '../services/api';

interface ReceiptModalProps {
  visible: boolean;
  invoice: any;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  visible,
  invoice,
  onClose,
}) => {
  const { sendWhatsAppReceipt } = useInvoices();
  const [sending, setSending] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);

  if (!invoice) return null;

  const payments = Array.isArray(invoice.payments) ? invoice.payments : [];
  let paymentMethodDisplay = 'CASH';
  if (payments.length > 1) {
    paymentMethodDisplay = payments
      .map((p: any) => {
        const raw = String(p.paymentMethod || p.method || '').toUpperCase();
        const label = raw.includes('ORANGE') ? 'ORANGE MONEY' : raw.includes('MTN') || raw.includes('MOMO') ? 'MTN MOMO' : 'CASH';
        return `${label}: ${Number(p.amount || 0).toLocaleString('en-US')} FCFA`;
      })
      .join(' + ');
  } else if (invoice.paymentMethod && (String(invoice.paymentMethod).includes('+') || String(invoice.paymentMethod).includes(':'))) {
    paymentMethodDisplay = String(invoice.paymentMethod);
  } else if (payments.length === 1) {
    const p0 = payments[0];
    if (p0.notes && (p0.notes.includes('+') || p0.notes.toLowerCase().includes('split payment:'))) {
      paymentMethodDisplay = p0.notes.replace(/^Split payment:\s*/i, '').trim();
    } else {
      const raw = String(p0.paymentMethod || p0.method || '').toUpperCase();
      paymentMethodDisplay = raw.includes('ORANGE') ? 'ORANGE MONEY' : raw.includes('MTN') || raw.includes('MOMO') ? 'MTN MOMO' : 'CASH';
    }
  } else if (invoice.paymentMethod) {
    const raw = String(invoice.paymentMethod).toUpperCase();
    paymentMethodDisplay = raw.includes('ORANGE') ? 'ORANGE MONEY' : raw.includes('MTN') || raw.includes('MOMO') ? 'MTN MOMO' : 'CASH';
  }

  const handlePrintReceipt = async () => {
    try {
      setDownloading(true);
      const targetId = invoice.id || invoice.invoiceNumber;
      const pdfUrl = `${API_BASE_URL}/invoices/${encodeURIComponent(targetId)}/pdf`;
      const supported = await Linking.canOpenURL(pdfUrl).catch(() => true);
      if (supported) {
        await Linking.openURL(pdfUrl);
      }
    } catch (e: any) {
      Alert.alert('Download Error', e?.message || 'Could not open receipt PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const handleSendWhatsApp = async () => {
    setSending(true);
    const success = await sendWhatsAppReceipt(invoice.id, invoice.clientPhone);
    setSending(false);
    if (success) {
      Alert.alert('Sent!', 'Receipt PDF was dispatched via WhatsApp.');
    } else {
      Alert.alert('Note', 'Invoice receipt generated. WhatsApp cloud message queued.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.topRow}>
            <View style={styles.badgeSuccess}>
              <CheckCircle2 size={16} color={THEME.colors.success} />
              <Text style={styles.badgeText}>PAYMENT COMPLETED</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Salon Info */}
            <View style={styles.spaInfo}>
              <Text style={styles.spaName}>OMEGA SPA & BEAUTY</Text>
              <Text style={styles.spaAddress}>Douala, Cameroon</Text>
              <Text style={styles.invoiceMeta}>
                Invoice #{invoice.invoiceNumber} • {formatDate(invoice.createdAt)}
              </Text>
            </View>

            {/* Client Info */}
            <View style={styles.clientSection}>
              <Text style={styles.sectionLabel}>CLIENT</Text>
              <Text style={styles.clientName}>{invoice.clientName}</Text>
              <Text style={styles.clientPhone}>{invoice.clientPhone}</Text>
            </View>

            {/* Items */}
            <View style={styles.itemsSection}>
              <Text style={styles.sectionLabel}>SERVICES & PRODUCTS</Text>
              {invoice.items?.map((item: any, idx: number) => (
                <View key={idx} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.technicianName ? (
                      <Text style={styles.itemTech}>By {item.technicianName}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.itemPrice}>
                    {formatFCFA(item.price * (item.quantity || 1))}
                  </Text>
                </View>
              ))}
            </View>

            {/* Summary */}
            <View style={styles.totalSection}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>{formatFCFA(invoice.subtotal)}</Text>
              </View>
              {invoice.discount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Discount</Text>
                  <Text style={[styles.summaryValue, { color: THEME.colors.success }]}>
                    -{formatFCFA(invoice.discount)}
                  </Text>
                </View>
              )}
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>TOTAL PAID</Text>
                <Text style={styles.totalValue}>{formatFCFA(invoice.total)}</Text>
              </View>
              <View style={[styles.summaryRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: THEME.colors.borderLight }]}>
                <Text style={styles.summaryLabel}>Payment Method</Text>
                <Text style={[styles.summaryValue, { fontWeight: '700', color: THEME.colors.primaryDark, flex: 1, textAlign: 'right' }]}>
                  {paymentMethodDisplay}
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <Button
                title="Print / Download Official PDF"
                icon={<Printer size={18} color="#2D2D2A" />}
                onPress={handlePrintReceipt}
                loading={downloading}
                variant="secondary"
                style={{ marginBottom: 10 }}
              />
              <Button
                title="Send WhatsApp Receipt"
                icon={<MessageSquare size={18} color={THEME.colors.primaryDark} />}
                onPress={handleSendWhatsApp}
                loading={sending}
                variant="primary"
                style={{ marginBottom: 10 }}
              />
              <Button
                title="Done"
                variant="outline"
                onPress={onClose}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(45, 45, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.xl,
    padding: THEME.spacing.xl,
    ...THEME.shadows.modal,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  badgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.successBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radii.full,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.success,
    marginLeft: 6,
  },
  closeBtn: {
    padding: 4,
  },
  spaInfo: {
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    marginBottom: 16,
  },
  spaName: {
    fontSize: THEME.typography.sizes.xl,
    fontWeight: '800',
    color: THEME.colors.text,
    letterSpacing: 1,
  },
  spaAddress: {
    fontSize: THEME.typography.sizes.sm,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  invoiceMeta: {
    fontSize: THEME.typography.sizes.sm,
    color: THEME.colors.textMuted,
    marginTop: 6,
  },
  clientSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  clientName: {
    fontSize: THEME.typography.sizes.lg,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  clientPhone: {
    fontSize: THEME.typography.sizes.base,
    color: THEME.colors.textMuted,
  },
  itemsSection: {
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  itemName: {
    fontSize: THEME.typography.sizes.base,
    color: THEME.colors.text,
    fontWeight: '600',
  },
  itemTech: {
    fontSize: THEME.typography.sizes.sm,
    color: THEME.colors.textMuted,
  },
  itemPrice: {
    fontSize: THEME.typography.sizes.base,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  totalSection: {
    paddingTop: 8,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: THEME.typography.sizes.base,
    color: THEME.colors.textMuted,
  },
  summaryValue: {
    fontSize: THEME.typography.sizes.base,
    color: THEME.colors.text,
    fontWeight: '600',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    paddingTop: 10,
    marginTop: 6,
  },
  totalLabel: {
    fontSize: THEME.typography.sizes.lg,
    fontWeight: '800',
    color: THEME.colors.text,
  },
  totalValue: {
    fontSize: THEME.typography.sizes.xxl,
    fontWeight: '800',
    color: THEME.colors.primaryDark,
  },
  actions: {
    marginTop: 10,
  },
});

export default ReceiptModal;

