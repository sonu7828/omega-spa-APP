import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import {
  Clock,
  LogIn,
  LogOut,
  Camera,
  CheckCircle,
  AlertCircle,
  Timer,
  Calendar,
  History,
  Video,
  RotateCcw,
  X,
  Coffee,
  Play,
  User,
  Check,
} from 'lucide-react-native';
import THEME from '../constants/theme';
import Header from '../components/Header';
import CameraModal from '../components/CameraModal';
import { formatDate, formatTime } from '../utils/date';
import { useAttendance, AttendanceRecord } from '../context/AttendanceContext';
import { useAuth } from '../context/AuthContext';

interface AttendanceScreenProps {
  onOpenMenu?: () => void;
}

export const AttendanceScreen: React.FC<AttendanceScreenProps> = ({ onOpenMenu }) => {
  const { user } = useAuth();
  const {
    todayRecord,
    allRecords,
    loading,
    refreshAttendance,
    clockIn,
    startBreak,
    endBreak,
    clockOut,
  } = useAttendance();

  // Active Tab: 'today' | 'history' (1-to-1 match with Web Software Attendance.jsx)
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');

  // Camera & Verification Photo State
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraMode, setCameraMode] = useState<'CLOCK_IN' | 'BREAK_START' | 'BREAK_END' | 'CLOCK_OUT'>('CLOCK_IN');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [photoConfirmed, setPhotoConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Photo Viewer & Manual Details Modals
  const [viewingPhoto, setViewingPhoto] = useState<{
    photo: string;
    title: string;
    subtitle?: string;
  } | null>(null);
  const [selectedManualDetails, setSelectedManualDetails] = useState<AttendanceRecord | null>(null);

  // Live Break Timer
  const [elapsedBreakSeconds, setElapsedBreakSeconds] = useState<number>(0);

  const status = todayRecord?.status || 'NOT_WORKING';
  const isWorking = status === 'WORKING' || status === 'ON_BREAK';
  const isOnBreak = status === 'ON_BREAK';
  const isCompleted = status === 'CLOCKED_OUT' || Boolean(todayRecord?.clockOutTime);
  const isNotStarted = !isWorking && !isCompleted;

  // Active break tracking
  useEffect(() => {
    let interval: any = null;
    if (isOnBreak && todayRecord?.breaks?.length) {
      const activeBreak = todayRecord.breaks[todayRecord.breaks.length - 1];
      const startTime = new Date(activeBreak.startTime).getTime();

      interval = setInterval(() => {
        const now = Date.now();
        setElapsedBreakSeconds(Math.max(0, Math.floor((now - startTime) / 1000)));
      }, 1000);
    } else {
      setElapsedBreakSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOnBreak, todayRecord]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${String(secs).padStart(2, '0')}s`;
  };

  // Status configuration mapping (1-to-1 with Web Software)
  const statusDisplay = useMemo(() => {
    if (isCompleted) {
      return {
        label: 'Completed',
        color: '#4F6748',
        bg: '#DCE7D7',
        border: '#B7CEB3',
        dot: '#4F6748',
      };
    }
    if (isOnBreak) {
      return {
        label: 'On Break',
        color: '#B45309',
        bg: '#FEF3C7',
        border: '#FDE68A',
        dot: '#D97706',
      };
    }
    if (isWorking) {
      return {
        label: 'Working',
        color: '#15803D',
        bg: '#DCFCE7',
        border: '#A7F3D0',
        dot: '#16A34A',
      };
    }
    return {
      label: 'Not Started',
      color: '#737373',
      bg: '#F3F0EC',
      border: '#E5E7EB',
      dot: '#9CA3AF',
    };
  }, [isCompleted, isOnBreak, isWorking]);

  // Open Camera for Action
  const handleOpenCamera = (mode: 'CLOCK_IN' | 'BREAK_START' | 'BREAK_END' | 'CLOCK_OUT') => {
    setCameraMode(mode);
    setCameraVisible(true);
  };

  // Photo Captured from CameraModal
  const handlePhotoCaptured = async (uri: string) => {
    setCameraVisible(false);

    if (cameraMode === 'BREAK_START') {
      setIsSubmitting(true);
      try {
        await startBreak(uri);
        Alert.alert('Break Started ☕', 'Your break departure photo has been verified. Enjoy your break!');
      } catch (e: any) {
        Alert.alert('Break Error', e?.message || 'Could not start break.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (cameraMode === 'BREAK_END') {
      setIsSubmitting(true);
      try {
        await endBreak(uri);
        Alert.alert('Break Ended ✓', 'Your return photo has been verified. Welcome back to your shift!');
      } catch (e: any) {
        Alert.alert('Break Error', e?.message || 'Could not end break.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // For CLOCK_IN or CLOCK_OUT: Confirm photo preview in the station card
    setCapturedPhoto(uri);
    setPhotoConfirmed(true);
  };

  // Retake Photo
  const handleRetakePhoto = () => {
    setCapturedPhoto(null);
    setPhotoConfirmed(false);
    handleOpenCamera(isNotStarted ? 'CLOCK_IN' : 'CLOCK_OUT');
  };

  // Execute Clock In
  const handleClockIn = async () => {
    if (!capturedPhoto || !photoConfirmed) {
      handleOpenCamera('CLOCK_IN');
      return;
    }
    setIsSubmitting(true);
    try {
      await clockIn(capturedPhoto);
      setCapturedPhoto(null);
      setPhotoConfirmed(false);
      Alert.alert('Clocked In Successfully! 🌿', 'Your live verification photo has been verified and shift is active.');
    } catch (e: any) {
      Alert.alert('Clock In Error', e?.message || 'Could not complete clock in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Execute Clock Out
  const handleClockOut = async () => {
    if (isOnBreak) {
      // Automatically end active break before clocking out
      await endBreak(capturedPhoto || '');
    }

    if (!capturedPhoto || !photoConfirmed) {
      handleOpenCamera('CLOCK_OUT');
      return;
    }

    setIsSubmitting(true);
    try {
      await clockOut(capturedPhoto);
      setCapturedPhoto(null);
      setPhotoConfirmed(false);
      Alert.alert('Clocked Out Successfully!', 'Shift finished for today. Both Clock In & Departure photos are verified.');
    } catch (e: any) {
      Alert.alert('Clock Out Error', e?.message || 'Could not complete clock out.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const todayDateFormatted = formatDate(new Date(), 'EEE, dd MMM yyyy');

  return (
    <View style={styles.container}>
      {/* Header — 1-to-1 Web Software Parity */}
      <Header
        title="My Attendance"
        subtitle={`Staff: ${user?.name || 'Employee'}`}
        onOpenMenu={onOpenMenu}
      />

      {/* Tabs Navigation Switcher */}
      <View style={styles.tabSwitcherContainer}>
        <View style={styles.tabSwitcherBox}>
          <TouchableOpacity
            onPress={() => setActiveTab('today')}
            style={[styles.tabButton, activeTab === 'today' && styles.tabButtonActive]}
            activeOpacity={0.7}
          >
            <Clock
              size={14}
              color={activeTab === 'today' ? '#2D2D2A' : '#737373'}
              strokeWidth={activeTab === 'today' ? 2.2 : 1.6}
            />
            <Text style={[styles.tabButtonText, activeTab === 'today' && styles.tabButtonTextActive]}>
              Today's Attendance
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('history')}
            style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
            activeOpacity={0.7}
          >
            <History
              size={14}
              color={activeTab === 'history' ? '#2D2D2A' : '#737373'}
              strokeWidth={activeTab === 'history' ? 2.2 : 1.6}
            />
            <Text style={[styles.tabButtonText, activeTab === 'history' && styles.tabButtonTextActive]}>
              Attendance History
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refreshAttendance}
            tintColor={THEME.colors.primaryDark}
          />
        }
      >
        {/* ========================================================================= */}
        {/* TAB 1: TODAY'S ATTENDANCE */}
        {/* ========================================================================= */}
        {activeTab === 'today' && (
          <View style={styles.tabContent}>
            {/* CARD 1: Today's Shift */}
            <View style={styles.card}>
              {/* Header Row */}
              <View style={styles.shiftHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Today's Shift</Text>
                  <View style={styles.dateRow}>
                    <Calendar size={12} color="#737373" />
                    <Text style={styles.dateText}>{todayDateFormatted}</Text>
                    <View style={styles.timezoneBadge}>
                      <Text style={styles.timezoneBadgeText}>Cameroon (UTC+1)</Text>
                    </View>
                  </View>
                </View>

                {/* Status Badge */}
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: statusDisplay.bg,
                      borderColor: statusDisplay.border,
                    },
                  ]}
                >
                  <View style={[styles.statusDot, { backgroundColor: statusDisplay.dot }]} />
                  <Text style={[styles.statusPillText, { color: statusDisplay.color }]}>
                    {statusDisplay.label}
                  </Text>
                </View>
              </View>

              {/* Employee Info Profile Row */}
              <View style={styles.employeeProfileRow}>
                <View style={styles.employeeAvatarCircle}>
                  <Text style={styles.employeeAvatarText}>
                    {(user?.name || '?')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={styles.employeeTextCol}>
                  <Text style={styles.employeeNameText} numberOfLines={1}>
                    {user?.name || 'Employee'}
                  </Text>
                  <Text style={styles.employeeRoleText} numberOfLines={1}>
                    {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Staff'}
                  </Text>
                </View>
              </View>

              {/* 4 Stats Grid (Clock In, Clock Out, Breaks, Net Hours) */}
              <View style={styles.statsGrid}>
                {/* Clock In */}
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>CLOCK IN</Text>
                  <View style={styles.statValueRow}>
                    <LogIn size={13} color="#15803D" />
                    <Text style={styles.statValueText}>
                      {todayRecord?.clockInTime ? formatTime(todayRecord.clockInTime) : '—'}
                    </Text>
                  </View>
                </View>

                {/* Clock Out */}
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>CLOCK OUT</Text>
                  <View style={styles.statValueRow}>
                    <LogOut size={13} color="#DC2626" />
                    <Text style={styles.statValueText}>
                      {todayRecord?.clockOutTime ? formatTime(todayRecord.clockOutTime) : '—'}
                    </Text>
                  </View>
                </View>

                {/* Breaks */}
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>ON BREAK</Text>
                  <View style={styles.statValueRow}>
                    <Coffee size={13} color="#D97706" />
                    <Text style={[styles.statValueText, { color: '#B45309' }]}>
                      {todayRecord
                        ? `${todayRecord.breaks?.length || 0} (${todayRecord.totalBreakMinutes || 0}m)`
                        : '—'}
                    </Text>
                  </View>
                </View>

                {/* Net Hours */}
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>NET HOURS</Text>
                  <View style={styles.statValueRow}>
                    <Timer size={13} color="#4F6748" />
                    <Text style={[styles.statValueText, { color: '#4F6748' }]}>
                      {todayRecord?.workingHours
                        ? `${todayRecord.workingHours.toFixed(1)} hrs`
                        : isWorking
                        ? 'In Progress'
                        : '—'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Break Tracking Station (when working or on break) */}
              {isWorking && (
                <View style={[styles.breakStationBox, isOnBreak && styles.breakStationBoxActive]}>
                  <View style={styles.breakStationHeaderRow}>
                    <View style={styles.breakStationLeft}>
                      <View
                        style={[
                          styles.breakIconCircle,
                          isOnBreak ? styles.breakIconCircleActive : styles.breakIconCircleIdle,
                        ]}
                      >
                        <Coffee size={18} color="#D97706" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.breakStationTitle}>
                          {isOnBreak ? 'Currently On Break' : 'Attendance Break'}
                        </Text>
                        <Text style={styles.breakStationSubtitle}>
                          {isOnBreak
                            ? `Active break: ${formatTimer(elapsedBreakSeconds)}`
                            : 'Live photo required to go out & return'}
                        </Text>
                      </View>
                    </View>

                    {isOnBreak ? (
                      <TouchableOpacity
                        onPress={() => handleOpenCamera('BREAK_END')}
                        style={styles.endBreakBtn}
                        activeOpacity={0.8}
                      >
                        <Camera size={14} color="#FFFFFF" strokeWidth={2.2} />
                        <Text style={styles.breakBtnText}>End Break</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleOpenCamera('BREAK_START')}
                        style={styles.startBreakBtn}
                        activeOpacity={0.8}
                      >
                        <Camera size={14} color="#FFFFFF" strokeWidth={2.2} />
                        <Text style={styles.breakBtnText}>Start Break</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Breaks Breakdown Chips */}
                  {todayRecord?.breaks && todayRecord.breaks.length > 0 && (
                    <View style={styles.breaksListRow}>
                      <Text style={styles.breaksListLabel}>Breaks today:</Text>
                      {todayRecord.breaks.map((b, idx) => (
                        <TouchableOpacity
                          key={b.id || idx}
                          onPress={() => {
                            const p = b.endPhoto || b.startPhoto;
                            if (p) {
                              setViewingPhoto({
                                photo: p,
                                title: `Break #${idx + 1} (${b.durationMinutes}m)`,
                                subtitle: b.endPhoto ? 'Return Photo' : 'Departure Photo',
                              });
                            }
                          }}
                          style={styles.breakChip}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.breakChipIdx}>#{idx + 1}</Text>
                          <Text style={styles.breakChipDuration}>{b.durationMinutes}m</Text>
                          {(b.startPhoto || b.endPhoto) && (
                            <Camera size={10} color="#B45309" style={{ marginLeft: 2 }} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Verified Attendance Photos Thumbnails (if photos exist) */}
              {(todayRecord?.clockInPhoto || todayRecord?.clockOutPhoto) && (
                <View style={styles.verifiedPhotosSection}>
                  <Text style={styles.verifiedPhotosHeader}>VERIFIED ATTENDANCE PHOTOS</Text>
                  <View style={styles.verifiedPhotosRow}>
                    {todayRecord.clockInPhoto && (
                      <TouchableOpacity
                        onPress={() =>
                          setViewingPhoto({
                            photo: todayRecord.clockInPhoto!,
                            title: 'Clock In Verification Photo',
                            subtitle: `Clock In: ${formatTime(todayRecord.clockInTime) || 'Verified'}`,
                          })
                        }
                        style={styles.verifiedPhotoCard}
                        activeOpacity={0.8}
                      >
                        <Image
                          source={{ uri: todayRecord.clockInPhoto }}
                          style={styles.verifiedPhotoThumb}
                        />
                        <View style={styles.verifiedPhotoMeta}>
                          <Text style={styles.verifiedPhotoLabel}>
                            <CheckCircle size={10} color="#15803D" /> In Photo
                          </Text>
                          <Text style={styles.verifiedPhotoTime}>
                            {formatTime(todayRecord.clockInTime) || 'Verified'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}

                    {todayRecord.clockOutPhoto && (
                      <TouchableOpacity
                        onPress={() =>
                          setViewingPhoto({
                            photo: todayRecord.clockOutPhoto!,
                            title: 'Clock Out Verification Photo',
                            subtitle: `Clock Out: ${formatTime(todayRecord.clockOutTime) || 'Verified'}`,
                          })
                        }
                        style={styles.verifiedPhotoCard}
                        activeOpacity={0.8}
                      >
                        <Image
                          source={{ uri: todayRecord.clockOutPhoto }}
                          style={styles.verifiedPhotoThumb}
                        />
                        <View style={styles.verifiedPhotoMeta}>
                          <Text style={styles.verifiedPhotoLabel}>
                            <CheckCircle size={10} color="#15803D" /> Out Photo
                          </Text>
                          <Text style={styles.verifiedPhotoTime}>
                            {formatTime(todayRecord.clockOutTime) || 'Verified'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>

            {/* CARD 2: Camera & Action Station */}
            <View style={styles.card}>
              {/* Card Header Title */}
              <View style={styles.stationHeaderRow}>
                <View style={styles.stationHeaderLeft}>
                  <View
                    style={[
                      styles.stationIconBox,
                      isWorking ? styles.stationIconBoxWorking : styles.stationIconBoxDefault,
                    ]}
                  >
                    {isCompleted ? (
                      <CheckCircle size={16} color="#4F6748" />
                    ) : (
                      <Camera size={16} color={isWorking ? '#B91C1C' : '#4F6748'} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {isNotStarted && 'Clock In Verification'}
                      {isWorking && 'Clock Out Verification'}
                      {isCompleted && 'Shift Completed'}
                    </Text>
                    <Text style={styles.stationSubtitle}>
                      {isNotStarted &&
                        (photoConfirmed
                          ? 'Photo confirmed — Ready to Clock In'
                          : 'Live photo required before Clock In')}
                      {isWorking &&
                        (photoConfirmed
                          ? 'Departure photo confirmed — Ready to Clock Out'
                          : 'Live photo required before Clock Out')}
                      {isCompleted && "Today's attendance is completed and saved."}
                    </Text>
                  </View>
                </View>

                {photoConfirmed && !isCompleted && (
                  <View style={styles.photoReadyBadge}>
                    <CheckCircle size={11} color="#15803D" />
                    <Text style={styles.photoReadyBadgeText}>Photo Ready</Text>
                  </View>
                )}
              </View>

              {/* Station Body */}
              {!isCompleted && (
                <View style={styles.stationBody}>
                  {/* Mode 1: Initial Prompt (no photo taken yet) */}
                  {!capturedPhoto && (
                    <View style={styles.cameraPromptBox}>
                      <View style={styles.cameraPromptCircle}>
                        <Camera size={24} color="#4F6748" />
                      </View>
                      <Text style={styles.cameraPromptTitle}>
                        {isNotStarted
                          ? 'Take Verification Photo to Clock In'
                          : 'Take Departure Photo to Clock Out'}
                      </Text>
                      <Text style={styles.cameraPromptDesc}>
                        Camera will take a photo for attendance verification
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleOpenCamera(isNotStarted ? 'CLOCK_IN' : 'CLOCK_OUT')}
                        style={styles.openCameraBtn}
                        activeOpacity={0.8}
                      >
                        <Video size={16} color="#FFFFFF" strokeWidth={2.2} />
                        <Text style={styles.openCameraBtnText}>
                          {isNotStarted
                            ? 'Open Camera & Take Photo'
                            : 'Open Camera for Departure Photo'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Mode 2: Photo Captured Preview */}
                  {capturedPhoto && (
                    <View style={styles.photoPreviewCard}>
                      <View style={styles.photoPreviewRow}>
                        <Image
                          source={{ uri: capturedPhoto }}
                          style={styles.previewThumb}
                          resizeMode="cover"
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.previewConfirmedTitle}>
                            <CheckCircle size={12} color="#15803D" /> Photo Verified
                          </Text>
                          <Text style={styles.previewConfirmedSubtitle}>
                            {isNotStarted ? 'Ready to Clock In' : 'Ready to Clock Out'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={handleRetakePhoto}
                          style={styles.retakePhotoBtn}
                          activeOpacity={0.7}
                        >
                          <RotateCcw size={13} color="#737373" />
                          <Text style={styles.retakePhotoBtnText}>Retake</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Mode 3: Shift Completed Celebration */}
              {isCompleted && (
                <View style={styles.completedStationBox}>
                  <View style={styles.completedStationIconCircle}>
                    <CheckCircle size={28} color="#4F6748" />
                  </View>
                  <Text style={styles.completedStationTitle}>Shift Finished for Today</Text>
                  <Text style={styles.completedStationDesc}>
                    Both Clock In & Departure photos verified and stored in database.
                  </Text>
                </View>
              )}

              {/* PRIMARY ACTION BUTTON */}
              <View style={styles.stationActionBottom}>
                {isNotStarted && (
                  <TouchableOpacity
                    onPress={handleClockIn}
                    disabled={isSubmitting}
                    style={[
                      styles.primaryActionBtn,
                      !photoConfirmed && styles.primaryActionBtnDisabled,
                    ]}
                    activeOpacity={0.8}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <LogIn size={16} color={photoConfirmed ? '#FFFFFF' : '#737373'} strokeWidth={2.2} />
                    )}
                    <Text
                      style={[
                        styles.primaryActionBtnText,
                        !photoConfirmed && styles.primaryActionBtnTextDisabled,
                      ]}
                    >
                      {isSubmitting
                        ? 'Clocking In...'
                        : photoConfirmed
                        ? 'Clock In'
                        : 'Take Photo to Clock In'}
                    </Text>
                  </TouchableOpacity>
                )}

                {isWorking && (
                  <TouchableOpacity
                    onPress={handleClockOut}
                    disabled={isSubmitting}
                    style={[styles.clockOutActionBtn, isSubmitting && { opacity: 0.7 }]}
                    activeOpacity={0.8}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <LogOut size={16} color="#FFFFFF" strokeWidth={2.2} />
                    )}
                    <Text style={styles.clockOutActionBtnText}>
                      {isSubmitting
                        ? 'Clocking Out...'
                        : photoConfirmed
                        ? 'Clock Out'
                        : 'Take Photo to Clock Out'}
                    </Text>
                  </TouchableOpacity>
                )}

                {isCompleted && (
                  <View style={styles.dayCompleteBox}>
                    <CheckCircle size={16} color="#4F6748" strokeWidth={2.2} />
                    <Text style={styles.dayCompleteBoxText}>Day Complete</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ATTENDANCE HISTORY (1-to-1 Web Software Parity) */}
        {/* ========================================================================= */}
        {activeTab === 'history' && (
          <View style={styles.tabContent}>
            <View style={styles.card}>
              <View style={styles.historyHeaderRow}>
                <History size={16} color="#2D2D2A" />
                <Text style={styles.cardTitle}>Attendance History</Text>
              </View>

              {allRecords.length === 0 ? (
                <View style={styles.emptyHistoryBox}>
                  <Clock size={36} color="#D1D5DB" />
                  <Text style={styles.emptyHistoryText}>No attendance records yet.</Text>
                </View>
              ) : (
                <View style={styles.historyList}>
                  {allRecords.map((rec) => {
                    const recStatus = rec.status || (rec.clockOutTime ? 'CLOCKED_OUT' : 'WORKING');
                    const isRecDone = recStatus === 'CLOCKED_OUT';

                    return (
                      <View key={rec.id} style={styles.historyCardItem}>
                        {/* History Card Header */}
                        <View style={styles.historyCardTopRow}>
                          <Text style={styles.historyCardDate}>
                            {formatDate(rec.date, 'EEE, dd MMM yyyy')}
                          </Text>
                          <View
                            style={[
                              styles.statusPill,
                              {
                                backgroundColor: isRecDone ? '#DCE7D7' : '#DCFCE7',
                                borderColor: isRecDone ? '#B7CEB3' : '#A7F3D0',
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.statusDot,
                                { backgroundColor: isRecDone ? '#4F6748' : '#16A34A' },
                              ]}
                            />
                            <Text
                              style={[
                                styles.statusPillText,
                                { color: isRecDone ? '#4F6748' : '#15803D' },
                              ]}
                            >
                              {isRecDone ? 'Completed' : 'Working'}
                            </Text>
                          </View>
                        </View>

                        {/* History Stats Grid (In, Out, Breaks, Net Hours) */}
                        <View style={styles.historyStatsGrid}>
                          <View style={styles.historyStatCol}>
                            <Text style={styles.historyStatLabel}>In</Text>
                            <Text style={styles.historyStatVal}>
                              {rec.clockInTime ? formatTime(rec.clockInTime) : '—'}
                            </Text>
                          </View>
                          <View style={styles.historyStatCol}>
                            <Text style={styles.historyStatLabel}>Out</Text>
                            <Text style={styles.historyStatVal}>
                              {rec.clockOutTime ? formatTime(rec.clockOutTime) : '—'}
                            </Text>
                          </View>
                          <View style={styles.historyStatCol}>
                            <Text style={styles.historyStatLabel}>Breaks</Text>
                            <Text style={[styles.historyStatVal, { color: '#B45309' }]}>
                              {rec.totalBreakMinutes || 0}m
                            </Text>
                          </View>
                          <View style={styles.historyStatCol}>
                            <Text style={styles.historyStatLabel}>Net Hours</Text>
                            <Text style={[styles.historyStatVal, { color: '#4F6748' }]}>
                              {rec.workingHours ? `${rec.workingHours.toFixed(1)} hrs` : '—'}
                            </Text>
                          </View>
                        </View>

                        {/* Manual Entry Notice */}
                        {rec.isManualEntry && (
                          <TouchableOpacity
                            onPress={() => setSelectedManualDetails(rec)}
                            style={styles.manualEntryNotice}
                            activeOpacity={0.7}
                          >
                            <AlertCircle size={12} color="#D97706" />
                            <Text style={styles.manualEntryNoticeText}>
                              Manual Entry by {rec.addedByManager || 'Manager'} · Details
                            </Text>
                          </TouchableOpacity>
                        )}

                        {/* Verified Photos Links */}
                        {(rec.clockInPhoto || rec.clockOutPhoto || (rec.breaks && rec.breaks.some(b => b.startPhoto || b.endPhoto))) && (
                          <View style={styles.historyPhotosRow}>
                            {rec.clockInPhoto && (
                              <TouchableOpacity
                                onPress={() =>
                                  setViewingPhoto({
                                    photo: rec.clockInPhoto!,
                                    title: 'Clock In Photo',
                                    subtitle: `${formatDate(rec.date, 'dd MMM yyyy')} · In: ${formatTime(rec.clockInTime) || '—'}`,
                                  })
                                }
                                style={styles.historyPhotoLinkBtn}
                                activeOpacity={0.7}
                              >
                                <LogIn size={11} color="#15803D" />
                                <Text style={styles.historyPhotoLinkText}>In Photo</Text>
                              </TouchableOpacity>
                            )}

                            {rec.clockOutPhoto && (
                              <TouchableOpacity
                                onPress={() =>
                                  setViewingPhoto({
                                    photo: rec.clockOutPhoto!,
                                    title: 'Clock Out Photo',
                                    subtitle: `${formatDate(rec.date, 'dd MMM yyyy')} · Out: ${formatTime(rec.clockOutTime) || '—'}`,
                                  })
                                }
                                style={styles.historyPhotoLinkBtn}
                                activeOpacity={0.7}
                              >
                                <LogOut size={11} color="#DC2626" />
                                <Text style={styles.historyPhotoLinkText}>Out Photo</Text>
                              </TouchableOpacity>
                            )}

                            {rec.breaks?.map((b, bIdx) => (
                              (b.startPhoto || b.endPhoto) ? (
                                <TouchableOpacity
                                  key={b.id || bIdx}
                                  onPress={() =>
                                    setViewingPhoto({
                                      photo: (b.endPhoto || b.startPhoto)!,
                                      title: `Break #${bIdx + 1} (${b.durationMinutes}m)`,
                                      subtitle: b.endPhoto ? 'Return Photo' : 'Departure Photo',
                                    })
                                  }
                                  style={styles.historyPhotoLinkBtn}
                                  activeOpacity={0.7}
                                >
                                  <Coffee size={11} color="#D97706" />
                                  <Text style={styles.historyPhotoLinkText}>Brk #{bIdx + 1}</Text>
                                </TouchableOpacity>
                              ) : null
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODAL 1: Live Selfie Camera Capture */}
      {/* ========================================================================= */}
      <CameraModal
        visible={cameraVisible}
        title={
          cameraMode === 'CLOCK_IN'
            ? 'Verify Clock In'
            : cameraMode === 'BREAK_START'
            ? 'Verify Start Break'
            : cameraMode === 'BREAK_END'
            ? 'Verify End Break'
            : 'Verify Clock Out'
        }
        facingDefault="front"
        allowGallery={false}
        onClose={() => setCameraVisible(false)}
        onCapture={handlePhotoCaptured}
      />

      {/* ========================================================================= */}
      {/* MODAL 2: Photo Viewer Modal */}
      {/* ========================================================================= */}
      <Modal visible={!!viewingPhoto} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.photoViewerCard}>
            <View style={styles.photoViewerHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.photoViewerTitle}>{viewingPhoto?.title}</Text>
                {viewingPhoto?.subtitle ? (
                  <Text style={styles.photoViewerSubtitle}>{viewingPhoto.subtitle}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => setViewingPhoto(null)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#737373" />
              </TouchableOpacity>
            </View>

            {viewingPhoto?.photo ? (
              <View style={styles.photoViewerBody}>
                <Image
                  source={{ uri: viewingPhoto.photo }}
                  style={styles.fullPreviewImage}
                  resizeMode="cover"
                />
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: Manual Attendance Details Modal */}
      {/* ========================================================================= */}
      <Modal visible={!!selectedManualDetails} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.manualDetailsCard}>
            <View style={styles.photoViewerHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.photoViewerTitle}>Manual Entry Details</Text>
                <Text style={styles.photoViewerSubtitle}>
                  {formatDate(selectedManualDetails?.date, 'EEE, dd MMM yyyy')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedManualDetails(null)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#737373" />
              </TouchableOpacity>
            </View>

            <View style={styles.manualDetailsBody}>
              <View style={styles.manualDetailRow}>
                <Text style={styles.manualDetailLabel}>Added by Manager:</Text>
                <Text style={styles.manualDetailVal}>
                  {selectedManualDetails?.addedByManager || 'Manager'}
                </Text>
              </View>

              {selectedManualDetails?.reason ? (
                <View style={[styles.manualDetailRow, { flexDirection: 'column', gap: 4 }]}>
                  <Text style={styles.manualDetailLabel}>Reason for Manual Entry:</Text>
                  <Text style={styles.manualReasonBox}>
                    "{selectedManualDetails.reason}"
                  </Text>
                </View>
              ) : null}

              <View style={styles.manualDetailRow}>
                <Text style={styles.manualDetailLabel}>Clock In / Out:</Text>
                <Text style={styles.manualDetailVal}>
                  {selectedManualDetails?.clockInTime ? formatTime(selectedManualDetails.clockInTime) : '—'} - {selectedManualDetails?.clockOutTime ? formatTime(selectedManualDetails.clockOutTime) : '—'}
                </Text>
              </View>
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
    backgroundColor: '#FAF7F2',
  },
  // Tab Switcher
  tabSwitcherContainer: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  tabSwitcherBox: {
    flexDirection: 'row',
    backgroundColor: '#F3EFE9',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(232, 226, 217, 0.8)',
    ...THEME.shadows.sm,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#737373',
  },
  tabButtonTextActive: {
    color: '#2D2D2A',
    fontWeight: '700',
  },
  mainScroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  tabContent: {
    gap: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    padding: 16,
    ...THEME.shadows.sm,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2D2D2A',
  },
  // Shift Header Row
  shiftHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE3',
    paddingBottom: 12,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  dateText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#737373',
  },
  timezoneBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.2)',
  },
  timezoneBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#15803D',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Employee Profile Row
  employeeProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FBF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  employeeAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E8F2E6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(79, 103, 72, 0.2)',
  },
  employeeAvatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4F6748',
  },
  employeeTextCol: {
    flex: 1,
  },
  employeeNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2D2D2A',
  },
  employeeRoleText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#737373',
    marginTop: 1,
  },
  // Stats 4-Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FBF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#737373',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statValueText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2D2D2A',
  },
  // Break Station Box
  breakStationBox: {
    backgroundColor: '#FBF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  breakStationBoxActive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  breakStationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  breakStationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  breakIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakIconCircleIdle: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  breakIconCircleActive: {
    backgroundColor: '#FDE68A',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  breakStationTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  breakStationSubtitle: {
    fontSize: 10,
    fontWeight: '500',
    color: '#737373',
    marginTop: 1,
  },
  startBreakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D97706',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  endBreakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  breakBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  breaksListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0EBE3',
  },
  breaksListLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#737373',
  },
  breakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  breakChipIdx: {
    fontSize: 9,
    color: '#737373',
  },
  breakChipDuration: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  // Verified Photos Section
  verifiedPhotosSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0EBE3',
  },
  verifiedPhotosHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#737373',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  verifiedPhotosRow: {
    flexDirection: 'row',
    gap: 8,
  },
  verifiedPhotoCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FBF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    padding: 6,
  },
  verifiedPhotoThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  verifiedPhotoMeta: {
    flex: 1,
  },
  verifiedPhotoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  verifiedPhotoTime: {
    fontSize: 10,
    color: '#737373',
    marginTop: 1,
  },
  // Station Card (Card 2)
  stationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE3',
  },
  stationHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  stationIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stationIconBoxDefault: {
    backgroundColor: '#E8F2E6',
  },
  stationIconBoxWorking: {
    backgroundColor: '#FEE2E2',
  },
  stationSubtitle: {
    fontSize: 10,
    fontWeight: '500',
    color: '#737373',
    marginTop: 1,
  },
  photoReadyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  photoReadyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  stationBody: {
    marginTop: 12,
  },
  cameraPromptBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    backgroundColor: '#FBF7F2',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraPromptCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F2E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cameraPromptTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
    textAlign: 'center',
  },
  cameraPromptDesc: {
    fontSize: 10,
    color: '#737373',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 12,
  },
  openCameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4F6748',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    ...THEME.shadows.sm,
  },
  openCameraBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  photoPreviewCard: {
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#FBF7F2',
    borderRadius: 12,
    padding: 10,
  },
  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previewThumb: {
    width: 54,
    height: 54,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  previewConfirmedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  previewConfirmedSubtitle: {
    fontSize: 10,
    color: '#737373',
    marginTop: 2,
  },
  retakePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  retakePhotoBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#737373',
  },
  completedStationBox: {
    backgroundColor: 'rgba(220, 231, 215, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(79, 103, 72, 0.2)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  completedStationIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DCE7D7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  completedStationTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2D2D2A',
  },
  completedStationDesc: {
    fontSize: 10,
    color: '#737373',
    textAlign: 'center',
    marginTop: 2,
  },
  stationActionBottom: {
    marginTop: 14,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4F6748',
    paddingVertical: 12,
    borderRadius: 12,
    ...THEME.shadows.sm,
  },
  primaryActionBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  primaryActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  primaryActionBtnTextDisabled: {
    color: '#9CA3AF',
  },
  clockOutActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#B91C1C',
    paddingVertical: 12,
    borderRadius: 12,
    ...THEME.shadows.sm,
  },
  clockOutActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dayCompleteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#DCE7D7',
    borderWidth: 1,
    borderColor: 'rgba(79, 103, 72, 0.2)',
    paddingVertical: 10,
    borderRadius: 10,
  },
  dayCompleteBoxText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F6748',
  },
  // TAB 2: History Styles
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE3',
  },
  emptyHistoryBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  emptyHistoryText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  historyList: {
    gap: 10,
  },
  historyCardItem: {
    backgroundColor: '#FBF7F2',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  historyCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyCardDate: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  historyStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  historyStatCol: {
    alignItems: 'center',
  },
  historyStatLabel: {
    fontSize: 9,
    color: '#737373',
    fontWeight: '600',
    marginBottom: 2,
  },
  historyStatVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  manualEntryNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  manualEntryNoticeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#B45309',
  },
  historyPhotosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E8E2D9',
  },
  historyPhotoLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  historyPhotoLinkText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4F6748',
  },
  // Modal Overlays
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  photoViewerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    ...THEME.shadows.md,
  },
  photoViewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  photoViewerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2D2D2A',
  },
  photoViewerSubtitle: {
    fontSize: 11,
    color: '#737373',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  photoViewerBody: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111827',
    aspectRatio: 1,
  },
  fullPreviewImage: {
    width: '100%',
    height: '100%',
  },
  // Manual Details Modal
  manualDetailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    maxWidth: 400,
    ...THEME.shadows.md,
  },
  manualDetailsBody: {
    gap: 10,
    marginTop: 4,
  },
  manualDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  manualDetailLabel: {
    fontSize: 11,
    color: '#737373',
    fontWeight: '600',
  },
  manualDetailVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  manualReasonBox: {
    fontSize: 11,
    color: '#B45309',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 8,
    fontStyle: 'italic',
  },
});

export default AttendanceScreen;

