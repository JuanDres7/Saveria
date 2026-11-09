import { useCallback, useEffect, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { styles as base } from '../../../features/auth/components';
import { Chip, chipRow } from '../../../features/transactions/Chip';
import {
  groupByDay,
  openLedgerContext,
  refreshLedger,
  useLedger,
} from '../../../features/transactions/ledger';
import type { LocalTransactionRecord } from '../../../features/transactions/local-transactions';
import { DayHeader, TransactionRow } from '../../../features/transactions/RecentList';
import { colors } from '../../../theme';

const PAGE = 50;

/**
 * Historial completo (historia 2): por día, del más reciente al más antiguo, de 50 en 50 y con
 * filtro por cuenta. Todo sale de la base local, así que funciona sin conexión (2.6).
 */
export default function History() {
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
    <View style={styles.screen}>
      <Text role="heading" style={base.title}>
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
        ListEmptyComponent={<Text>Todavía no hay movimientos.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, paddingTop: 48, gap: 12 },
  count: { color: colors.textMuted, fontSize: 13 },
});
