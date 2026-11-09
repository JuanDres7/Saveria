/**
 * Categorías fijas del producto (docs/vision-fase-0.md, Constitución V). No hay categorías creadas
 * por el usuario. El `slug` es estable y es lo que se guarda; el nombre visible puede cambiar.
 */
export type CategoryType = 'expense' | 'income';

export type CategorySlug =
  | 'groceries'
  | 'dining'
  | 'transport'
  | 'vehicle'
  | 'housing'
  | 'utilities'
  | 'health'
  | 'personal_care'
  | 'education'
  | 'subscriptions'
  | 'entertainment'
  | 'shopping'
  | 'home_family'
  | 'pets'
  | 'gifts'
  | 'travel'
  | 'fees_taxes'
  | 'other_expense'
  | 'salary'
  | 'bonus'
  | 'freelance'
  | 'business'
  | 'investments'
  | 'gifts_received'
  | 'refunds'
  | 'other_income';

export interface Category {
  slug: CategorySlug;
  name: string;
  type: CategoryType;
}

export const CATEGORIES: readonly Category[] = [
  { slug: 'groceries', name: 'Mercado', type: 'expense' },
  { slug: 'dining', name: 'Restaurantes y domicilios', type: 'expense' },
  { slug: 'transport', name: 'Transporte', type: 'expense' },
  { slug: 'vehicle', name: 'Vehículo', type: 'expense' },
  { slug: 'housing', name: 'Vivienda', type: 'expense' },
  { slug: 'utilities', name: 'Servicios del hogar', type: 'expense' },
  { slug: 'health', name: 'Salud', type: 'expense' },
  { slug: 'personal_care', name: 'Cuidado personal', type: 'expense' },
  { slug: 'education', name: 'Educación', type: 'expense' },
  { slug: 'subscriptions', name: 'Suscripciones', type: 'expense' },
  { slug: 'entertainment', name: 'Entretenimiento', type: 'expense' },
  { slug: 'shopping', name: 'Ropa y compras', type: 'expense' },
  { slug: 'home_family', name: 'Hogar y familia', type: 'expense' },
  { slug: 'pets', name: 'Mascotas', type: 'expense' },
  { slug: 'gifts', name: 'Regalos y donaciones', type: 'expense' },
  { slug: 'travel', name: 'Viajes', type: 'expense' },
  { slug: 'fees_taxes', name: 'Impuestos y trámites', type: 'expense' },
  { slug: 'other_expense', name: 'Otros gastos', type: 'expense' },
  { slug: 'salary', name: 'Salario', type: 'income' },
  { slug: 'bonus', name: 'Primas y bonos', type: 'income' },
  { slug: 'freelance', name: 'Trabajo independiente', type: 'income' },
  { slug: 'business', name: 'Ventas y negocio', type: 'income' },
  { slug: 'investments', name: 'Rendimientos', type: 'income' },
  { slug: 'gifts_received', name: 'Apoyos y regalos', type: 'income' },
  { slug: 'refunds', name: 'Reembolsos', type: 'income' },
  { slug: 'other_income', name: 'Otros ingresos', type: 'income' },
];

const BY_SLUG: ReadonlyMap<string, Category> = new Map(CATEGORIES.map((c) => [c.slug, c]));

export function categoriesFor(type: CategoryType): Category[] {
  return CATEGORIES.filter((c) => c.type === type);
}

export function categoryBySlug(slug: string): Category | undefined {
  return BY_SLUG.get(slug);
}

export function isCategoryOfType(slug: string, type: CategoryType): slug is CategorySlug {
  return BY_SLUG.get(slug)?.type === type;
}
