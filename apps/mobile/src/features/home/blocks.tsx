import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type Theme, useStyles } from '../../theme';
import { BrandMark } from '../../ui/BrandMark';
import { type SectionAction, SectionHeader } from '../../ui/SectionHeader';
import { AccountsRow, type AccountTileItem } from '../accounts/AccountTile';
import { BalanceCard } from '../accounts/BalanceCard';
import type { BalanceCardData } from '../accounts/balance-card';
import type { LocalAccountRecord } from '../accounts/local-accounts';
import type { DaySection } from '../transactions/ledger';
import { DaySections } from '../transactions/RecentList';
import { VerifyBanner } from '../verification/VerifyBanner';

/** Todo lo que los bloques de Inicio necesitan para dibujarse. */
export interface HomeContext {
  name: string;
  emailVerified: boolean;
  /** Con moneda principal se puede registrar y transferir; sin ella no */
  hasPrimaryCurrency: boolean;
  card: BalanceCardData | null;
  /** Las cuentas activas que se dibujan (la del perfil mientras la base local no tenga ninguna) */
  tiles: readonly AccountTileItem[];
  /** Cuántas cuentas activas hay: «Transferir» necesita dos */
  activeCount: number;
  accounts: readonly LocalAccountRecord[];
  sections: readonly DaySection[];
}

type Zone = 'top' | 'sheet';

interface HomeBlock {
  key: string;
  zone: Zone;
  /** Cada bloque aparece solo si su función existe y tiene algo que mostrar */
  visible(ctx: HomeContext): boolean;
  render(ctx: HomeContext): ReactNode;
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    greeting: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    greetingText: { flex: 1, gap: 2 },
    title: { ...t.type.title, color: t.colors.text },
    subtitle: { ...t.type.caption, color: t.colors.textMuted },
    empty: { ...t.type.body, color: t.colors.textMuted },
    block: { gap: 8 },
  });

function Greeting({ name }: { name: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.greeting}>
      <View style={styles.greetingText}>
        <Text role="heading" style={styles.title}>{`Hola, ${name}`}</Text>
        <Text style={styles.subtitle}>Así va tu plata hoy</Text>
      </View>
      <BrandMark />
    </View>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: SectionAction;
  children: ReactNode;
}) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.block}>
      <SectionHeader title={title} action={action} />
      {children}
    </View>
  );
}

function EmptyMessage() {
  const styles = useStyles(makeStyles);
  return (
    <Text style={styles.empty}>
      Aún no tienes movimientos. Toca el botón + para registrar el primero.
    </Text>
  );
}

/**
 * Los bloques de Inicio, en el orden fijo del mapa de la app (docs/mapa-de-la-app.md). Los bloques de
 * las funciones que llegan después (barra para contarle a Saveria, «Por confirmar», «Este mes»,
 * «Próximos») entrarán en su lugar sin mover a los demás.
 */
export const HOME_BLOCKS: readonly HomeBlock[] = [
  {
    key: 'home-block-greeting',
    zone: 'top',
    visible: () => true,
    render: (ctx) => <Greeting name={ctx.name} />,
  },
  {
    key: 'home-block-verify',
    zone: 'top',
    visible: (ctx) => !ctx.emailVerified,
    render: () => <VerifyBanner />,
  },
  {
    key: 'home-block-balance',
    zone: 'top',
    visible: (ctx) => ctx.card !== null,
    render: (ctx) =>
      ctx.card ? (
        <BalanceCard
          card={ctx.card}
          onTransfer={
            ctx.hasPrimaryCurrency && ctx.activeCount >= 2
              ? () => router.push('/transfer')
              : undefined
          }
        />
      ) : null,
  },
  {
    key: 'home-block-accounts',
    zone: 'sheet',
    visible: (ctx) => ctx.tiles.length > 0,
    render: (ctx) => (
      <Section
        title="Tus cuentas"
        action={{
          label: 'Ver todas',
          accessibilityLabel: 'Ver todas las cuentas',
          onPress: () => router.push('/accounts'),
        }}
      >
        <AccountsRow items={ctx.tiles} />
      </Section>
    ),
  },
  {
    key: 'home-block-recent',
    zone: 'sheet',
    visible: (ctx) => ctx.sections.length > 0,
    render: (ctx) => (
      <Section
        title="Últimos movimientos"
        action={{ label: 'Ver todo', onPress: () => router.push('/transactions') }}
      >
        <DaySections sections={ctx.sections} accounts={ctx.accounts} />
      </Section>
    ),
  },
  {
    key: 'home-block-empty',
    zone: 'sheet',
    visible: (ctx) => ctx.sections.length === 0 && ctx.hasPrimaryCurrency,
    render: () => <EmptyMessage />,
  },
];

/** Los bloques que se ven ahora en una zona de Inicio, ya con su `testID`. */
export function visibleBlocks(ctx: HomeContext, zone: Zone): { key: string; node: ReactNode }[] {
  return HOME_BLOCKS.filter((block) => block.zone === zone && block.visible(ctx)).map((block) => ({
    key: block.key,
    node: block.render(ctx),
  }));
}
