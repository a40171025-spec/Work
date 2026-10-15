// Store-wide facts. Prices and contact details come from the existing site.
export const SITE_URL = 'https://luminous-gnome-bc5de4.netlify.app';
export const SITE_NAME = 'Paradise Watch';

export const PHONE_DISPLAY = '053-532-5643';
export const WA_NUMBER = '972535325643';
export const INSTAGRAM = 'paradise_watch_1';
export const INSTAGRAM_URL = 'https://www.instagram.com/paradise_watch_1/';

export const PRICE_BOX = 299;
export const PRICE_NO_BOX = 199;
export const PAIR_BOX = 499;
export const PAIR_NO_BOX = 332;
export const SHIPPING_FEE = 50;
export const FREE_SHIPPING_QTY = 3;

export const waLink = (text?: string) =>
  `https://wa.me/${WA_NUMBER}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export const ils = (n: number) => `₪${n.toLocaleString('he-IL')}`;

export const boxLabel = (withBox: boolean) => (withBox ? 'קופסה ממותגת' : 'קופסה קטנה ורגילה');

export const abs = (path: string) => `${SITE_URL}${path}`;
