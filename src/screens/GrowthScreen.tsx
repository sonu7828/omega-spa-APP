import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  MessageSquare,
  Award,
  Star,
  Users,
  Send,
  CheckCircle,
} from 'lucide-react-native';
import THEME from '../constants/theme';
import Header from '../components/Header';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Input from '../components/Input';
import { whatsappApi, feedbackApi } from '../services/api';
import { useJobSeekers } from '../context/JobSeekersContext';

export const GrowthScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'WHATSAPP' | 'LOYALTY' | 'FEEDBACK' | 'RECRUIT'>('WHATSAPP');
  const [logs, setLogs] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const { jobSeekers, refreshJobSeekers, updateJobSeekerStatus } = useJobSeekers();

  // Test WhatsApp message state
  const [testPhone, setTestPhone] = useState<string>('');
  const [testMessage, setTestMessage] = useState<string>('Hello from OMEGA SPA POS! Your appointment is confirmed.');
  const [sending, setSending] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsRes, fbRes] = await Promise.all([
        whatsappApi.getLogs().catch(() => null),
        feedbackApi.getAll().catch(() => null),
      ]);

      if (logsRes) {
        const l = logsRes?.data || (Array.isArray(logsRes) ? logsRes : []);
        setLogs(l.slice(0, 15));
      }

      if (fbRes) {
        const fb = fbRes?.data || (Array.isArray(fbRes) ? fbRes : []);
        setFeedbacks(fb);
      }
    } catch (e) {
      console.warn('Failed to load growth data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSendTestWhatsApp = async () => {
    if (!testPhone) {
      Alert.alert('Required', 'Please enter a phone number with country code (e.g. 2376XXXXXXXX).');
      return;
    }
    try {
      setSending(true);
      await whatsappApi.sendMessage({
        phone: testPhone,
        message: testMessage,
      });
      setSending(false);
      Alert.alert('Sent', 'WhatsApp message dispatched through Meta Cloud API!');
      loadData();
    } catch (e: any) {
      setSending(false);
      Alert.alert('Error', e?.message || 'Failed to dispatch WhatsApp message.');
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Marketing & Growth"
        subtitle="Automations, loyalty & feedback"
      />

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => setActiveTab('WHATSAPP')}
          style={[styles.tab, activeTab === 'WHATSAPP' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'WHATSAPP' && styles.tabTextActive]}>
            WhatsApp
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('LOYALTY')}
          style={[styles.tab, activeTab === 'LOYALTY' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'LOYALTY' && styles.tabTextActive]}>
            Loyalty
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('FEEDBACK')}
          style={[styles.tab, activeTab === 'FEEDBACK' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'FEEDBACK' && styles.tabTextActive]}>
            Feedback
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('RECRUIT')}
          style={[styles.tab, activeTab === 'RECRUIT' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'RECRUIT' && styles.tabTextActive]}>
            Hiring
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              loadData();
              refreshJobSeekers();
            }}
            tintColor={THEME.colors.primaryDark}
          />
        }
      >
        {activeTab === 'WHATSAPP' && (
          <View>
            <Card>
              <Text style={styles.sectionTitle}>Dispatch Direct WhatsApp</Text>
              <Input
                label="Recipient Phone (with country code)"
                placeholder="e.g. 237699123456"
                value={testPhone}
                onChangeText={setTestPhone}
                keyboardType="phone-pad"
              />
              <Input
                label="Message Content"
                value={testMessage}
                onChangeText={setTestMessage}
                multiline
                numberOfLines={3}
              />
              <Button
                title="Send WhatsApp Message"
                icon={<Send size={16} color={THEME.colors.primaryDark} />}
                onPress={handleSendTestWhatsApp}
                loading={sending}
                variant="primary"
              />
            </Card>

            <Text style={[styles.sectionTitle, { marginTop: 12, marginBottom: 8 }]}>
              Recent Delivery Logs
            </Text>
            {logs.map((log, idx) => (
              <Card key={idx} style={styles.logCard}>
                <View style={styles.logTop}>
                  <Text style={styles.logPhone}>{log.phone || 'Recipient'}</Text>
                  <Badge
                    label={log.status || 'DELIVERED'}
                    variant={log.status === 'FAILED' ? 'danger' : 'success'}
                  />
                </View>
                <Text style={styles.logMsg} numberOfLines={2}>
                  {log.message || log.automationType || 'Automated message'}
                </Text>
              </Card>
            ))}
          </View>
        )}

        {activeTab === 'LOYALTY' && (
          <View>
            <Card>
              <Text style={styles.sectionTitle}>Loyalty Program Rules</Text>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleLabel}>Points Earn Rate</Text>
                <Text style={styles.ruleValue}>1 Point for every 1 000 FCFA spent</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleLabel}>Redemption Rate</Text>
                <Text style={styles.ruleValue}>100 Points = 5 000 FCFA Discount</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleLabel}>Birthday Bonus</Text>
                <Text style={styles.ruleValue}>50 Bonus Points + 15% discount</Text>
              </View>
            </Card>
          </View>
        )}

        {activeTab === 'FEEDBACK' && (
          <View>
            <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>
              Client Reviews & Satisfaction
            </Text>
            {feedbacks.length === 0 ? (
              <Card style={{ alignItems: 'center', paddingVertical: 30 }}>
                <Star size={32} color={THEME.colors.warning} />
                <Text style={{ marginTop: 8, color: THEME.colors.textMuted }}>
                  No feedback reviews submitted yet.
                </Text>
              </Card>
            ) : (
              feedbacks.map((f, idx) => (
                <Card key={idx} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontWeight: '700', color: THEME.colors.text }}>
                      {f.client?.name || 'Anonymous Client'}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 2 }}>
                      {[...Array(f.rating || 5)].map((_, i) => (
                        <Star key={i} size={14} color={THEME.colors.warning} fill={THEME.colors.warning} />
                      ))}
                    </View>
                  </View>
                  {f.comment ? (
                    <Text style={{ fontSize: 13, color: THEME.colors.text, marginTop: 6 }}>
                      "{f.comment}"
                    </Text>
                  ) : null}
                </Card>
              ))
            )}
          </View>
        )}

        {activeTab === 'RECRUIT' && (
          <View>
            <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>
              Applicant Hiring Pipeline
            </Text>
            {jobSeekers.map((j) => (
              <Card key={j.id} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: THEME.colors.text }}>
                      {j.fullName}
                    </Text>
                    <Text style={{ fontSize: 12, color: THEME.colors.textMuted }}>
                      {j.positionApplied} • {j.experienceYears || 1} yrs exp
                    </Text>
                    <Text style={{ fontSize: 12, color: THEME.colors.primaryDark, marginTop: 2 }}>
                      {j.phone}
                    </Text>
                  </View>
                  <Badge label={j.status} variant="info" />
                </View>

                {j.status === 'NEW' && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <Button
                      title="Schedule Interview"
                      size="sm"
                      variant="primary"
                      onPress={() => updateJobSeekerStatus(j.id, 'INTERVIEW_SCHEDULED')}
                      style={{ flex: 1 }}
                    />
                    <Button
                      title="Shortlist"
                      size="sm"
                      variant="outline"
                      onPress={() => updateJobSeekerStatus(j.id, 'SHORTLISTED')}
                      style={{ flex: 1 }}
                    />
                  </View>
                )}
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: THEME.colors.primaryDark,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  tabTextActive: {
    color: THEME.colors.primaryDark,
    fontWeight: '700',
  },
  scrollContent: {
    padding: THEME.spacing.lg,
  },
  sectionTitle: {
    fontSize: THEME.typography.sizes.base,
    fontWeight: '700',
    color: THEME.colors.text,
    marginBottom: 8,
  },
  logCard: {
    marginBottom: 8,
    padding: 10,
  },
  logTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  logPhone: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  logMsg: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  ruleItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  ruleLabel: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  ruleValue: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
    marginTop: 2,
  },
});

export default GrowthScreen;

