import { CATEGORIES } from '@saveria/shared';
import * as Lucide from 'lucide-react-native';
import {
  ADJUSTMENT_VISUAL,
  CATEGORY_VISUALS,
  type CategoryVisual,
  TRANSFER_VISUAL,
  visualForSlug,
} from '../src/ui/category-icons';

const lucide = Lucide as unknown as Record<string, unknown>;

// Tabla de data-model.md: ícono y tono de cada categoría.
const EXPECTED: Record<string, [icon: string, tone: CategoryVisual['tone']]> = {
  groceries: ['ShoppingCart', 'sand'],
  dining: ['Utensils', 'sand'],
  shopping: ['ShoppingBag', 'sand'],
  gifts: ['Gift', 'sand'],
  entertainment: ['Clapperboard', 'sand'],
  transport: ['Bus', 'mist'],
  vehicle: ['Car', 'mist'],
  travel: ['Plane', 'mist'],
  health: ['HeartPulse', 'clay'],
  personal_care: ['Scissors', 'clay'],
  education: ['GraduationCap', 'clay'],
  pets: ['PawPrint', 'clay'],
  housing: ['House', 'base'],
  utilities: ['Zap', 'base'],
  home_family: ['Users', 'base'],
  subscriptions: ['Repeat', 'base'],
  fees_taxes: ['FileText', 'base'],
  other_expense: ['Ellipsis', 'neutral'],
  salary: ['Banknote', 'base'],
  bonus: ['Award', 'base'],
  freelance: ['Laptop', 'base'],
  business: ['Store', 'base'],
  investments: ['TrendingUp', 'base'],
  gifts_received: ['HandHeart', 'base'],
  refunds: ['Undo2', 'base'],
  other_income: ['CirclePlus', 'base'],
};

describe('ícono y tono de cada categoría (FR-009)', () => {
  it('cubre las 26 categorías del catálogo y ninguna más', () => {
    expect(CATEGORIES).toHaveLength(26);
    expect(Object.keys(CATEGORY_VISUALS).sort()).toEqual(CATEGORIES.map((c) => c.slug).sort());
  });

  it.each(CATEGORIES.map((c) => c.slug))('%s tiene el ícono y el tono de data-model.md', (slug) => {
    const [name, tone] = EXPECTED[slug] ?? [];
    const visual = visualForSlug(slug);
    expect(visual.name).toBe(name);
    expect(visual.tone).toBe(tone);
    expect(visual.icon).toBe(lucide[visual.name]);
  });

  it('la transferencia y el ajuste de saldo tienen su propio ícono, en tono neutro', () => {
    expect(TRANSFER_VISUAL).toMatchObject({ name: 'ArrowLeftRight', tone: 'neutral' });
    expect(ADJUSTMENT_VISUAL).toMatchObject({ name: 'Scale', tone: 'neutral' });
    for (const visual of [TRANSFER_VISUAL, ADJUSTMENT_VISUAL]) {
      expect(visual.icon).toBe(lucide[visual.name]);
    }
  });

  it('un slug desconocido o ausente cae en el ícono y el tono neutros', () => {
    for (const slug of ['no-existe', '', null, undefined]) {
      expect(visualForSlug(slug)).toMatchObject({ name: 'Ellipsis', tone: 'neutral' });
    }
  });
});
