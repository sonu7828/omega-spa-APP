import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Check, Camera, ArrowLeft } from 'lucide-react-native';
import THEME from '../constants/theme';
import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import CameraModal from '../components/CameraModal';
import { formatFCFA } from '../utils/currency';
import { useAppointments, Appointment } from '../context/AppointmentsContext';
import { useInvoices } from '../context/InvoiceContext';

interface CloseServiceScreenProps {
  appointment: Appointment;
  onBack?: () => void;
  onInvoiceCreated?: (invoiceId: string) => void;
}

export const CloseServiceScreen: React.FC<CloseServiceScreenProps> = ({
  appointment,
  onBack,
  onInvoiceCreated,
}) => {
  const { completeService } = useAppointments();
  const { createInvoiceFromAppointment } = useInvoices();

  const [completedServices, setCompletedServices] = useState<string[]>(
    appointment.services.map((s) => s.id)
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [cameraVisible, setCameraVisible] = useState<boolean>(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  const toggleService = (id: string) => {
    if (completedServices.includes(id)) {
      setCompletedServices(completedServices.filter((s) => s !== id));
    } else {
      setCompletedServices([...completedServices, id]);
    }
  };

  const handleFinish = async () => {
    if (completedServices.length === 0) {
      Alert.alert('Required', 'Please select at least one completed service.');
      return;
    }

    try {
      setLoading(true);
      // Execute immediate backend stock deduction for each completed service item
      for (const serviceItemId of completedServices) {
        await completeService(serviceItemId, {
          photoUri: capturedPhoto,
        });
      }

      // Generate invoice for front-desk settlement
      const inv = await createInvoiceFromAppointment(appointment.id);
      setLoading(false);

      Alert.alert(
        'Service Completed & Stock Deducted!',
        'Professional supplies inventory was deducted. Invoice generated for settlement.',
        [
          {
            text: 'Go to Payment',
            onPress: () => {
              if (onInvoiceCreated && inv?.id) {
                onInvoiceCreated(inv.id);
              } else if (onBack) {
                onBack();
              }
            },
          },
        ]
      );
    } catch (e: any) {
      setLoading(false);
      Alert.alert('Error', e?.message || 'Failed to complete service.');
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Complete Service"
        subtitle={`Client: ${appointment.clientName}`}
        rightAction={
          onBack ? (
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <ArrowLeft size={20} color={THEME.colors.text} />
            </TouchableOpacity>
          ) : null
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Notice Card */}
        <Card style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Immediate Stock Consumption</Text>
          <Text style={styles.noticeBody}>
            Marking services completed will immediately record professional back-bar consumption in the database.
          </Text>
        </Card>

        {/* Services to close */}
        <Card>
          <Text style={styles.sectionTitle}>Completed Services</Text>
          {appointment.services.map((srv) => {
            const isChecked = completedServices.includes(srv.id);
            return (
              <TouchableOpacity
                key={srv.id}
                onPress={() => toggleService(srv.id)}
                style={[styles.serviceRow, isChecked && styles.serviceRowSelected]}
              >
                <View style={[styles.checkbox, isChecked && styles.checkboxSelected]}>
                  {isChecked && <Check size={14} color="#fff" />}
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.srvName}>{srv.serviceName}</Text>
                  <Text style={styles.srvTech}>Technician: {srv.technicianName || 'Staff'}</Text>
                </View>
                <Text style={styles.srvPrice}>{formatFCFA(srv.price)}</Text>
              </TouchableOpacity>
            );
          })}
        </Card>

        {/* Photo Verification */}
        <Card>
          <Text style={styles.sectionTitle}>Before / After Verification</Text>
          <Button
            title={capturedPhoto ? 'Photo Attached (Retake)' : 'Take Result Photo'}
            icon={<Camera size={16} color={THEME.colors.primaryDark} />}
            onPress={() => setCameraVisible(true)}
            variant="outline"
          />
        </Card>

        {/* Action Button */}
        <Button
          title="Confirm Completion & Deduct Stock"
          onPress={handleFinish}
          loading={loading}
          variant="primary"
          style={{ marginTop: 12, marginBottom: 24 }}
        />
      </ScrollView>

      {/* Camera Capture Modal */}
      <CameraModal
        visible={cameraVisible}
        title="Capture Result Photo"
        facingDefault="back"
        onClose={() => setCameraVisible(false)}
        onCapture={(uri) => setCapturedPhoto(uri)}
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
  backBtn: {
    padding: 8,
  },
  noticeCard: {
    backgroundColor: THEME.colors.primarySoft,
    borderColor: THEME.colors.primary,
  },
  noticeTitle: {
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '700',
    color: THEME.colors.primaryDark,
    marginBottom: 4,
  },
  noticeBody: {
    fontSize: 12,
    color: THEME.colors.text,
  },
  sectionTitle: {
    fontSize: THEME.typography.sizes.base,
    fontWeight: '700',
    color: THEME.colors.text,
    marginBottom: 12,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  serviceRowSelected: {
    backgroundColor: THEME.colors.surface,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: THEME.colors.primaryDark,
    borderColor: THEME.colors.primaryDark,
  },
  srvName: {
    fontSize: THEME.typography.sizes.base,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  srvTech: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  srvPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primaryDark,
  },
});

export default CloseServiceScreen;

