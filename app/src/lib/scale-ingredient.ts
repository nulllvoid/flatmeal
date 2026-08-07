import type { IngredientUnit } from '@/types/domain';

// Renders a scaled quantity as a buyable label (CLAUDE.md: "Ingredient
// quantities are stored per-person; UI multiplies by headcount. Units must
// be purchasable"). Piece-like units round up to whole units since you
// can't buy half an onion; weight/volume/spoon units round to a sensible
// precision for shopping.
export function scaleIngredient(qtyPerPerson: number, unit: IngredientUnit, headcount: number): string {
  const raw = qtyPerPerson * headcount;

  switch (unit) {
    case 'piece':
    case 'bunch':
    case 'packet':
      return `${Math.ceil(raw)} ${unit === 'piece' ? '' : unit}`.trim();
    case 'g':
    case 'ml':
      return `${Math.round(raw / 5) * 5} ${unit}`;
    case 'cup':
    case 'tbsp':
    case 'tsp':
      return `${roundToQuarter(raw)} ${unit}`;
    default:
      return `${raw} ${unit}`;
  }
}

function roundToQuarter(value: number): string {
  const rounded = Math.round(value * 4) / 4;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
