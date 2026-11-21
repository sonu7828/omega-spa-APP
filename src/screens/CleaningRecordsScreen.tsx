/**
 * CleaningRecordsScreen — Manager & Reception View for Mobile APP
 * Exact 1-to-1 match with frontend/src/pages/CleaningRecords.jsx & Web POS:
 * - Header: Title "Cleaning Records", Subtitle "Review cleaning submissions, photo counts, and camera gallery proofs from staff."
 * - Card Header: "ALL RECORDS (X)" on left, "Click photo to view gallery" on right
 * - Record Cards (Exact match with web):
 *     - Left: Thumbnail image with "+X" photo badge if multiple photos
 *     - Middle: Note/Area title, cleaner badge (warning-soft), photos count badge (sage-soft with Layers icon), timestamp
 *     - Right: Delete record button (Trash2 icon) with confirmation alert
 * - Full Interactive Photo Gallery Modal:
 *     - Full resolution Cloudinary photo viewer with Prev/Next carousel
 *     - Photo counter, cleaner metadata, notes, and delete record action
 * - Zero non-software elements (No "+ Snap Proof", no extra status bars)
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import {
  Camera,
  Layers,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react-native';
import Header from '../components/Header';
import Card from '../components/Card';
import THEME from '../constants/theme';
import { useCleaning, CleaningRecord } from '../context/CleaningContext';
import { useAuth } from '../context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CleaningRecordsScreenProps {
  onOpenMenu?: () => void;
}

export const CleaningRecordsScreen: React.FC<CleaningRecordsScreenProps> = ({ onOpenMenu }) => {
  const { user } = useAuth();
  const { records, loading, refreshCleaningRecords, deleteCleaningRecord } = useCleaning();

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

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Helper to extract list of photo URLs from a record
  const getEntryPhotos = useCallback((entry: CleaningRecord | null): string[] => {
    if (!entry) return [];
    if (Array.isArray(entry.photos) && entry.photos.length > 0) {
      return entry.photos.filter(Boolean);
    }
    const legacy = [entry.photo, entry.afterPhoto, entry.beforePhoto].filter(Boolean) as string[];
    return Array.from(new Set(legacy));
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

  // Delete Record Handler
  const handleDelete = (recordId: string) => {
    Alert.alert(
      'Delete Cleaning Record',
      'Are you sure you want to delete this cleaning record and its photos? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(recordId);
              await deleteCleaningRecord(recordId);
              if (galleryModal.entry?.id === recordId) {
                closeGallery();
              }
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete cleaning record');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const activePhotos = getEntryPhotos(galleryModal.entry);
  const currentPhoto = activePhotos[galleryModal.activeIdx] || activePhotos[0];

  return (
    <View style={styles.container}>
      {/* Header — 1-to-1 Web POS Match */}
      <Header
        title="Cleaning Records"
        subtitle="Review cleaning submissions, photo counts, and camera gallery proofs from staff."
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
        {/* Main Records Container Card */}
        {records.length === 0 ? (
          <Card style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Camera size={32} color="#A1A1AA" />
            </View>
            <Text style={styles.emptyTitle}>No cleaning records yet</Text>
            <Text style={styles.emptySubtitle}>
              Records will appear here once cleaners submit proof photos.
            </Text>
          </Card>
        ) : (
          <Card style={styles.recordsCard}>
            {/* Header matching web: ALL RECORDS (X)  Click photo to view gallery */}
            <View style={styles.recordsHeaderRow}>
              <Text style={styles.recordsHeaderTitle}>ALL RECORDS ({records.length})</Text>
              <Text style={styles.recordsHeaderSubtitle}>Click photo to view gallery</Text>
            </View>

            {/* List of Mobile Cards matching media_1794569308515_a5c9f2af.png */}
            <View style={styles.recordsList}>
              {records.map((r, index) => {
                const photos = getEntryPhotos(r);
                const count = r.photoCount || photos.length || (r.photo ? 1 : 0);
                const thumb = photos[0] || r.photo;
                const isDeleting = deletingId === r.id;

                return (
                  <TouchableOpacity
                    key={r.id || index}
                    onPress={() => openGallery(r)}
                    style={styles.recordItemCard}
                    activeOpacity={0.75}
                  >
                    {/* Left: Thumbnail with count badge */}
                    <View style={styles.thumbContainer}>
                      {thumb ? (
                        <Image source={{ uri: thumb }} style={styles.thumbImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.emptyThumb}>
                          <Camera size={18} color="#A1A1AA" />
                        </View>
                      )}
                      {count > 1 && (
                        <View style={styles.thumbCountBadge}>
                          <Text style={styles.thumbCountText}>+{count - 1}</Text>
                        </View>
                      )}
                    </View>

                    {/* Middle: Details */}
                    <View style={styles.recordInfoCol}>
                      {/* Note / Area & Trash Icon */}
                      <View style={styles.recordTopRow}>
                        <Text style={styles.recordTitle} numberOfLines={1}>
                          {r.note || r.notes || r.area || 'Cleaning Proof'}
                        </Text>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDelete(r.id);
                          }}
                          disabled={isDeleting}
                          style={styles.deleteBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          {isDeleting ? (
                            <ActivityIndicator size="small" color="#DC2626" />
                          ) : (
                            <Trash2 size={15} color="#A1A1AA" />
                          )}
                        </TouchableOpacity>
                      </View>

                      {/* Badges: Cleaner & Photo Count */}
                      <View style={styles.badgesRow}>
                        <View style={styles.cleanerBadge}>
                          <Text style={styles.cleanerBadgeText}>{r.cleanerName || 'cleaner'}</Text>
                        </View>
                        <View style={styles.photoBadge}>
                          <Layers size={10} color="#4F6748" />
                          <Text style={styles.photoBadgeText}>
                            {count} {count === 1 ? 'Photo' : 'Photos'}
                          </Text>
                        </View>
                      </View>

                      {/* Timestamp */}
                      <Text style={styles.recordTimestamp}>
                        {r.time || '12:00'} — {r.date || 'Today'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* PHOTO GALLERY MODAL — 1-to-1 Web POS Match with Carousel & Delete */}
      {/* ========================================================================= */}
      <Modal
        visible={galleryModal.open && !!galleryModal.entry}
        transparent
        animationType="fade"
        onRequestClose={closeGallery}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    {galleryModal.entry?.note || galleryModal.entry?.area || 'Cleaning Proof'}
                  </Text>
                  <View style={styles.modalPhotoPill}>
                    <Text style={styles.modalPhotoPillText}>{activePhotos.length} Photos</Text>
                  </View>
                </View>
                <Text style={styles.modalSubtitle}>
                  {galleryModal.entry?.cleanerName || 'cleaner'} • {galleryModal.entry?.time} —{' '}
                  {galleryModal.entry?.date}
                </Text>
              </View>

              <TouchableOpacity onPress={closeGallery} style={styles.modalCloseBtn}>
                <X size={18} color="#2D2D2A" />
              </TouchableOpacity>
            </View>

            {/* Modal Photo Viewer */}
            <View style={styles.modalViewerBox}>
              {currentPhoto ? (
                <Image
                  source={{ uri: currentPhoto }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.modalEmptyViewer}>
                  <Camera size={40} color="#A1A1AA" />
                  <Text style={styles.modalEmptyText}>No photo available</Text>
                </View>
              )}

              {/* Prev / Next Carousel Controls */}
              {activePhotos.length > 1 && (
                <>
                  <TouchableOpacity
                    onPress={prevGalleryPhoto}
                    style={[styles.carouselNavBtn, styles.carouselNavBtnLeft]}
                    activeOpacity={0.8}
                  >
                    <ChevronLeft size={20} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={nextGalleryPhoto}
                    style={[styles.carouselNavBtn, styles.carouselNavBtnRight]}
                    activeOpacity={0.8}
                  >
                    <ChevronRight size={20} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>

                  {/* Photo Counter Pill */}
                  <View style={styles.modalCounterPill}>
                    <Text style={styles.modalCounterText}>
                      {galleryModal.activeIdx + 1} / {activePhotos.length}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* Modal Bottom: Note & Delete Action */}
            <View style={styles.modalFooter}>
              <View style={styles.modalNoteBox}>
                <Text style={styles.modalNoteLabel}>Cleaner Note:</Text>
                <Text style={styles.modalNoteText}>
                  {galleryModal.entry?.notes || galleryModal.entry?.note || 'No notes provided.'}
                </Text>
              </View>

              {galleryModal.entry && (
                <TouchableOpacity
                  onPress={() => handleDelete(galleryModal.entry!.id)}
                  style={styles.modalDeleteBtn}
                  activeOpacity={0.8}
                >
                  <Trash2 size={14} color="#DC2626" />
                  <Text style={styles.modalDeleteBtnText}>Delete Record</Text>
                </TouchableOpacity>
              )}
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
    backgroundColor: '#FBF7F2',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  recordsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAE3D9',
    overflow: 'hidden',
    padding: 0,
  },
  recordsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE4',
  },
  recordsHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  recordsHeaderSubtitle: {
    fontSize: 11,
    color: '#76766E',
  },
  recordsList: {
    padding: 12,
    gap: 10,
  },
  recordItemCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: 'rgba(229, 224, 216, 0.7)',
    borderRadius: 12,
    padding: 10,
  },
  thumbContainer: {
    position: 'relative',
    width: 76,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EAE3D9',
    backgroundColor: '#FFFFFF',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  emptyThumb: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F1EB',
  },
  thumbCountBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(45, 45, 42, 0.85)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  thumbCountText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  recordInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  recordTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  recordTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  deleteBtn: {
    padding: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  cleanerBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  cleanerBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#D97706',
    textTransform: 'capitalize',
  },
  photoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EEF3EA',
    borderWidth: 1,
    borderColor: '#D0DED0',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  photoBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F6748',
  },
  recordTimestamp: {
    fontSize: 11,
    color: '#76766E',
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAE3D9',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F6F1EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2A',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#76766E',
    textAlign: 'center',
    maxWidth: 240,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE4',
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  modalPhotoPill: {
    backgroundColor: '#EEF3EA',
    borderWidth: 1,
    borderColor: '#D0DED0',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  modalPhotoPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F6748',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#76766E',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F6F1EB',
  },
  modalViewerBox: {
    width: '100%',
    height: 320,
    backgroundColor: '#1C1917',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalEmptyViewer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEmptyText: {
    color: '#A1A1AA',
    fontSize: 12,
    marginTop: 8,
  },
  carouselNavBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselNavBtnLeft: {
    left: 10,
  },
  carouselNavBtnRight: {
    right: 10,
  },
  modalCounterPill: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modalCounterText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  modalFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0ECE4',
    gap: 10,
  },
  modalNoteBox: {
    backgroundColor: '#FAF8F5',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EAE3D9',
  },
  modalNoteLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D2D2A',
    marginBottom: 2,
  },
  modalNoteText: {
    fontSize: 12,
    color: '#76766E',
  },
  modalDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  modalDeleteBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
});

export default CleaningRecordsScreen;
