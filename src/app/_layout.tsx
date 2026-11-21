import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../context/AuthContext';
import { ClientsProvider } from '../context/ClientsContext';
import { AppointmentsProvider } from '../context/AppointmentsContext';
import { InvoiceProvider } from '../context/InvoiceContext';
import { AttendanceProvider } from '../context/AttendanceContext';
import { StockProvider } from '../context/StockContext';
import { CommissionProvider } from '../context/CommissionContext';
import { ExpensesProvider } from '../context/ExpensesContext';
import { ReportsProvider } from '../context/ReportsContext';
import { CleaningProvider } from '../context/CleaningContext';
import { JobSeekersProvider } from '../context/JobSeekersContext';
import { ServicesProvider } from '../context/ServicesContext';
import { Slot } from 'expo-router';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ServicesProvider>
          <ClientsProvider>
            <AppointmentsProvider>
              <InvoiceProvider>
                <AttendanceProvider>
                  <StockProvider>
                    <CommissionProvider>
                      <ExpensesProvider>
                        <ReportsProvider>
                          <CleaningProvider>
                            <JobSeekersProvider>
                              <StatusBar style="dark" />
                              <Slot />
                            </JobSeekersProvider>
                          </CleaningProvider>
                        </ReportsProvider>
                      </ExpensesProvider>
                    </CommissionProvider>
                  </StockProvider>
                </AttendanceProvider>
              </InvoiceProvider>
            </AppointmentsProvider>
          </ClientsProvider>
        </ServicesProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
