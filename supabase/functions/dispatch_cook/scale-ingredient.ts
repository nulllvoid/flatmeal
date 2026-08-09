// Mirrors app/src/lib/scale-ingredient.ts's rounding rules (piece-like units
// round up since you can't buy half an onion; weight/volume round to a
// sensible shopping precision). Duplicated rather than shared because Deno
// edge functions and the Expo app don't share a module graph.
// `quantity` is the cart line's own quantity (previously flat-wide
// headcount) — each dish now scales by its own cart quantity, not a shared
// flat headcount.
export function scaleIngredientLabel(qtyPerPerson: number, unit: string, quantity: number): string {
  const raw = qtyPerPerson * quantity;

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
