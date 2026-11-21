/**
 * AddClientScreen — 1-to-1 Match with Web Software AddClient.jsx
 * Matches frontend/src/pages/AddClient.jsx:
 * - Header: "New Client" + Back button
 * - Form Card:
 *     1. Name (Client name)
 *     2. Phone / WhatsApp (Cameroon +237 formatted with digit counter and live validation)
 *     3. Quartier (Neighborhood)
 *     4. Birthday Date (Day + Month celebration picker with + Year option)
 *     5. Anniversary Date (Optional) (Day + Month celebration picker with + Year option)
 *     6. Referral Attribution (Auto-credited to technician/marketer or selectable for manager)
 *     7. Action Buttons (Cancel + Save Client)
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  UserPlus,
  ChevronDown,
  X,
  Calendar,
  Globe,
} from 'lucide-react-native';
import THEME from '../constants/theme';
import Card from '../components/Card';
import { useClients } from '../context/ClientsContext';
import { useAuth } from '../context/AuthContext';
import { formatPhoneNumber, validatePhoneNumber } from '../utils/phone';

const MONTHS = [
  { value: '01', name: 'January', label: 'Jan' },
  { value: '02', name: 'February', label: 'Feb' },
  { value: '03', name: 'March', label: 'Mar' },
  { value: '04', name: 'April', label: 'Apr' },
  { value: '05', name: 'May', label: 'May' },
  { value: '06', name: 'June', label: 'Jun' },
  { value: '07', name: 'July', label: 'Jul' },
  { value: '08', name: 'August', label: 'Aug' },
  { value: '09', name: 'September', label: 'Sep' },
  { value: '10', name: 'October', label: 'Oct' },
  { value: '11', name: 'November', label: 'Nov' },
  { value: '12', name: 'December', label: 'Dec' },
];

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

interface AddClientScreenProps {
  onBack?: () => void;
  onSuccess?: (clientId: string) => void;
}

export const AddClientScreen: React.FC<AddClientScreenProps> = ({
  onBack,
  onSuccess,
}) => {
  const { clients, addClient } = useClients();
  const { user, allUsers, isManager } = useAuth();

  // Eligible active staff for manager referral selection
  const eligibleStaff = useMemo(() => {
    return (allUsers || []).filter(
      (u: any) => (u.role === 'technician' || u.role === 'reception') && u.active !== false
    );
  }, [allUsers]);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+237 ');
  const [phoneMode, setPhoneMode] = useState<'+237' | 'other'>('+237');
  const [quartier, setQuartier] = useState('');

  // Birthday celebration state
  const [bDay, setBDay] = useState('');
  const [bMonth, setBMonth] = useState('');
  const [bYear, setBYear] = useState('');
  const [showBYear, setShowBYear] = useState(false);

  // Anniversary celebration state
  const [aDay, setADay] = useState('');
  const [aMonth, setAMonth] = useState('');
  const [aYear, setAYear] = useState('');
  const [showAYear, setShowAYear] = useState(false);

  // Referral Attribution State (for Manager)
  const [referredByStaffId, setReferredByStaffId] = useState('');

  // UI / Errors State
  const [phoneError, setPhoneError] = useState('');
  const [serverError, setServerError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Picker Modal State
  const [pickerTarget, setPickerTarget] = useState<
    'phone_mode' | 'birthday_day' | 'birthday_month' | 'anniversary_day' | 'anniversary_month' | 'staff' | null
  >(null);

  // Phone changes
  const handlePhoneChange = (text: string) => {
    setServerError('');
    setPhoneError('');
    if (text.startsWith('+237')) {
      setPhoneMode('+237');
    } else if (text.startsWith('+') && !text.startsWith('+237')) {
      setPhoneMode('other');
    }
    const formatted = formatPhoneNumber(text);
    setPhone(formatted);
  };

  const handlePhoneModeSelect = (newMode: '+237' | 'other') => {
    setPhoneMode(newMode);
    setPickerTarget(null);
    let digits = (phone || '').replace(/\D/g, '');
    if (digits.startsWith('237')) digits = digits.slice(3);

    if (newMode === '+237') {
      const formatted = formatPhoneNumber(`+237 ${digits.slice(0, 9)}`);
      setPhone(formatted);
    } else {
      setPhone(digits ? `+${digits}` : '+');
    }
  };

  const cameroonDigits = useMemo(() => {
    const cleaned = (phone || '').replace(/\D/g, '');
    const local = cleaned.startsWith('237') ? cleaned.slice(3) : cleaned;
    return local.length;
  }, [phone]);

  const phoneValidation = useMemo(() => {
    return validatePhoneNumber(phone);
  }, [phone]);

  // Birthday date formatted
  const birthdayDate = useMemo(() => {
    if (bDay && bMonth) {
      const y = bYear && bYear.length === 4 ? bYear : '2000';
      return `${y}-${bMonth}-${bDay}`;
    }
    return '';
  }, [bDay, bMonth, bYear]);

  // Anniversary date formatted
  const anniversaryDate = useMemo(() => {
    if (aDay && aMonth) {
      const y = aYear && aYear.length === 4 ? aYear : '2000';
      return `${y}-${aMonth}-${aDay}`;
    }
    return '';
  }, [aDay, aMonth, aYear]);

  const handleSave = async () => {
    setServerError('');
    setPhoneError('');

    if (!name.trim()) {
      setServerError('Client name is required.');
      return;
    }

    const validation = validatePhoneNumber(phone);
    if (!validation.isValid) {
      setPhoneError(validation.message);
      return;
    }

    // Check if client with this phone number already exists
    const cleanInputPhone = phone.replace(/[\s\-\+\(\)]/g, '');
    const existing = clients.find((c) => {
      const cleanExisting = (c.phone || '').replace(/[\s\-\+\(\)]/g, '');
      return cleanExisting && cleanExisting === cleanInputPhone;
    });

    if (existing) {
      const msg = `Client with phone number ${phone} already exists (${existing.name}).`;
      setServerError(msg);
      setPhoneError('Client with this phone number already exists.');
      return;
    }

    setIsSaving(true);
    try {
      const selectedStaffObj = isManager
        ? eligibleStaff.find((s: any) => String(s.id) === String(referredByStaffId))
        : null;

      const newClient = await addClient({
        name: name.trim(),
        phone: phone.trim(),
        whatsapp: phone.trim(),
        quartier: quartier.trim(),
        birthday: birthdayDate || undefined,
        anniversary: anniversaryDate || undefined,
        introducedById: (isManager ? (referredByStaffId || undefined) : user?.id) || undefined,
        introducedBy: (isManager
          ? (selectedStaffObj?.name || undefined)
          : (user?.name || undefined)) || undefined,
        source: isManager ? (referredByStaffId ? 'STAFF_REFERRAL' : 'DIRECT') : 'STAFF_REFERRAL',
      });

      setIsSaving(false);
      Alert.alert('Client Created', `${name.trim()} registered successfully!`, [
        {
          text: 'OK',
          onPress: () => {
            if (onSuccess && newClient?.id) {
              onSuccess(newClient.id);
            } else if (onBack) {
              onBack();
            }
          },
        },
      ]);
    } catch (err: any) {
      setIsSaving(false);
      const msg = err?.message || 'Failed to create client. Client with this phone number already exists.';
      setServerError(msg);
      if (msg.toLowerCase().includes('phone') || msg.toLowerCase().includes('already exists')) {
        setPhoneError('Client with this phone number already exists.');
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header — Exact match with Web Software PageHeader (Title "New Client" + Back Button) */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>New Client</Text>
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <ArrowLeft size={15} color="#2D2D2A" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.formCard}>
          {/* Error Alert Banner */}
          {serverError ? (
            <View style={styles.errorAlert}>
              <AlertCircle size={16} color="#E11D48" />
              <Text style={styles.errorAlertText}>{serverError}</Text>
            </View>
          ) : null}

          {/* Field 1: Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              value={name}
              onChangeText={(val) => {
                setName(val);
                setServerError('');
              }}
              placeholder="Client name"
              placeholderTextColor="#A8A29E"
              style={styles.textInput}
            />
          </View>

          {/* Field 2: Phone / WhatsApp (Exact match with Web PhoneInputField) */}
          <View style={styles.fieldGroup}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>Phone / WhatsApp</Text>
              {phoneMode === 'other' && (
                <TouchableOpacity
                  onPress={() => handlePhoneModeSelect('+237')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.switchModeText}>🇨🇲 Switch to Cameroon (+237)</Text>
                </TouchableOpacity>
              )}
            </View>

            <View
              style={[
                styles.phoneInputContainer,
                phoneError
                  ? styles.inputBorderError
                  : phoneValidation.isValid
                  ? styles.inputBorderSuccess
                  : styles.inputBorderNormal,
              ]}
            >
              {/* Country selector button */}
              <TouchableOpacity
                onPress={() => setPickerTarget('phone_mode')}
                style={styles.countryCodeBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.countryCodeText}>
                  {phoneMode === '+237' ? 'CM +237' : '🌐 Other'}
                </Text>
                <ChevronDown size={13} color="#7D7871" />
              </TouchableOpacity>

              {/* Phone text input */}
              <TextInput
                value={phone}
                onChangeText={handlePhoneChange}
                placeholder={phoneMode === '+237' ? '+237 6XX XX XX XX' : '+ country code & number'}
                placeholderTextColor="#A8A29E"
                keyboardType="phone-pad"
                style={styles.phoneTextInput}
              />

              {/* Digit counter for Cameroon */}
              {phoneMode === '+237' && (
                <View style={styles.digitCounterWrap}>
                  <Text
                    style={[
                      styles.digitCounterText,
                      cameroonDigits === 9
                        ? { color: '#059669', fontWeight: '800' }
                        : cameroonDigits > 9
                        ? { color: '#E11D48', fontWeight: '800' }
                        : { color: '#7D7871' },
                    ]}
                  >
                    {cameroonDigits}/9
                  </Text>
                </View>
              )}
            </View>

            {/* Validation / Helper text below input */}
            <View style={styles.helperRow}>
              {phone.trim() !== '' && phone.trim() !== '+237' ? (
                phoneValidation.isValid ? (
                  <View style={styles.validationMessageRow}>
                    <CheckCircle size={12} color="#059669" />
                    <Text style={styles.validationSuccessText}>{phoneValidation.message}</Text>
                  </View>
                ) : (
                  <View style={styles.validationMessageRow}>
                    <AlertCircle size={12} color="#D97706" />
                    <Text style={styles.validationErrorText}>{phoneError || phoneValidation.message}</Text>
                  </View>
                )
              ) : (
                <Text style={styles.helperText}>
                  {phoneMode === '+237'
                    ? 'Cameroon numbers require 9 digits (starts with 6 or 2)'
                    : 'Include full international number with + and country code'}
                </Text>
              )}
            </View>
          </View>

          {/* Field 3: Quartier */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Quartier</Text>
            <TextInput
              value={quartier}
              onChangeText={(val) => {
                setQuartier(val);
                setServerError('');
              }}
              placeholder="Neighborhood"
              placeholderTextColor="#A8A29E"
              style={styles.textInput}
            />
          </View>

          {/* Field 4: Birthday Date (CelebrationDateInput) */}
          <View style={styles.fieldGroup}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>Birthday Date</Text>
              <Text style={styles.fieldHint}>Year is optional</Text>
            </View>

            <View style={styles.celebrationRow}>
              {/* Day Selector */}
              <TouchableOpacity
                onPress={() => setPickerTarget('birthday_day')}
                style={styles.celebrationBtn}
                activeOpacity={0.8}
              >
                <Text style={[styles.celebrationBtnText, !bDay && styles.placeholderText]}>
                  {bDay ? `Day ${parseInt(bDay, 10)}` : 'Day'}
                </Text>
                <ChevronDown size={14} color="#7D7871" />
              </TouchableOpacity>

              {/* Month Selector */}
              <TouchableOpacity
                onPress={() => setPickerTarget('birthday_month')}
                style={styles.celebrationBtn}
                activeOpacity={0.8}
              >
                <Text style={[styles.celebrationBtnText, !bMonth && styles.placeholderText]}>
                  {bMonth ? MONTHS.find((m) => m.value === bMonth)?.name : 'Month'}
                </Text>
                <ChevronDown size={14} color="#7D7871" />
              </TouchableOpacity>
            </View>

            {/* Optional Year Input */}
            {showBYear && (
              <TextInput
                value={bYear}
                onChangeText={setBYear}
                placeholder="Birth Year (Optional, e.g. 1995)"
                placeholderTextColor="#A8A29E"
                keyboardType="numeric"
                style={[styles.textInput, { marginTop: 8 }]}
                maxLength={4}
              />
            )}

            {/* Birthday Footer */}
            <View style={styles.celebrationFooterRow}>
              {bDay && bMonth ? (
                <Text style={styles.celebrationSummaryText}>
                  ✓ {parseInt(bDay, 10)} {MONTHS.find((m) => m.value === bMonth)?.name} {bYear ? bYear : ''}
                </Text>
              ) : (
                <Text style={styles.helperText}>No year needed — pick Day & Month</Text>
              )}

              <View style={styles.celebrationActionRow}>
                {!showBYear && (
                  <TouchableOpacity onPress={() => setShowBYear(true)}>
                    <Text style={styles.toggleYearText}>+ Year</Text>
                  </TouchableOpacity>
                )}
                {(bDay || bMonth || bYear) && (
                  <TouchableOpacity
                    onPress={() => {
                      setBDay('');
                      setBMonth('');
                      setBYear('');
                      setShowBYear(false);
                    }}
                  >
                    <Text style={styles.clearDateText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Field 5: Anniversary Date (Optional) */}
          <View style={styles.fieldGroup}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>Anniversary Date (Optional)</Text>
              <Text style={styles.fieldHint}>Year is optional</Text>
            </View>

            <View style={styles.celebrationRow}>
              {/* Day Selector */}
              <TouchableOpacity
                onPress={() => setPickerTarget('anniversary_day')}
                style={styles.celebrationBtn}
                activeOpacity={0.8}
              >
                <Text style={[styles.celebrationBtnText, !aDay && styles.placeholderText]}>
                  {aDay ? `Day ${parseInt(aDay, 10)}` : 'Day'}
                </Text>
                <ChevronDown size={14} color="#7D7871" />
              </TouchableOpacity>

              {/* Month Selector */}
              <TouchableOpacity
                onPress={() => setPickerTarget('anniversary_month')}
                style={styles.celebrationBtn}
                activeOpacity={0.8}
              >
                <Text style={[styles.celebrationBtnText, !aMonth && styles.placeholderText]}>
                  {aMonth ? MONTHS.find((m) => m.value === aMonth)?.name : 'Month'}
                </Text>
                <ChevronDown size={14} color="#7D7871" />
              </TouchableOpacity>
            </View>

            {/* Optional Year Input */}
            {showAYear && (
              <TextInput
                value={aYear}
                onChangeText={setAYear}
                placeholder="Anniversary Year (Optional, e.g. 2020)"
                placeholderTextColor="#A8A29E"
                keyboardType="numeric"
                style={[styles.textInput, { marginTop: 8 }]}
                maxLength={4}
              />
            )}

            {/* Anniversary Footer */}
            <View style={styles.celebrationFooterRow}>
              {aDay && aMonth ? (
                <Text style={styles.celebrationSummaryText}>
                  ✓ {parseInt(aDay, 10)} {MONTHS.find((m) => m.value === aMonth)?.name} {aYear ? aYear : ''}
                </Text>
              ) : (
                <Text style={styles.helperText}>No year needed — pick Day & Month</Text>
              )}

              <View style={styles.celebrationActionRow}>
                {!showAYear && (
                  <TouchableOpacity onPress={() => setShowAYear(true)}>
                    <Text style={styles.toggleYearText}>+ Year</Text>
                  </TouchableOpacity>
                )}
                {(aDay || aMonth || aYear) && (
                  <TouchableOpacity
                    onPress={() => {
                      setADay('');
                      setAMonth('');
                      setAYear('');
                      setShowAYear(false);
                    }}
                  >
                    <Text style={styles.clearDateText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Field 6: Referral Attribution Section */}
          {isManager ? (
            <View style={styles.managerReferralBox}>
              <Text style={styles.managerReferralTitle}>REFERRED BY STAFF (OPTIONAL)</Text>
              <TouchableOpacity
                onPress={() => setPickerTarget('staff')}
                style={styles.staffSelectBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.staffSelectBtnText}>
                  {referredByStaffId
                    ? eligibleStaff.find((s: any) => String(s.id) === String(referredByStaffId))?.name || 'Staff'
                    : 'Direct / Walk-In (No Staff Referral)'}
                </Text>
                <ChevronDown size={15} color="#7D7871" />
              </TouchableOpacity>
              <Text style={styles.managerReferralHint}>
                Select the active staff member who introduced this client, or leave as Direct Walk-In.
              </Text>
            </View>
          ) : (
            <View style={styles.attributionCard}>
              <UserPlus size={16} color="#5B6E58" />
              <Text style={styles.attributionText}>
                This client will automatically be attributed to your account (
                <Text style={{ fontWeight: '800', color: '#2D2D2A' }}>{user?.name || 'You'}</Text>) as an introduced
                client.
              </Text>
            </View>
          )}

          {/* Action Buttons: Cancel + Save Client */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              onPress={onBack}
              style={styles.cancelBtn}
              activeOpacity={0.7}
              disabled={isSaving}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              style={[
                styles.saveBtn,
                (!name.trim() || !phone.trim() || isSaving) && styles.saveBtnDisabled,
              ]}
              activeOpacity={0.8}
              disabled={!name.trim() || !phone.trim() || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Save Client</Text>
              )}
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>

      {/* ========================================================================= */}
      {/* PICKER MODALS (Phone Mode, Day, Month, Staff) */}
      {/* ========================================================================= */}
      {/* 1. Phone Mode Selector Modal */}
      <Modal visible={pickerTarget === 'phone_mode'} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPickerTarget(null)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Phone Format</Text>
              <TouchableOpacity onPress={() => setPickerTarget(null)}>
                <X size={18} color="#2D2D2A" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => handlePhoneModeSelect('+237')}
              style={[styles.modalItem, phoneMode === '+237' && styles.modalItemActive]}
            >
              <Text style={styles.modalItemText}>🇨🇲 Cameroon (+237)</Text>
              {phoneMode === '+237' && <CheckCircle size={16} color="#5B6E58" />}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handlePhoneModeSelect('other')}
              style={[styles.modalItem, phoneMode === 'other' && styles.modalItemActive]}
            >
              <Text style={styles.modalItemText}>🌐 Other (+) International</Text>
              {phoneMode === 'other' && <CheckCircle size={16} color="#5B6E58" />}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 2. Day Picker Modal */}
      <Modal
        visible={pickerTarget === 'birthday_day' || pickerTarget === 'anniversary_day'}
        transparent
        animationType="fade"
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPickerTarget(null)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Day</Text>
              <TouchableOpacity onPress={() => setPickerTarget(null)}>
                <X size={18} color="#2D2D2A" />
              </TouchableOpacity>
            </View>

            <View style={styles.daysGrid}>
              {DAYS.map((d) => {
                const currentDayVal = pickerTarget === 'birthday_day' ? bDay : aDay;
                const isSelected = currentDayVal === d;

                return (
                  <TouchableOpacity
                    key={d}
                    onPress={() => {
                      if (pickerTarget === 'birthday_day') {
                        setBDay(d);
                      } else {
                        setADay(d);
                      }
                      setPickerTarget(null);
                    }}
                    style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dayCellText, isSelected && styles.dayCellTextSelected]}>
                      {parseInt(d, 10)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 3. Month Picker Modal */}
      <Modal
        visible={pickerTarget === 'birthday_month' || pickerTarget === 'anniversary_month'}
        transparent
        animationType="fade"
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPickerTarget(null)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Month</Text>
              <TouchableOpacity onPress={() => setPickerTarget(null)}>
                <X size={18} color="#2D2D2A" />
              </TouchableOpacity>
            </View>

            <View style={styles.monthsGrid}>
              {MONTHS.map((m) => {
                const currentMonthVal = pickerTarget === 'birthday_month' ? bMonth : aMonth;
                const isSelected = currentMonthVal === m.value;

                return (
                  <TouchableOpacity
                    key={m.value}
                    onPress={() => {
                      if (pickerTarget === 'birthday_month') {
                        setBMonth(m.value);
                      } else {
                        setAMonth(m.value);
                      }
                      setPickerTarget(null);
                    }}
                    style={[styles.monthCell, isSelected && styles.monthCellSelected]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.monthCellText, isSelected && styles.monthCellTextSelected]}>
                      {m.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 4. Staff Referral Picker Modal (for Manager) */}
      <Modal visible={pickerTarget === 'staff'} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPickerTarget(null)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Referred By Staff</Text>
              <TouchableOpacity onPress={() => setPickerTarget(null)}>
                <X size={18} color="#2D2D2A" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              <TouchableOpacity
                onPress={() => {
                  setReferredByStaffId('');
                  setPickerTarget(null);
                }}
                style={[styles.modalItem, !referredByStaffId && styles.modalItemActive]}
              >
                <Text style={styles.modalItemText}>Direct / Walk-In (No Staff Referral)</Text>
                {!referredByStaffId && <CheckCircle size={16} color="#5B6E58" />}
              </TouchableOpacity>

              {eligibleStaff.map((staff: any) => {
                const isSelected = String(staff.id) === String(referredByStaffId);
                return (
                  <TouchableOpacity
                    key={staff.id}
                    onPress={() => {
                      setReferredByStaffId(String(staff.id));
                      setPickerTarget(null);
                    }}
                    style={[styles.modalItem, isSelected && styles.modalItemActive]}
                  >
                    <View>
                      <Text style={styles.modalItemText}>{staff.name}</Text>
                      <Text style={styles.modalItemSub}>
                        {(staff.specialties || []).join(', ') ||
                          (staff.role === 'reception' ? 'Receptionist' : 'Technician')}
                      </Text>
                    </View>
                    {isSelected && <CheckCircle size={16} color="#5B6E58" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2D2D2A',
    letterSpacing: -0.3,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    padding: 16,
    gap: 16,
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 10,
    padding: 12,
  },
  errorAlertText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#BE123C',
    flex: 1,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7D7871',
  },
  fieldHint: {
    fontSize: 11,
    color: '#5B6E58',
    fontWeight: '600',
  },
  switchModeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5B6E58',
  },
  textInput: {
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#2D2D2A',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  inputBorderNormal: {
    borderColor: '#E8E2D9',
  },
  inputBorderSuccess: {
    borderColor: '#10B981',
  },
  inputBorderError: {
    borderColor: '#F59E0B',
  },
  countryCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F7F5F0',
    borderRightWidth: 1,
    borderRightColor: '#E8E2D9',
    paddingHorizontal: 10,
    height: '100%',
  },
  countryCodeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  phoneTextInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#2D2D2A',
    fontWeight: '600',
  },
  digitCounterWrap: {
    paddingRight: 12,
  },
  digitCounterText: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  helperRow: {
    minHeight: 18,
  },
  helperText: {
    fontSize: 11,
    color: '#A8A29E',
  },
  validationMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  validationSuccessText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },
  validationErrorText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '600',
  },
  celebrationRow: {
    flexDirection: 'row',
    gap: 10,
  },
  celebrationBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  celebrationBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  placeholderText: {
    color: '#A8A29E',
    fontWeight: '400',
  },
  celebrationFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  celebrationSummaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5B6E58',
  },
  celebrationActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleYearText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7D7871',
    textDecorationLine: 'underline',
  },
  clearDateText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
    textDecorationLine: 'underline',
  },
  managerReferralBox: {
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  managerReferralTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7D7871',
    letterSpacing: 0.5,
  },
  staffSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  staffSelectBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  managerReferralHint: {
    fontSize: 10,
    color: '#7D7871',
  },
  attributionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EBF3EC',
    borderWidth: 1,
    borderColor: '#C7DEC9',
    borderRadius: 12,
    padding: 12,
  },
  attributionText: {
    fontSize: 12,
    color: '#2D2D2A',
    flex: 1,
    lineHeight: 17,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7D7871',
  },
  saveBtn: {
    flex: 2,
    height: 46,
    backgroundColor: '#5B6E58',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F0EAE1',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2D2D2A',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FAF8F5',
  },
  modalItemActive: {
    backgroundColor: '#EBF3EC',
  },
  modalItemText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  modalItemSub: {
    fontSize: 11,
    color: '#7D7871',
    marginTop: 2,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  dayCell: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: {
    backgroundColor: '#5B6E58',
    borderColor: '#5B6E58',
  },
  dayCellText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  dayCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  monthCell: {
    width: '31%',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCellSelected: {
    backgroundColor: '#5B6E58',
    borderColor: '#5B6E58',
  },
  monthCellText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  monthCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});

export default AddClientScreen;
