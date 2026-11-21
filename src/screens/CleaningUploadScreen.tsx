/**
 * CleaningUploadScreen — 1-to-1 Match with Omega Spa POS Web Software
 * Matches frontend/src/pages/CleaningUpload.jsx & Web Screenshot:
 * - Header: Title "Cleaning Upload", Subtitle "Take live camera photos of cleaned areas as proof."
 * - Section 1: Live Camera Card
 *     - Header: "LIVE CAMERA" with [OFF] / [LIVE] pulsating badge + [Open Camera] / [Flip] / [Close Camera] buttons
 *     - Viewfinder:
 *         - When Closed: Soft cream box with camera icon, "Camera is Closed", "Click below to open device camera and take proof photos." + [Open Camera] button
 *         - When Active: Live CameraView with shutter flash + [Snap Photo (X/10)] action
 *     - Captured Photos Strip: "Captured Photos (X/10)" with [Clear all], thumbnails with #[X] tag & remove [X] button
 * - Section 2: Cleaning Details Card
 *     - Header: "CLEANING DETAILS"
 *     - Input: "Note / Cleaning Details" textarea ("Enter cleaning details / notes here...")
 *     - Helper: "Add any notes or details about the cleaning."
 *     - Action: [Submit Cleaning Entry (X Photos)] / "Uploading to Cloudinary..." / "Submitted Successfully!"
 * - Section 3: Your Recent Entries Card
 *     - Header: "YOUR RECENT ENTRIES (X)" on left, "Click to view" on right
 *     - List Items: Thumbnail with "+X" count badge, title ("General Cleaning"), [X P] badge, "18:02 — 5 Nov 2026", and eye icon [ 👁 ]
 *     - ZERO DELETE BUTTONS (Cleaners are not allowed to delete entries, matching web view!)
 * - Interactive Photo Gallery Modal:
 *     - Header: Title, photo count badge, cleaner name, timestamp, close [X]
 *     - Photo carousel with < Prev / Next > arrows and "1 / X" counter
 *     - Cleaner note at the bottom
 *     - NO delete button
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import {
  Camera,
  Layers,
  ChevronLeft,
  ChevronRight,
  Upload,
  Check,
  X,
  Eye,
  MessageSquare,
  Trash2,
  VideoOff,
  RefreshCw,
} from 'lucide-react-native';
import Header from '../components/Header';
import Card from '../components/Card';
import THEME from '../constants/theme';
import { useCleaning, CleaningRecord } from '../context/CleaningContext';
import { useAuth } from '../context/AuthContext';

interface CleaningUploadScreenProps {
  onOpenMenu?: () => void;
}

export const CleaningUploadScreen: React.FC<CleaningUploadScreenProps> = ({ onOpenMenu }) => {
  const { user } = useAuth();
  const { records, loading, refreshCleaningRecords, uploadCleaningTask } = useCleaning();

  // Camera & Photo State
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const [snapEffect, setSnapEffect] = useState<boolean>(false);
  const cameraRef = useRef<any>(null);

  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);

  // Gallery Modal State
  const [galleryModal, setGalleryModal] = useState<{
    open: boolean;
    entry: CleaningRecord | null;
    activeIdx: number;
  }>({
    open: false,
    entry: null,
    activeIdx: 0,
  });

  // Start live camera
  const handleOpenCamera = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access in your device settings to snap cleaning proof photos.'
        );
        return;
      }
    }
    setCameraActive(true);
  };

  const handleCloseCamera = () => {
    setCameraActive(false);
  };

  const toggleFacing = () => {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  // Snap photo from live camera
  const handleSnapPhoto = async () => {
    if (capturedPhotos.length >= 10) {
      Alert.alert('Maximum Limit', 'You can capture up to 10 photos per cleaning entry.');
      return;
    }

    if (cameraRef.current) {
      try {
        setSnapEffect(true);
        setTimeout(() => setSnapEffect(false), 200);

        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
          base64: true,
        });

        const imageUri = photo?.base64
          ? `data:image/jpeg;base64,${photo.base64}`
          : photo?.uri;

        if (imageUri) {
          setCapturedPhotos((prev) => [...prev, imageUri]);
        }
      } catch (err) {
        console.warn('Snap photo failed:', err);
      }
    }
  };

  // Remove individual photo from captured list
  const handleRemovePhoto = (index: number) => {
    setCapturedPhotos((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleClearAllPhotos = () => {
    setCapturedPhotos([]);
  };

  // Submit Cleaning Entry
  const handleSubmit = async () => {
    if (capturedPhotos.length === 0) {
      Alert.alert('No Photos', 'Please take at least 1 live photo as cleaning proof.');
      return;
    }

    try {
      setIsSubmitting(true);
      await uploadCleaningTask({
        area: 'General Cleaning',
        photoUris: capturedPhotos,
        notes: note.trim() || 'General Cleaning Proof',
      });

      setSubmitted(true);
      setCapturedPhotos([]);
      setNote('');
      setCameraActive(false);

      setTimeout(() => {
        setSubmitted(false);
      }, 3000);
    } catch (err: any) {
      Alert.alert('Upload Error', err?.message || 'Failed to submit cleaning entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to extract photos from record
  const getEntryPhotos = useCallback((entry: CleaningRecord | null): string[] => {
    if (!entry) return [];
    if (Array.isArray(entry.photos) && entry.photos.length > 0) {
      return entry.photos.filter(Boolean);
    }
    const fallback = [entry.photo, entry.afterPhoto, entry.beforePhoto].filter(Boolean) as string[];
    return Array.from(new Set(fallback));
  }, []);

  const openGallery = (entry: CleaningRecord, initialIdx = 0) => {
    setGalleryModal({
      open: true,
      entry,
      activeIdx: initialIdx,
    });
  };

  const closeGallery = () => {
    setGalleryModal({ open: false, entry: null, activeIdx: 0 });
  };

  const nextGalleryPhoto = () => {
    if (!galleryModal.entry) return;
    const photos = getEntryPhotos(galleryModal.entry);
    if (!photos.length) return;
    setGalleryModal((prev) => ({
      ...prev,
      activeIdx: (prev.activeIdx + 1) % photos.length,
    }));
  };

  const prevGalleryPhoto = () => {
    if (!galleryModal.entry) return;
    const photos = getEntryPhotos(galleryModal.entry);
    if (!photos.length) return;
    setGalleryModal((prev) => ({
      ...prev,
      activeIdx: (prev.activeIdx - 1 + photos.length) % photos.length,
    }));
  };

  const activePhotos = getEntryPhotos(galleryModal.entry);
  const currentPhoto = activePhotos[galleryModal.activeIdx] || activePhotos[0];

  return (
    <View style={styles.container}>
      {/* 1. Header — Exact 1-to-1 Match with Web View */}
      <Header
        title="Cleaning Upload"
        subtitle="Take live camera photos of cleaned areas as proof."
        onOpenMenu={onOpenMenu}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refreshCleaningRecords}
            tintColor="#4F6748"
          />
        }
      >
        {/* ========================================================================= */}
        {/* SECTION 1: LIVE CAMERA CARD (Exact Web Match) */}
        {/* ========================================================================= */}
        <Card style={styles.card}>
          {/* Viewfinder Header */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.cameraTitleRow}>
              <Camera size={16} color="#4F6748" />
              <Text style={styles.cameraTitle}>LIVE CAMERA</Text>
              {cameraActive ? (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              ) : (
                <View style={styles.offBadge}>
                  <Text style={styles.offText}>OFF</Text>
                </View>
              )}
            </View>

            <View style={styles.cameraActionBtns}>
              {cameraActive ? (
                <>
                  <TouchableOpacity
                    onPress={toggleFacing}
                    style={styles.smallActionBtn}
                    activeOpacity={0.7}
                  >
                    <RefreshCw size={12} color="#2D2D2A" />
                    <Text style={styles.smallActionBtnText}>Flip</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleCloseCamera}
                    style={styles.closeCameraBtn}
                    activeOpacity={0.7}
                  >
                    <VideoOff size={12} color="#DC2626" />
                    <Text style={styles.closeCameraBtnText}>Close Camera</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  onPress={handleOpenCamera}
                  style={styles.openCameraTopBtn}
                  activeOpacity={0.8}
                >
                  <Camera size={13} color="#FFFFFF" />
                  <Text style={styles.openCameraTopBtnText}>Open Camera</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Viewfinder Box */}
          <View style={styles.viewfinderBox}>
            {cameraActive ? (
              <View style={StyleSheet.absoluteFill}>
                <CameraView
                  ref={cameraRef}
                  facing={facing}
                  style={StyleSheet.absoluteFill}
                />

                {snapEffect && <View style={styles.shutterFlash} />}

                {/* Bottom Snap Action Overlay */}
                <View style={styles.snapOverlay}>
                  <TouchableOpacity
                    onPress={handleSnapPhoto}
                    disabled={capturedPhotos.length >= 10}
                    style={[
                      styles.snapButton,
                      capturedPhotos.length >= 10 && styles.snapButtonDisabled,
                    ]}
                    activeOpacity={0.85}
                  >
                    <View style={styles.snapPulseDot} />
                    <Text style={styles.snapButtonText}>
                      Snap Photo ({capturedPhotos.length}/10)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Camera Off Placeholder */
              <View style={styles.cameraOffPlaceholder}>
                <View style={styles.cameraIconCircle}>
                  <Camera size={26} color="#4F6748" />
                </View>
                <Text style={styles.cameraOffTitle}>Camera is Closed</Text>
                <Text style={styles.cameraOffSub}>
                  Click below to open device camera and take proof photos.
                </Text>
                <TouchableOpacity
                  onPress={handleOpenCamera}
                  style={styles.openCameraCenterBtn}
                  activeOpacity={0.85}
                >
                  <Camera size={14} color="#FFFFFF" />
                  <Text style={styles.openCameraCenterBtnText}>Open Camera</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Captured Photos Strip */}
          <View style={styles.capturedStripSection}>
            <View style={styles.capturedHeaderRow}>
              <View style={styles.capturedTitleRow}>
                <Layers size={14} color="#4F6748" />
                <Text style={styles.capturedTitle}>
                  Captured Photos ({capturedPhotos.length}/10)
                </Text>
              </View>
              {capturedPhotos.length > 0 && (
                <TouchableOpacity
                  onPress={handleClearAllPhotos}
                  style={styles.clearAllBtn}
                  activeOpacity={0.7}
                >
                  <Trash2 size={12} color="#DC2626" />
                  <Text style={styles.clearAllText}>Clear all</Text>
                </TouchableOpacity>
              )}
            </View>

            {capturedPhotos.length === 0 ? (
              <View style={styles.emptyCapturedBox}>
                <Text style={styles.emptyCapturedText}>
                  Open camera and click "Snap Photo" to take cleaning proof photos.
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.capturedThumbList}
              >
                {capturedPhotos.map((uri, idx) => (
                  <View key={idx} style={styles.thumbWrapper}>
                    <Image source={{ uri }} style={styles.thumbPhoto} resizeMode="cover" />
                    <View style={styles.thumbIndexBadge}>
                      <Text style={styles.thumbIndexText}>#{idx + 1}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemovePhoto(idx)}
                      style={styles.thumbDeleteBtn}
                      activeOpacity={0.8}
                    >
                      <X size={10} color="#FFFFFF" strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </Card>

        {/* ========================================================================= */}
        {/* SECTION 2: CLEANING DETAILS CARD (Exact Web Match) */}
        {/* ========================================================================= */}
        <Card style={styles.card}>
          <Text style={styles.sectionHeaderTitle}>CLEANING DETAILS</Text>

          <View style={styles.formGroup}>
            <View style={styles.labelRow}>
              <MessageSquare size={13} color="#737373" />
              <Text style={styles.inputLabel}>Note / Cleaning Details</Text>
            </View>
            <TextInput
              style={styles.textInputArea}
              placeholder="Enter cleaning details / notes here..."
              placeholderTextColor="#A1A1AA"
              multiline
              numberOfLines={3}
              value={note}
              onChangeText={setNote}
            />
            <Text style={styles.inputHelperText}>
              Add any notes or details about the cleaning.
            </Text>
          </View>

          {/* Submit Action */}
          {submitted ? (
            <View style={styles.successBanner}>
              <Check size={16} color="#15803D" strokeWidth={2.5} />
              <Text style={styles.successBannerText}>Submitted Successfully!</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={capturedPhotos.length === 0 || isSubmitting}
              style={[
                styles.submitBtn,
                (capturedPhotos.length === 0 || isSubmitting) && styles.submitBtnDisabled,
              ]}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>Uploading to Cloudinary...</Text>
                </>
              ) : (
                <>
                  <Upload size={15} color="#FFFFFF" strokeWidth={2} />
                  <Text style={styles.submitBtnText}>
                    Submit Cleaning Entry ({capturedPhotos.length} Photo
                    {capturedPhotos.length === 1 ? '' : 's'})
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </Card>

        {/* ========================================================================= */}
        {/* SECTION 3: YOUR RECENT ENTRIES (Exact Web Match, NO DELETE BUTTONS) */}
        {/* ========================================================================= */}
        {records.length > 0 && (
          <Card style={styles.card}>
            <View style={styles.recentHeaderRow}>
              <Text style={styles.recentHeaderTitle}>
                YOUR RECENT ENTRIES ({records.length})
              </Text>
              <Text style={styles.recentHeaderHint}>Click to view</Text>
            </View>

            <View style={styles.recentList}>
              {records.map((entry, idx) => {
                const entryPhotos = getEntryPhotos(entry);
                const count = entry.photoCount || entryPhotos.length || 1;
                const thumb = entryPhotos[0] || entry.photo;
                const displayLabel = entry.note || entry.notes || entry.area || 'General Cleaning';

                return (
                  <TouchableOpacity
                    key={entry.id || idx}
                    onPress={() => openGallery(entry)}
                    style={[
                      styles.recentItemRow,
                      idx !== records.length - 1 && styles.recentItemBorder,
                    ]}
                    activeOpacity={0.7}
                  >
                    {/* Left: Thumbnail with count badge */}
                    <View style={styles.recentThumbBox}>
                      {thumb ? (
                        <Image source={{ uri: thumb }} style={styles.recentThumbImg} resizeMode="cover" />
                      ) : (
                        <View style={styles.recentEmptyThumb}>
                          <Camera size={16} color="#A1A1AA" />
                        </View>
                      )}
                      {count > 1 && (
                        <View style={styles.countBadge}>
                          <Text style={styles.countBadgeText}>+{count - 1}</Text>
                        </View>
                      )}
                    </View>

                    {/* Middle: Title & Meta */}
                    <View style={styles.recentInfoCol}>
                      <View style={styles.recentTitleRow}>
                        <Text style={styles.recentItemTitle} numberOfLines={1}>
                          {displayLabel}
                        </Text>
                        <View style={styles.photoCountPill}>
                          <Text style={styles.photoCountPillText}>{count}P</Text>
                        </View>
                      </View>
                      <Text style={styles.recentItemDate}>
                        {entry.time || '18:02'} — {entry.date || '5 Nov 2026'}
                      </Text>
                    </View>

                    {/* Right: Eye View Icon (NO DELETE BUTTON!) */}
                    <View style={styles.eyeBtn}>
                      <Eye size={15} color="#8B9E82" />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* 4. INTERACTIVE PHOTO GALLERY MODAL (Exact Web Match, NO DELETE BUTTON) */}
      {/* ========================================================================= */}
      <Modal
        visible={galleryModal.open && !!galleryModal.entry}
        transparent
        animationType="fade"
        onRequestClose={closeGallery}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    {galleryModal.entry?.area || galleryModal.entry?.note || 'Cleaning Proof'}
                  </Text>
                  <View style={styles.modalCountPill}>
                    <Text style={styles.modalCountPillText}>{activePhotos.length} Photos</Text>
                  </View>
                </View>
                <Text style={styles.modalSubtitle}>
                  {galleryModal.entry?.cleanerName || 'cleaner'} • {galleryModal.entry?.time} —{' '}
                  {galleryModal.entry?.date}
                </Text>
              </View>

              <TouchableOpacity
                onPress={closeGallery}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <X size={16} color="#2D2D2A" />
              </TouchableOpacity>
            </View>

            {/* Photo Viewer */}
            <View style={styles.modalViewer}>
              {currentPhoto ? (
                <Image
                  source={{ uri: currentPhoto }}
                  style={styles.modalMainPhoto}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.modalNoPhoto}>
                  <Camera size={36} color="#A1A1AA" />
                  <Text style={styles.modalNoPhotoText}>No photo available</Text>
                </View>
              )}

              {/* Prev / Next Arrows */}
              {activePhotos.length > 1 && (
                <>
                  <TouchableOpacity
                    onPress={prevGalleryPhoto}
                    style={[styles.carouselBtn, styles.carouselBtnLeft]}
                    activeOpacity={0.8}
                  >
                    <ChevronLeft size={20} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={nextGalleryPhoto}
                    style={[styles.carouselBtn, styles.carouselBtnRight]}
                    activeOpacity={0.8}
                  >
                    <ChevronRight size={20} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>

                  {/* Photo Index Counter */}
                  <View style={styles.photoCounterBadge}>
                    <Text style={styles.photoCounterText}>
                      {galleryModal.activeIdx + 1} / {activePhotos.length}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* Modal Footer Note */}
            {galleryModal.entry?.note || galleryModal.entry?.notes ? (
              <View style={styles.modalFooter}>
                <Text style={styles.modalNoteLabel}>Cleaner Note:</Text>
                <Text style={styles.modalNoteText}>
                  {galleryModal.entry.note || galleryModal.entry.notes}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF7F2',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  headerRefreshBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cameraTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cameraTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
    letterSpacing: 0.5,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EBF3EC',
    borderWidth: 1,
    borderColor: 'rgba(79, 103, 72, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#15803D',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
  },
  offBadge: {
    backgroundColor: '#F6F1EB',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  offText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#737373',
  },
  cameraActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F6F1EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  smallActionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  closeCameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  closeCameraBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  openCameraTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4F6748',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#4F6748',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
  openCameraTopBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  viewfinderBox: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterFlash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
    opacity: 0.8,
    zIndex: 20,
  },
  snapOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  snapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4F6748',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  snapButtonDisabled: {
    opacity: 0.5,
  },
  snapPulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  snapButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cameraOffPlaceholder: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(246, 241, 235, 0.95)',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E8E2D9',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  cameraIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cameraOffTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2A',
    marginBottom: 2,
  },
  cameraOffSub: {
    fontSize: 11,
    color: '#737373',
    textAlign: 'center',
    maxWidth: 240,
  },
  openCameraCenterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4F6748',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#4F6748',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  openCameraCenterBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pickPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pickPhotoBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D2D2A',
  },
  capturedStripSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8E2D9',
  },
  capturedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  capturedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  capturedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clearAllText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  emptyCapturedBox: {
    backgroundColor: '#F6F1EB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  emptyCapturedText: {
    fontSize: 11,
    color: '#737373',
    textAlign: 'center',
  },
  capturedThumbList: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  thumbWrapper: {
    position: 'relative',
    width: 80,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    backgroundColor: '#F6F1EB',
  },
  thumbPhoto: {
    width: '100%',
    height: '100%',
  },
  thumbIndexBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    backgroundColor: 'rgba(45, 45, 42, 0.85)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  thumbIndexText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  thumbDeleteBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Section 2: Cleaning Details
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  formGroup: {
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#737373',
  },
  textInputArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#2D2D2A',
    minHeight: 70,
    textAlignVertical: 'top',
  },
  inputHelperText: {
    fontSize: 10,
    color: '#737373',
    marginTop: 4,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4F6748',
    height: 44,
    borderRadius: 10,
    shadowColor: '#4F6748',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EBF3EC',
    borderWidth: 1,
    borderColor: 'rgba(79, 103, 72, 0.3)',
    height: 44,
    borderRadius: 10,
  },
  successBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },
  // Section 3: Recent Entries
  recentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recentHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
    letterSpacing: 0.5,
  },
  recentHeaderHint: {
    fontSize: 11,
    color: '#737373',
  },
  recentList: {
    gap: 8,
  },
  recentItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FBF7F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E2D9',
  },
  recentItemBorder: {
    marginBottom: 2,
  },
  recentThumbBox: {
    position: 'relative',
    width: 56,
    height: 42,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    backgroundColor: '#FFFFFF',
    marginRight: 10,
  },
  recentThumbImg: {
    width: '100%',
    height: '100%',
  },
  recentEmptyThumb: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F1EB',
  },
  countBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(45, 45, 42, 0.85)',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
  },
  countBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  recentInfoCol: {
    flex: 1,
  },
  recentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  recentItemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
    flexShrink: 1,
  },
  photoCountPill: {
    backgroundColor: '#EBF3EC',
    borderWidth: 1,
    borderColor: 'rgba(79, 103, 72, 0.25)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  photoCountPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#4F6748',
  },
  recentItemDate: {
    fontSize: 10,
    color: '#737373',
  },
  eyeBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E2D9',
    backgroundColor: '#F6F1EB',
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  modalCountPill: {
    backgroundColor: '#EBF3EC',
    borderWidth: 1,
    borderColor: 'rgba(79, 103, 72, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  modalCountPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F6748',
  },
  modalSubtitle: {
    fontSize: 10,
    color: '#737373',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E8E2D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalViewer: {
    position: 'relative',
    width: '100%',
    height: 280,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalMainPhoto: {
    width: '100%',
    height: '100%',
  },
  modalNoPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalNoPhotoText: {
    fontSize: 12,
    color: '#A1A1AA',
    marginTop: 6,
  },
  carouselBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  carouselBtnLeft: {
    left: 10,
  },
  carouselBtnRight: {
    right: 10,
  },
  photoCounterBadge: {
    position: 'absolute',
    bottom: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  photoCounterText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#E8E2D9',
    backgroundColor: '#FBF7F2',
  },
  modalNoteLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#737373',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  modalNoteText: {
    fontSize: 12,
    color: '#2D2D2A',
  },
});
export default CleaningUploadScreen;
