/**
 * StockScreen — 1-to-1 Match with Omega Spa POS Web Software
 * Matches frontend/src/pages/Stock.jsx, RetailProducts.jsx, and StockPhotos.jsx:
 * - Tab 1: Service Stock (Professional Back-Bar Supplies)
 * - Tab 2: Retail Products (Products for sale to clients)
 * - Tab 3: Daily Stock Photos (Staff photo audits with Cloudinary previews)
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  Image,
  Modal,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {
  Package,
  Plus,
  AlertTriangle,
  Camera,
  CheckCircle,
  XCircle,
  Search,
  ShoppingBag,
  Sliders,
  X,
  Check,
} from 'lucide-react-native';
import THEME from '../constants/theme';
import Header from '../components/Header';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Button from '../components/Button';
import CameraModal from '../components/CameraModal';
import { useStock, ServiceStockItem, RetailProductItem, StockAuditItem } from '../context/StockContext';
import { useAuth } from '../context/AuthContext';
import { formatFCFA } from '../utils/currency';
import { formatDate } from '../utils/date';

interface StockScreenProps {
  onOpenMenu?: () => void;
  initialTab?: 'STOCK' | 'RETAIL' | 'AUDITS';
}

export const StockScreen: React.FC<StockScreenProps> = ({ onOpenMenu, initialTab = 'STOCK' }) => {
  const { user } = useAuth();
  const role = (user?.role || '').toLowerCase();
  const isManager = role === 'manager';

  const {
    serviceStock,
    retailProducts,
    dailyAudits,
    loading,
    refreshStock,
    refillStock,
    adjustStock,
    submitAuditPhoto,
    reviewAudit,
  } = useStock();

  const [activeTab, setActiveTab] = useState<'STOCK' | 'RETAIL' | 'AUDITS'>(initialTab);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cameraVisible, setCameraVisible] = useState<boolean>(false);
  const [selectedAuditPhoto, setSelectedAuditPhoto] = useState<string | null>(null);

  // Filtered lists
  const filteredServiceStock = useMemo(() => {
    return serviceStock.filter((item) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    });
  }, [serviceStock, searchQuery]);

  const filteredRetailProducts = useMemo(() => {
    return retailProducts.filter((item) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    });
  }, [retailProducts, searchQuery]);

  const filteredAudits = useMemo(() => {
    return dailyAudits.filter((item) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        item.productName.toLowerCase().includes(q) ||
        item.technicianName.toLowerCase().includes(q)
      );
    });
  }, [dailyAudits, searchQuery]);

  const handleRefill = (item: ServiceStockItem) => {
    Alert.prompt(
      `Refill ${item.name}`,
      `Enter quantity to add (${item.unit}):`,
      async (qty) => {
        if (qty && !isNaN(Number(qty))) {
          try {
            await refillStock(item.id, Number(qty));
            Alert.alert('Success', `Added ${qty} ${item.unit} to stock.`);
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to refill stock.');
          }
        }
      },
      'plain-text',
      '10'
    );
  };

  const handleAdjust = (item: ServiceStockItem) => {
    Alert.prompt(
      `Adjust ${item.name}`,
      `Enter actual count (${item.unit}):`,
      async (qty) => {
        if (qty && !isNaN(Number(qty))) {
          try {
            await adjustStock(item.id, Number(qty), 'Routine stock count adjustment');
            Alert.alert('Success', `Stock count updated to ${qty} ${item.unit}.`);
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to adjust stock.');
          }
        }
      },
      'plain-text',
      String(item.quantity)
    );
  };

  const handleAuditPhoto = async (uri: string) => {
    try {
      await submitAuditPhoto('Professional Supply Shelf', uri);
      Alert.alert('Success', 'Daily stock photo submitted for manager verification.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to upload audit photo.');
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Inventory & Stock"
        subtitle={
          activeTab === 'STOCK'
            ? `Back-Bar Supplies (${serviceStock.length})`
            : activeTab === 'RETAIL'
            ? `Retail Products (${retailProducts.length})`
            : `Daily Audits (${dailyAudits.length})`
        }
        onOpenMenu={onOpenMenu}
        rightAction={
          <TouchableOpacity
            onPress={() => setCameraVisible(true)}
            style={styles.cameraBtn}
            activeOpacity={0.8}
          >
            <Camera size={18} color="#FFFFFF" />
          </TouchableOpacity>
        }
      />

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => setActiveTab('STOCK')}
          style={[styles.tab, activeTab === 'STOCK' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'STOCK' && styles.tabTextActive]}>
            Service Supplies ({serviceStock.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('RETAIL')}
          style={[styles.tab, activeTab === 'RETAIL' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'RETAIL' && styles.tabTextActive]}>
            Retail Products ({retailProducts.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('AUDITS')}
          style={[styles.tab, activeTab === 'AUDITS' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'AUDITS' && styles.tabTextActive]}>
            Daily Photos ({dailyAudits.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Search size={15} color={THEME.colors.textMuted} style={{ marginRight: 6 }} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={
            activeTab === 'STOCK'
              ? 'Search supply items or category...'
              : activeTab === 'RETAIL'
              ? 'Search retail products...'
              : 'Search photo audits...'
          }
          placeholderTextColor={THEME.colors.textMuted}
          style={styles.searchInput}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
            <X size={14} color={THEME.colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Content Area */}
      <View style={styles.contentArea}>
        {loading && serviceStock.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={THEME.colors.primary} />
            <Text style={styles.loadingText}>Syncing stock from Omega Spa backend...</Text>
          </View>
        ) : activeTab === 'STOCK' ? (
          <FlatList
            style={styles.flatList}
            data={filteredServiceStock}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={refreshStock}
                tintColor={THEME.colors.primaryDark}
              />
            }
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Package size={36} color={THEME.colors.textMuted} />
                <Text style={styles.emptyTitle}>No service supplies found</Text>
                <Text style={styles.emptySub}>
                  {searchQuery ? 'Try clearing your search query.' : 'Back-bar inventory is empty.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isLow = item.quantity <= (item.minThreshold || 5);
              return (
                <View style={styles.stockCard}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemCategory}>{item.category || 'General Supplies'}</Text>
                    </View>
                    <Badge
                      label={isLow ? 'Low Stock' : 'In Stock'}
                      variant={isLow ? 'danger' : 'success'}
                    />
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.quantityBox}>
                      <Text style={styles.qtyValue}>{item.quantity}</Text>
                      <Text style={styles.qtyUnit}>{item.unit}</Text>
                    </View>

                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        onPress={() => handleRefill(item)}
                        style={styles.refillBtn}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.refillBtnText}>+ Refill</Text>
                      </TouchableOpacity>

                      {isManager && (
                        <TouchableOpacity
                          onPress={() => handleAdjust(item)}
                          style={styles.adjustBtn}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.adjustBtnText}>Adjust</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
          />
        ) : activeTab === 'RETAIL' ? (
          <FlatList
            style={styles.flatList}
            data={filteredRetailProducts}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={refreshStock}
                tintColor={THEME.colors.primaryDark}
              />
            }
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <ShoppingBag size={36} color={THEME.colors.textMuted} />
                <Text style={styles.emptyTitle}>No retail products found</Text>
                <Text style={styles.emptySub}>
                  {searchQuery ? 'Try clearing your search query.' : 'No retail products in inventory.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.stockCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemCategory}>{item.category}</Text>
                  </View>
                  <Text style={styles.retailPrice}>{formatFCFA(item.price)}</Text>
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.quantityBox}>
                    <Text style={styles.qtyValue}>{item.quantity}</Text>
                    <Text style={styles.qtyUnit}>in stock</Text>
                  </View>
                  <Badge
                    label={item.isActive ? 'Active' : 'Archived'}
                    variant={item.isActive ? 'success' : 'muted'}
                  />
                </View>
              </View>
            )}
          />
        ) : (
          <FlatList
            style={styles.flatList}
            data={filteredAudits}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={refreshStock}
                tintColor={THEME.colors.primaryDark}
              />
            }
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Camera size={36} color={THEME.colors.textMuted} />
                <Text style={styles.emptyTitle}>No stock photo audits yet</Text>
                <Text style={styles.emptySub}>
                  Tap the camera icon in top-right to submit today's stock audit photo.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.auditCard}>
                <View style={styles.auditHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.auditTitle}>{item.productName}</Text>
                    <Text style={styles.auditSub}>
                      {item.technicianName} • {formatDate(item.date)}
                    </Text>
                  </View>
                  <Badge
                    label={item.status}
                    variant={
                      item.status === 'APPROVED'
                        ? 'success'
                        : item.status === 'REJECTED'
                        ? 'danger'
                        : 'warning'
                    }
                  />
                </View>

                {item.photoUrl ? (
                  <TouchableOpacity
                    onPress={() => setSelectedAuditPhoto(item.photoUrl!)}
                    activeOpacity={0.9}
                    style={styles.photoContainer}
                  >
                    <Image source={{ uri: item.photoUrl }} style={styles.auditImage} />
                  </TouchableOpacity>
                ) : null}

                {isManager && item.status === 'PENDING_REVIEW' && (
                  <View style={styles.auditActionRow}>
                    <TouchableOpacity
                      onPress={() => reviewAudit(item.id, 'APPROVED')}
                      style={[styles.auditBtn, styles.approveBtn]}
                    >
                      <Check size={14} color="#FFFFFF" />
                      <Text style={styles.auditBtnText}>Approve</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => reviewAudit(item.id, 'REJECTED', 'Stock discrepancy noted')}
                      style={[styles.auditBtn, styles.rejectBtn]}
                    >
                      <X size={14} color="#FFFFFF" />
                      <Text style={styles.auditBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          />
        )}
      </View>

      {/* Camera Capture Modal */}
      <CameraModal
        title="Daily Stock Photo Audit"
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onCapture={handleAuditPhoto}
      />

      {/* Full Photo Viewer Modal */}
      <Modal
        visible={!!selectedAuditPhoto}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedAuditPhoto(null)}
      >
        <TouchableOpacity
          style={styles.fullPhotoOverlay}
          activeOpacity={1}
          onPress={() => setSelectedAuditPhoto(null)}
        >
          <View style={styles.fullPhotoBox}>
            {selectedAuditPhoto && (
              <Image
                source={{ uri: selectedAuditPhoto }}
                style={styles.fullPhotoImage}
                resizeMode="contain"
              />
            )}
            <TouchableOpacity
              onPress={() => setSelectedAuditPhoto(null)}
              style={styles.closeFullPhotoBtn}
            >
              <X size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  cameraBtn: {
    backgroundColor: THEME.colors.primary,
    padding: 8,
    borderRadius: THEME.radii.full,
    ...THEME.shadows.sm,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: THEME.colors.primaryDark,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  tabTextActive: {
    color: THEME.colors.primaryDark,
    fontWeight: '800',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: THEME.colors.text,
    paddingVertical: 0,
  },
  contentArea: {
    flex: 1,
  },
  flatList: {
    flex: 1,
  },
  listContent: {
    padding: 12,
    gap: 10,
    paddingBottom: 30,
  },
  stockCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 12,
    padding: 12,
    ...THEME.shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  itemCategory: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  retailPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.primaryDark,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    marginTop: 4,
  },
  quantityBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  qtyValue: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.primaryDark,
  },
  qtyUnit: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  refillBtn: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  refillBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  adjustBtn: {
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  adjustBtnText: {
    color: THEME.colors.text,
    fontSize: 11,
    fontWeight: '600',
  },
  auditCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 12,
    padding: 12,
    ...THEME.shadows.sm,
  },
  auditHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  auditTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  auditSub: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  photoContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 6,
    height: 160,
    backgroundColor: '#000000',
  },
  auditImage: {
    width: '100%',
    height: '100%',
  },
  auditActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  auditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 8,
  },
  approveBtn: {
    backgroundColor: '#10B981',
  },
  rejectBtn: {
    backgroundColor: '#EF4444',
  },
  auditBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
  fullPhotoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullPhotoBox: {
    width: '90%',
    height: '80%',
    position: 'relative',
  },
  fullPhotoImage: {
    width: '100%',
    height: '100%',
  },
  closeFullPhotoBtn: {
    position: 'absolute',
    top: -30,
    right: 0,
    padding: 8,
  },
});

export default StockScreen;
