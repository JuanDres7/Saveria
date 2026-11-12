import { useCallback, useEffect, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { Body } from '../../../features/auth/components';
import { Chip, chipRow } from '../../../features/transactions/Chip';
import {
  groupByDay,
  openLedgerContext,
  refreshLedger,
  useLedger,
} from '../../../features/transactions/ledger';
import type { LocalTransactionRecord } from '../../../features/transactions/local-transactions';
import { DayHeader, TransactionRow } from '../../../features/transactions/RecentList';
import { type Theme, useStyles } from '../../../theme';
import { ScreenBackground } from '../../../ui/ScreenBackground';

const PAGE = 50;

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    top: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14, gap: 10 },
    title: { ...t.type.title, color: t.colors.text },
    count: { ...t.type.caption, color: t.colors.textMuted },
    sheet: {
      flex: 1,
      backgroundColor: t.colors.surface,
      borderTopLeftRadius: t.radius.sheet,
      borderTopRightRadius: t.radius.sheet,
      paddingHorizontal: 16,
    },
    list: { paddingBottom: 40 },
    empty: { gap: 4, paddingTop: 20 },
  });

/**
 * Historial completo (historia 2): por día, del más reciente al más antiguo, de 50 en 50 y con
 * filtro por cuenta. Todo sale de la base local, así que funciona sin conexión (2.6). Es una
 * sección de la barra inferior.
 */
export default function History() {
  const styles = useStyles(makeStyles);
  const accounts = useLedger((s) => s.accounts);
  // Cambia con cada registro o envío: se vuelve a leer la página desde el principio.
  const recent = useLedger((s) => s.recent);
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<LocalTransactionRecord[]>([]);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => refreshLedger(), []);

  const load = useCallback(
    (offset: number) => {
      const page = openLedgerContext()?.ledger.history({ accountId, limit: PAGE, offset }) ?? [];
      setRows((current) => (offset === 0 ? page : [...current, ...page]));
      setHasMore(page.length === PAGE);
    },
    [accountId],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: `recent` solo avisa que hubo cambios.
  useEffect(() => load(0), [load, recent]);

  return (
    <ScreenBackground edges={['top']}>
      <View style={styles.top}>
        <Text role="heading" style={styles.title}>
          Historial
        </Text>
        <View style={chipRow}>
          <Chip
            label="Todas"
            checked={accountId === undefined}
            onPress={() => setAccountId(undefined)}
          />
          {accounts.map((account) => (
            <Chip
              key={account.id}
              label={account.name}
              checked={accountId === account.id}
              onPress={() => setAccountId(account.id)}
            />
          ))}
        </View>
        <Text style={styles.count}>{`Mostrando ${rows.length} movimientos`}</Text>
      </View>
      <View style={styles.sheet}>
        <SectionList
          testID="history-list"
          sections={groupByDay(rows)}
          keyExtractor={(tx) => tx.id}
          renderSectionHeader={({ section }) => <DayHeader title={section.title} />}
          renderItem={({ item }) => (
            <TransactionRow tx={item} accounts={accounts} fromAccountId={accountId} />
          )}
          onEndReached={() => {
            if (hasMore) load(rows.length);
          }}
          onEndReachedThreshold={0.5}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Body>Todavía no hay movimientos.</Body>
              <Body muted>Cuando registres uno, aparecerá aquí.</Body>
            </View>
          }
        />
      </View>
    </ScreenBackground>
  );
}
