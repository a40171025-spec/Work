import { FREE_SHIPPING_QTY, PAIR_BOX, PAIR_NO_BOX, PRICE_BOX, PRICE_NO_BOX, SHIPPING_FEE } from './site';

export type CartLine = { slug: string; withBox: boolean; qty: number };
export type Totals = ReturnType<typeof calcTotals>;

/** Pair deal applies per box option: every 2 with box = ₪499, every 2 without = ₪332. */
export function calcTotals(lines: CartLine[]) {
  const boxQty = lines.filter((l) => l.withBox).reduce((s, l) => s + l.qty, 0);
  const noBoxQty = lines.filter((l) => !l.withBox).reduce((s, l) => s + l.qty, 0);
  const qty = boxQty + noBoxQty;
  const subtotal = boxQty * PRICE_BOX + noBoxQty * PRICE_NO_BOX;
  const discount =
    Math.floor(boxQty / 2) * (PRICE_BOX * 2 - PAIR_BOX) +
    Math.floor(noBoxQty / 2) * (PRICE_NO_BOX * 2 - PAIR_NO_BOX);
  const shipping = qty === 0 || qty >= FREE_SHIPPING_QTY ? 0 : SHIPPING_FEE;
  return { qty, subtotal, discount, shipping, total: subtotal - discount + shipping };
}
