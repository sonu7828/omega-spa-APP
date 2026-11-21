import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import {
  Calendar,
  Clock,
  User,
  ArrowLeft,
  Play,
  CheckCircle,
  AlertTriangle,
  XCircle,
  X,
} from 'lucide-react-native';
import THEME from '../constants/theme';
import Header from '../components/Header';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Input from '../components/Input';
import { formatFCFA } from '../utils/currency';
import { formatDate, formatTime } from '../utils/date';
import { useAppointments, Appointment } from '../context/AppointmentsContext';

interface AppointmentDetailScreenProps {
  appointmentId: string;
  onBack?: () => void;
  onCloseService?: (appointment: Appointment) => void;
}

export const AppointmentDetailScreen: React.FC<AppointmentDetailScreenProps> = ({
  appointmentId,
  onBack,
  onCloseService,
}) => {
  const { getAppointment, updateAppointmentStatus } = useAppointments();
  const appointment = getAppointment(appointmentId);
  const [loading, setLoading] = useState<boolean>(false);

  // Late Modal
  const [showLateModal, setShowLateModal] = useState<boolean>(false);
  const [lateMinutesInput, setLateMinutesInput] = useState<string>('15');

  // No-Show Modal
  const [showNoShowModal, setShowNoShowModal] = useState<boolean>(false);
  const [noShowReason, setNoShowReason] = useState<string>('Client did not show up and was unreachable.');

  if (!appointment) {
    return (
      <View style={styles.container}>
        <Header title="Appointment Detail" />
        <View style={styles.centerContainer}>
          <Text style={styles.notFoundText}>Appointment not found.</Text>
          {onBack && <Button title="Back" onPress={onBack} style={{ marginTop: 12 }} />}
        </View>
      </View>
    );
  }

  const handleStartService = async () => {
    try {
      setLoading(true);
      await updateAppointmentStatus(appointment.id, 'IN_PROGRESS');
      setLoading(false);
      Alert.alert('Service Started', 'Appointment status set to IN_PROGRESS.');
    } catch (e: any) {
      setLoading(false);
      Alert.alert('Error', e?.message || 'Failed to update appointment status.');
    }
  };

  const handleSaveLate = async () => {
    const mins = parseInt(lateMinutesInput, 10) || 15;
    try {
      setLoading(true);
      await updateAppointmentStatus(appointment.id, 'IN_PROGRESS', {
        lateMinutes: mins,
      });
      setLoading(false);
      setShowLateModal(false);
      Alert.alert('Recorded', `Recorded ${mins} minutes client delay.`);
    } catch (e: any) {
      setLoading(false);
      Alert.alert('Error', e?.message || 'Failed to record delay.');
    }
  };

  const handleSaveNoShow = async () => {
    try {
      setLoading(true);
      await updateAppointmentStatus(appointment.id, 'NO_SHOW', {
        noShowReason: noShowReason,
      });
      setLoading(false);
      setShowNoShowModal(false);
      Alert.alert('No-Show Recorded', 'Client file updated with no-show penalty flag.');
    } catch (e: any) {
      setLoading(false);
      Alert.alert('Error', e?.message || 'Failed to record no-show.');
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Appointment Detail"
        subtitle={`Booking #${appointment.id.slice(-6)}`}
        rightAction={
          onBack ? (
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <ArrowLeft size={20} color={THEME.colors.text} />
            </TouchableOpacity>
          ) : null
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Card */}
        <Card>
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.clientName}>{appointment.clientName}</Text>
              <Text style={styles.clientPhone}>{appointment.clientPhone}</Text>
            </View>
            <Badge
              label={appointment.status}
              variant={
                appointment.status === 'COMPLETED'
                  ? 'success'
                  : appointment.status === 'IN_PROGRESS'
                  ? 'info'
                  : appointment.status === 'NO_SHOW' || appointment.status === 'CANCELLED'
                  ? 'danger'
                  : 'primary'
              }
            />
          </View>

          <View style={styles.scheduleInfo}>
            <View style={styles.infoCol}>
              <Calendar size={14} color={THEME.colors.textMuted} />
              <Text style={styles.infoText}>{formatDate(appointment.date)}</Text>
            </View>
            <View style={styles.infoCol}>
              <Clock size={14} color={THEME.colors.textMuted} />
              <Text style={styles.infoText}>{formatTime(appointment.time)}</Text>
            </View>
            <View style={styles.infoCol}>
              <User size={14} color={THEME.colors.textMuted} />
              <Text style={styles.infoText}>{appointment.mainTechnicianName || 'Staff'}</Text>
            </View>
          </View>

          {appointment.lateMinutes ? (
            <View style={styles.lateBanner}>
              <AlertTriangle size={14} color={THEME.colors.warning} />
              <Text style={styles.lateText}>
                Late arrival recorded: {appointment.lateMinutes} minutes
              </Text>
            </View>
          ) : null}
        </Card>

        {/* Services List */}
        <Card>
          <Text style={styles.sectionTitle}>Booked Services</Text>
          {appointment.services.map((srv, idx) => (
            <View key={idx} style={styles.serviceRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.srvName}>{srv.serviceName}</Text>
                <Text style={styles.srvTech}>Staff: {srv.technicianName || 'Assigned'}</Text>
              </View>
              <Text style={styles.srvPrice}>{formatFCFA(srv.price)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Price</Text>
            <Text style={styles.totalValue}>{formatFCFA(appointment.totalPrice)}</Text>
          </View>
        </Card>

        {/* Operational Actions */}
        <Card style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>Service Workflow Actions</Text>

          {appointment.status === 'SCHEDULED' && (
            <Button
              title="Start Service"
              icon={<Play size={16} color={THEME.colors.primaryDark} />}
              onPress={handleStartService}
              loading={loading}
              variant="primary"
              style={{ marginBottom: 10 }}
            />
          )}

          {appointment.status !== 'COMPLETED' && (
            <Button
              title="Complete & Close Service (Deduct Stock)"
              icon={<CheckCircle size={16} color={THEME.colors.primaryDark} />}
              onPress={() => onCloseService && onCloseService(appointment)}
              variant="primary"
              style={{ marginBottom: 10 }}
            />
          )}

          {appointment.status !== 'COMPLETED' && (
            <View style={styles.secondaryActions}>
              <Button
                title="Mark Late"
                variant="outline"
                onPress={() => setShowLateModal(true)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Mark No-Show"
                variant="danger"
                onPress={() => setShowNoShowModal(true)}
                style={{ flex: 1 }}
              />
            </View>
          )}
        </Card>
      </ScrollView>

      {/* Late Arrival Modal */}
      <Modal visible={showLateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Client Delay</Text>
              <TouchableOpacity onPress={() => setShowLateModal(false)}>
                <X size={20} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Input
                label="Late Arrival (Minutes)"
                value={lateMinutesInput}
                onChangeText={setLateMinutesInput}
                keyboardType="numeric"
                placeholder="15"
              />
              <View style={styles.quickMinsRow}>
                {['10', '15', '20', '30'].map((mins) => (
                  <TouchableOpacity
                    key={mins}
                    onPress={() => setLateMinutesInput(mins)}
                    style={[styles.quickMinChip, lateMinutesInput === mins && styles.quickMinChipActive]}
                  >
                    <Text style={[styles.quickMinText, lateMinutesInput === mins && styles.quickMinTextActive]}>
                      +{mins} min
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Button
                title="Confirm Client Delay"
                onPress={handleSaveLate}
                loading={loading}
                style={{ marginTop: 12 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* No-Show Modal */}
      <Modal visible={showNoShowModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Client No-Show</Text>
              <TouchableOpacity onPress={() => setShowNoShowModal(false)}>
                <X size={20} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.label}>Select No-Show Reason</Text>
              <View style={styles.reasonsList}>
                {[
                  'Client unreachable by phone',
                  'Cancelled 5 mins before appointment',
                  'Heavy rain / Douala traffic',
                  'Emergency / Personal issue',
                ].map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    onPress={() => setNoShowReason(reason)}
                    style={[styles.reasonSelectChip, noShowReason === reason && styles.reasonSelectChipActive]}
                  >
                    <Text style={[styles.reasonSelectText, noShowReason === reason && styles.reasonSelectTextActive]}>
                      {reason}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Button
                title="Confirm No-Show & Release Staff"
                variant="danger"
                onPress={handleSaveNoShow}
                loading={loading}
                style={{ marginTop: 14 }}
              />
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
    backgroundColor: THEME.colors.background,
  },
  scrollContent: {
    padding: THEME.spacing.lg,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundText: {
    color: THEME.colors.textMuted,
    fontSize: THEME.typography.sizes.base,
  },
  backBtn: {
    padding: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  clientName: {
    fontSize: THEME.typography.sizes.lg,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  clientPhone: {
    fontSize: THEME.typography.sizes.sm,
    color: THEME.colors.textMuted,
  },
  scheduleInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderLight,
    paddingTop: 12,
  },
  infoCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 12,
    color: THEME.colors.text,
    fontWeight: '500',
  },
  lateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.warningBg,
    padding: 8,
    borderRadius: THEME.radii.sm,
    marginTop: 12,
  },
  lateText: {
    fontSize: 12,
    color: THEME.colors.warning,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: THEME.typography.sizes.base,
    fontWeight: '700',
    color: THEME.colors.text,
    marginBottom: 12,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
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
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  totalLabel: {
    fontSize: THEME.typography.sizes.base,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  totalValue: {
    fontSize: THEME.typography.sizes.xl,
    fontWeight: '800',
    color: THEME.colors.primaryDark,
  },
  actionsCard: {
    backgroundColor: THEME.colors.surface,
  },
  secondaryActions: {
    flexDirection: 'row',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: THEME.colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  modalBody: {
    padding: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
    marginBottom: 8,
  },
  quickMinsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  quickMinChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: THEME.colors.background,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  quickMinChipActive: {
    backgroundColor: THEME.colors.primaryLight,
    borderColor: THEME.colors.primary,
  },
  quickMinText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  quickMinTextActive: {
    color: THEME.colors.primaryDark,
  },
  reasonsList: {
    gap: 6,
    marginBottom: 8,
  },
  reasonSelectChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: THEME.colors.background,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  reasonSelectChipActive: {
    backgroundColor: '#FEE2E2',
    borderColor: THEME.colors.danger,
  },
  reasonSelectText: {
    fontSize: 13,
    color: THEME.colors.text,
  },
  reasonSelectTextActive: {
    color: THEME.colors.danger,
    fontWeight: '600',
  },
});

export default AppointmentDetailScreen;

