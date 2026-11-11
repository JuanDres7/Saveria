import type { CategorySlug } from '@saveria/shared';
import {
  ArrowLeftRight,
  Award,
  Banknote,
  Bus,
  Car,
  CirclePlus,
  Clapperboard,
  Ellipsis,
  FileText,
  Gift,
  GraduationCap,
  HandHeart,
  HeartPulse,
  House,
  Laptop,
  type LucideIcon,
  PawPrint,
  Plane,
  Repeat,
  Scale,
  Scissors,
  ShoppingBag,
  ShoppingCart,
  Store,
  TrendingUp,
  Undo2,
  Users,
  Utensils,
  Zap,
} from 'lucide-react-native';

/**
 * Tono del círculo de una categoría (FR-009): `sand` comida y compras, `mist` movilidad y viajes,
 * `clay` salud y personas, `base` casa, obligaciones e ingresos, `neutral` lo que no es de ninguna.
 */
export type Tone = 'base' | 'sand' | 'mist' | 'clay' | 'neutral';

export interface CategoryVisual {
  /** Nombre del ícono en lucide */
  name: string;
  icon: LucideIcon;
  tone: Tone;
}

const visual = (name: string, icon: LucideIcon, tone: Tone): CategoryVisual => ({
  name,
  icon,
  tone,
});

/** Ícono y tono de cada categoría, por `slug` (nunca por el nombre visible). Ver data-model.md. */
export const CATEGORY_VISUALS: Record<CategorySlug, CategoryVisual> = {
  groceries: visual('ShoppingCart', ShoppingCart, 'sand'),
  dining: visual('Utensils', Utensils, 'sand'),
  shopping: visual('ShoppingBag', ShoppingBag, 'sand'),
  gifts: visual('Gift', Gift, 'sand'),
  entertainment: visual('Clapperboard', Clapperboard, 'sand'),
  transport: visual('Bus', Bus, 'mist'),
  vehicle: visual('Car', Car, 'mist'),
  travel: visual('Plane', Plane, 'mist'),
  health: visual('HeartPulse', HeartPulse, 'clay'),
  personal_care: visual('Scissors', Scissors, 'clay'),
  education: visual('GraduationCap', GraduationCap, 'clay'),
  pets: visual('PawPrint', PawPrint, 'clay'),
  housing: visual('House', House, 'base'),
  utilities: visual('Zap', Zap, 'base'),
  home_family: visual('Users', Users, 'base'),
  subscriptions: visual('Repeat', Repeat, 'base'),
  fees_taxes: visual('FileText', FileText, 'base'),
  other_expense: visual('Ellipsis', Ellipsis, 'neutral'),
  salary: visual('Banknote', Banknote, 'base'),
  bonus: visual('Award', Award, 'base'),
  freelance: visual('Laptop', Laptop, 'base'),
  business: visual('Store', Store, 'base'),
  investments: visual('TrendingUp', TrendingUp, 'base'),
  gifts_received: visual('HandHeart', HandHeart, 'base'),
  refunds: visual('Undo2', Undo2, 'base'),
  other_income: visual('CirclePlus', CirclePlus, 'base'),
};

/** Las transferencias y los ajustes de saldo no llevan categoría: tienen su propio ícono. */
export const TRANSFER_VISUAL = visual('ArrowLeftRight', ArrowLeftRight, 'neutral');
export const ADJUSTMENT_VISUAL = visual('Scale', Scale, 'neutral');

const FALLBACK = visual('Ellipsis', Ellipsis, 'neutral');

/** El ícono y el tono de un `slug`; si no se conoce, el neutro de «otros». */
export function visualForSlug(slug: string | null | undefined): CategoryVisual {
  if (!slug) return FALLBACK;
  return (CATEGORY_VISUALS as Record<string, CategoryVisual>)[slug] ?? FALLBACK;
}
