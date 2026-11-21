/**
 * LoyaltySettingsScreen — 1-to-1 Match with Omega Spa POS Web Software
 * Matches frontend/src/pages/LoyaltySettings.jsx and Web View Screenshot:
 * - Header: Title "Loyalty Settings", Subtitle "Configure rules for earning and redeeming loyalty points."
 * - Save Button: [ 💾 Save Settings ] in header
 * - 1. Default Spending Rule:
 *     - "Earn [X] pt(s) for every [Y FCFA] spent"
 *     - "ⓘ Example: 15,000 FCFA = Z points"
 * - 2. Redeem Rule:
 *     - "[X] Points = [Y FCFA] discount"
 *     - "Min to Redeem: [Z] points"
 * - 3. Service-Specific Earning Rules:
 *     - Per-service custom point allocations overriding default spending rule
 * - 4. Points Expiry:
 *     - Enable/disable points expiry toggle + expiry months duration
 *
 * ZERO invented features (No VIP Tiers, No Silver/Gold, No Birthday Bonus).
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  Sparkles,
  Award,
  Layers,
  Save,
  Check,
  Clock,
  AlertCircle,
  Trash2,
} from 'lucide-react-native';
import THEME from '../constants/theme';
import Header from '../components/Header';
import Card from '../components/Card';
import { loyaltyApi } from '../services/api';
import { useServices } from '../context/ServicesContext';
import { useAuth } from '../context/AuthContext';

interface LoyaltySettingsScreenProps {
  onOpenMenu?: () => void;
}

export const LoyaltySettingsScreen: React.FC<LoyaltySettingsScreenProps> = ({ onOpenMenu }) => {
  const { user } = useAuth();
  const isManager = (user?.role || '').toLowerCase() === 'manager';
  const { activeServices } = useServices();

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Form state — exact match with LoyaltySettings.jsx
  const [pointsPerSpend, setPointsPerSpend] = useState<string>('10');
  const [spendAmountForPoint, setSpendAmountForPoint] = useState<string>('10000');
  const [pointsForDiscount, setPointsForDiscount] = useState<string>('100');
  const [discountAmount, setDiscountAmount] = useState<string>('10000');
  const [minPointsToRedeem, setMinPointsToRedeem] = useState<string>('15');
  const [pointsExpiryEnabled, setPointsExpiryEnabled] = useState<boolean>(false);
  const [expiryMonths, setExpiryMonths] = useState<string>('12');
  const [servicePoints, setServicePoints] = useState<{ [serviceName: string]: number }>({});

  // Load live settings from backend on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await loyaltyApi.getSettings().catch(() => null);
        const s = res?.data || res;
        if (isMounted && s) {
          if (s.pointsPerSpend !== undefined) setPointsPerSpend(String(s.pointsPerSpend));
          if (s.spendAmountForPoint !== undefined) setSpendAmountForPoint(String(s.spendAmountForPoint));
          if (s.pointsForDiscount !== undefined) setPointsForDiscount(String(s.pointsForDiscount));
          if (s.discountAmount !== undefined) setDiscountAmount(String(s.discountAmount));
          if (s.minPointsToRedeem !== undefined) setMinPointsToRedeem(String(s.minPointsToRedeem));
          if (s.pointsExpiryEnabled !== undefined) setPointsExpiryEnabled(Boolean(s.pointsExpiryEnabled));
          if (s.expiryDays) setExpiryMonths(String(Math.round(s.expiryDays / 30)));
          else if (s.expiryMonths) setExpiryMonths(String(s.expiryMonths));
          if (s.servicePoints && typeof s.servicePoints === 'object') {
            setServicePoints(s.servicePoints);
          }
        }
      } catch (e) {
        console.warn('Error loading loyalty settings:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleServicePointChange = (serviceName: string, val: string) => {
    const num = parseInt(val, 10);
    setServicePoints((prev) => {
      const copy = { ...prev };
      if (isNaN(num) || num <= 0) {
        delete copy[serviceName];
      } else {
        copy[serviceName] = num;
      }
      return copy;
    });
  };

  const handleRemoveServiceRule = (serviceName: string) => {
    setServicePoints((prev) => {
      const copy = { ...prev };
      delete copy[serviceName];
      return copy;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        spendAmountForPoint: Math.max(1, Number(spendAmountForPoint) || 10000),
        pointsPerSpend: Math.max(1, Number(pointsPerSpend) || 10),
        pointsForDiscount: Math.max(1, Number(pointsForDiscount) || 100),
        discountAmount: Math.max(1, Number(discountAmount) || 10000),
        minPointsToRedeem: Math.max(0, Number(minPointsToRedeem) || 15),
        pointsExpiryEnabled: Boolean(pointsExpiryEnabled),
        expiryDays: Math.max(1, Number(expiryMonths) || 12) * 30,
        servicePoints: { ...servicePoints },
      };

      await loyaltyApi.updateSettings(payload);
      setSaving(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      Alert.alert('Saved', 'Loyalty settings updated successfully!');
    } catch (e: any) {
      setSaving(false);
      Alert.alert('Error', e?.message || 'Failed to update loyalty settings.');
    }
  };

  // Example calculation
  const numSpend = Number(spendAmountForPoint) || 10000;
  const numEarn = Number(pointsPerSpend) || 10;
  const examplePoints = Math.floor(15000 / numSpend) * numEarn;

  return (
    <View style={styles.container}>
      <Header
        title="Loyalty Settings"
        subtitle={
          isManager
            ? 'Configure rules for earning and redeeming loyalty points.'
            : 'View rules for earning and redeeming loyalty points (View Only).'
        }
        onOpenMenu={onOpenMenu}
        rightAction={
          isManager ? (
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveBtn, savedSuccess && styles.saveBtnSuccess]}
              activeOpacity={0.8}
            >
              {savedSuccess ? (
                <>
                  <Check size={16} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Saved!</Text>
                </>
              ) : (
                <>
                  <Save size={16} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Settings'}</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null
        }
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F6748" />
          <Text style={styles.loadingText}>Loading loyalty rules...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* ========================================================================= */}
          {/* CARD 1: DEFAULT SPENDING RULE (Exact match with Web View)                 */}
          {/* ========================================================================= */}
          <Card style={styles.ruleCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <Sparkles size={16} color="#4F6748" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Default Spending Rule</Text>
                <Text style={styles.cardSubtitle}>
                  Applied when a service does not have a custom rule
                </Text>
              </View>
            </View>

            <View style={styles.innerBox}>
              <View style={styles.ruleRow}>
                <Text style={styles.ruleText}>Earn</Text>
                <TextInput
                  value={pointsPerSpend}
                  onChangeText={setPointsPerSpend}
                  keyboardType="numeric"
                  editable={isManager}
                  style={styles.smallInput}
                />
                <Text style={styles.ruleText}>pt(s) for every</Text>
              </View>

              <View style={[styles.ruleRow, { marginTop: 8 }]}>
                <View style={styles.currencyInputBox}>
                  <TextInput
                    value={spendAmountForPoint}
                    onChangeText={setSpendAmountForPoint}
                    keyboardType="numeric"
                    editable={isManager}
                    style={styles.currencyInput}
                  />
                  <Text style={styles.currencySuffix}>FCFA</Text>
                </View>
                <Text style={styles.ruleText}>spent</Text>
              </View>

              <View style={styles.exampleBox}>
                <AlertCircle size={13} color="#4F6748" style={{ marginRight: 6 }} />
                <Text style={styles.exampleText}>
                  Example: 15,000 FCFA = {examplePoints} points
                </Text>
              </View>
            </View>
          </Card>

          {/* ========================================================================= */}
          {/* CARD 2: REDEEM RULE (Exact match with Web View)                           */}
          {/* ========================================================================= */}
          <Card style={styles.ruleCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <Award size={16} color="#4F6748" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Redeem Rule</Text>
                <Text style={styles.cardSubtitle}>
                  Discount value when redeeming loyalty points
                </Text>
              </View>
            </View>

            <View style={styles.innerBox}>
              <View style={styles.ruleRow}>
                <TextInput
                  value={pointsForDiscount}
                  onChangeText={setPointsForDiscount}
                  keyboardType="numeric"
                  editable={isManager}
                  style={styles.mediumInput}
                />
                <Text style={styles.ruleText}>Points =</Text>
                <View style={styles.currencyInputBox}>
                  <TextInput
                    value={discountAmount}
                    onChangeText={setDiscountAmount}
                    keyboardType="numeric"
                    editable={isManager}
                    style={styles.currencyInput}
                  />
                  <Text style={styles.currencySuffix}>FCFA</Text>
                </View>
              </View>

              <Text style={[styles.ruleText, { marginTop: 4, marginBottom: 12 }]}>
                discount
              </Text>

              <View style={styles.divider} />

              <View style={styles.minRedeemRow}>
                <Text style={styles.minRedeemLabel}>Min to Redeem:</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TextInput
                    value={minPointsToRedeem}
                    onChangeText={setMinPointsToRedeem}
                    keyboardType="numeric"
                    editable={isManager}
                    style={styles.smallInput}
                  />
                  <Text style={styles.ruleText}>points</Text>
                </View>
              </View>
            </View>
          </Card>

          {/* ========================================================================= */}
          {/* CARD 3: SERVICE-SPECIFIC EARNING RULES (Exact match with Web View)        */}
          {/* ========================================================================= */}
          <Card style={styles.ruleCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <Layers size={16} color="#4F6748" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Service-Specific Earning Rules</Text>
                <Text style={styles.cardSubtitle}>
                  Fixed points awarded for each spa service (overrides default spending rule)
                </Text>
              </View>
            </View>

            <View style={styles.servicesListContainer}>
              {activeServices.slice(0, 15).map((srv) => {
                const customPoints = servicePoints[srv.name];
                const hasCustom = customPoints !== undefined;

                return (
                  <View key={srv.id} style={styles.serviceRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.serviceName}>{srv.name}</Text>
                      <Text style={styles.serviceCategory}>
                        {srv.category} • {srv.price} FCFA
                      </Text>
                    </View>

                    <View style={styles.serviceActionGroup}>
                      <View style={styles.servicePointBox}>
                        <TextInput
                          placeholder="Default"
                          placeholderTextColor="#A1A1AA"
                          value={hasCustom ? String(customPoints) : ''}
                          onChangeText={(t) => handleServicePointChange(srv.name, t)}
                          keyboardType="numeric"
                          editable={isManager}
                          style={styles.servicePointInput}
                        />
                        <Text style={styles.ptsLabel}>pts</Text>
                      </View>

                      {hasCustom && isManager && (
                        <TouchableOpacity
                          onPress={() => handleRemoveServiceRule(srv.name)}
                          style={styles.trashBtn}
                        >
                          <Trash2 size={14} color="#DC2626" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>

          {/* ========================================================================= */}
          {/* CARD 4: POINTS EXPIRY (Exact match with Web View)                         */}
          {/* ========================================================================= */}
          <Card style={styles.ruleCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <Clock size={16} color="#4F6748" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Points Expiry</Text>
                <Text style={styles.cardSubtitle}>
                  Automatically expire unredeemed points after prolonged inactivity
                </Text>
              </View>
              <Switch
                value={pointsExpiryEnabled}
                onValueChange={setPointsExpiryEnabled}
                disabled={!isManager}
                trackColor={{ false: '#E4E4E7', true: '#C5D8C1' }}
                thumbColor={pointsExpiryEnabled ? '#4F6748' : '#F4F4F5'}
              />
            </View>

            {pointsExpiryEnabled && (
              <View style={styles.innerBox}>
                <View style={styles.ruleRow}>
                  <Text style={styles.ruleText}>Points expire after</Text>
                  <TextInput
                    value={expiryMonths}
                    onChangeText={setExpiryMonths}
                    keyboardType="numeric"
                    editable={isManager}
                    style={styles.smallInput}
                  />
                  <Text style={styles.ruleText}>months of inactivity</Text>
                </View>
              </View>
            )}
          </Card>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C9070',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  saveBtnSuccess: {
    backgroundColor: '#16A34A',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  ruleCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 14,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EAE5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#737373',
    marginTop: 2,
  },
  innerBox: {
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#EFEAE2',
    borderRadius: 12,
    padding: 14,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  ruleText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2D2D2A',
  },
  smallInput: {
    width: 58,
    height: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2A',
    paddingHorizontal: 4,
  },
  mediumInput: {
    width: 72,
    height: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2A',
    paddingHorizontal: 4,
  },
  currencyInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 8,
    height: 38,
    paddingHorizontal: 8,
  },
  currencyInput: {
    minWidth: 64,
    height: 38,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  currencySuffix: {
    fontSize: 11,
    color: '#737373',
    fontWeight: '600',
    marginLeft: 4,
  },
  exampleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EFEAE2',
  },
  exampleText: {
    fontSize: 12,
    color: '#737373',
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: '#EFEAE2',
    marginVertical: 10,
  },
  minRedeemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  minRedeemLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#737373',
  },
  servicesListContainer: {
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#EFEAE2',
    borderRadius: 12,
    overflow: 'hidden',
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEAE2',
  },
  serviceName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D2D2A',
  },
  serviceCategory: {
    fontSize: 11,
    color: '#737373',
    marginTop: 2,
  },
  serviceActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  servicePointBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E2D9',
    borderRadius: 6,
    height: 32,
    paddingHorizontal: 6,
  },
  servicePointInput: {
    width: 48,
    height: 32,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#2D2D2A',
    padding: 0,
  },
  ptsLabel: {
    fontSize: 10,
    color: '#737373',
    fontWeight: '600',
    marginLeft: 2,
  },
  trashBtn: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 13,
    color: '#737373',
    marginTop: 8,
  },
});

export default LoyaltySettingsScreen;

