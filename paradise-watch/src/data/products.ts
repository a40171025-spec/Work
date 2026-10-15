// Product catalogue. Names, descriptions and specs come from the existing site.
// Photos live in public/assets/img and are built by scripts/build_images.py.
import counts from './image-counts.json';
import { SITE_URL } from './site';

export type Gender = 'men' | 'women';
export type Spec = { label: string; value: string };
export type Product = {
  slug: string;
  name: string;
  gender: Gender;
  preorder: boolean;
  description: string;
  specs: Spec[];
  /** number of real photos available (0 = no photo yet) */
  photos: number;
  /** kept in the data but not shown anywhere until the owner decides */
  hidden?: boolean;
};

const base = (extra: Spec[]): Spec[] => [
  ...extra,
  { label: 'עמידות למים', value: 'התזות קלות בלבד (כמו שטיפת ידיים)' },
  { label: 'אריזה', value: 'לבחירה: עם קופסה ממותגת או בלי' },
];

type Seed = [slug: string, name: string, desc: string, specs: [string, string][], opts?: Partial<Product>];

const seeds: Seed[] = [
  ['aurelia-turquoise', 'Aurelia Turquoise', 'שעון במראה יוקרתי עם חוגה בגוון טורקיז מרענן ורצועת מתכת מבריקה — נוכחות שאי אפשר לפספס.', [['חוגה', 'טורקיז'], ['רצועה', 'מתכת']]],
  ['petite-roma', 'Petite Roma', 'שעון נשים עדין ואלגנטי במידה קטנה ומחמיאה, לכל יום ולכל אירוע.', [['סגנון', 'נשים · עדין'], ['רצועה', 'מתכת']], { gender: 'women' }],
  // The photos show a brown strap (not metal) on the three Regent Rose models.
  ['regent-rose', 'Regent Rose', 'גימור זהב ורוד חם ועיצוב קלאסי — אלגנטיות שקטה על פרק היד.', [['גוון', 'זהב ורוד'], ['רצועה', 'עור חומה']]],
  ['monarch-ice', 'Monarch Ice', 'חוגה בגוון קרח בהיר ומארז מתכתי מלוטש — מראה נקי וחד.', [['חוגה', 'תכלת קרח'], ['רצועה', 'מתכת']]],
  ['regent-two-tone', 'Regent Two-Tone', 'שילוב של כסף וזהב בעיצוב דו־גוני קלאסי ומרשים.', [['גוון', 'דו־גוני כסף/זהב'], ['רצועה', 'מתכת']]],
  ['aurelia-forest', 'Aurelia Forest', 'חוגה ירוקה עמוקה בהשראת יער — בחירה בטוחה לסטייל ייחודי.', [['חוגה', 'ירוק יער'], ['רצועה', 'מתכת']]],
  ['regent-rose-noir', 'Regent Rose Noir', 'זהב ורוד מול חוגה שחורה — ניגוד דרמטי ויוקרתי.', [['גוון', 'זהב ורוד ושחור'], ['רצועה', 'עור חומה']]],
  ['regent-rose-emerald', 'Regent Rose Emerald', 'זהב ורוד עם חוגה בירוק אמרלד — שילוב צבעים עשיר.', [['גוון', 'זהב ורוד ואמרלד'], ['רצועה', 'עור חומה']]],
  ['monarch-blue', 'Monarch Blue', 'חוגה כחולה עמוקה ומארז מתכתי — קלאסיקה מודרנית.', [['חוגה', 'כחול'], ['רצועה', 'מתכת']]],
  ['octa-midnight', 'Octa Midnight', 'מארז מתומן וחוגה בגוון חצות — עיצוב גיאומטרי נועז.', [['מארז', 'מתומן'], ['חוגה', 'כחול חצות']]],
  ['paradise-skeleton-noir', 'Paradise Skeleton Noir', 'חוגה שקופה בסגנון סקלטון שחושפת את הפרטים, בגימור שחור.', [['סגנון', 'סקלטון'], ['גוון', 'שחור']]],
  ['paradise-skeleton-silver', 'Paradise Skeleton Silver', 'סקלטון בגימור כסוף — מכני למראה, מרשים מכל זווית.', [['סגנון', 'סקלטון'], ['גוון', 'כסף']]],
  ['marina-orange', 'Marina Orange', 'שעון בהשראה ימית עם נגיעות כתום — ספורטיבי ושמח.', [['סגנון', 'ספורטיבי'], ['גוון', 'כתום']]],
  ['marina-rose', 'Marina Rose', 'קו Marina בגוון ורוד — ספורטיבי עם טוויסט רך.', [['סגנון', 'ספורטיבי'], ['גוון', 'ורוד']]],
  ['marina-noir', 'Marina Noir', 'קו Marina בשחור מלא — חזק, נקי ומתאים לכל לוק.', [['סגנון', 'ספורטיבי'], ['גוון', 'שחור']]],
  ['regent-navy', 'Regent Navy', 'חוגה בכחול נייבי ועיצוב Regent הקלאסי.', [['חוגה', 'כחול נייבי'], ['רצועה', 'מתכת']], { preorder: true }],
  ['urban-black', 'Urban Black', 'מראה עירוני שחור ומינימליסטי לכל יום.', [['גוון', 'שחור'], ['סגנון', 'עירוני']], { preorder: true }],
  // Present in the old code; their photos are not used in the new design. Hidden until the owner decides.
  ['nautica-rose', 'Nautica Rose', 'צמיד פלדת אל־חלד בזהב ורוד, מארז מרובע־מתומן עם בזל מוברש (frosted), חוגה חומה כהה עם קווים אופקיים, סמנים זוהרים וחלון תאריך.', [['מארז', 'מרובע־מתומן, זהב ורוד'], ['בזל', 'מוברש (frosted)'], ['חוגה', 'חום כהה עם קווים אופקיים'], ['סמנים', 'בטון זוהרים'], ['תאריך', 'חלון תאריך'], ['רצועה', 'צמיד פלדת אל־חלד']], { preorder: true, hidden: true }],
  ['nautica-noir', 'Nautica Noir', 'צמיד ומארז פלדה בשחור מלא, בזל מוברש, חוגה בגרדיאנט שחור־אפור עם קווים אופקיים, סמנים זוהרים לבנים וחלון תאריך.', [['מארז', 'פלדה שחורה'], ['בזל', 'מוברש (frosted)'], ['חוגה', 'גרדיאנט שחור־אפור, קווים אופקיים'], ['סמנים', 'לבנים זוהרים'], ['תאריך', 'חלון תאריך'], ['רצועה', 'צמיד פלדת אל־חלד שחור']], { preorder: true, hidden: true }],
  ['nautica-ice', 'Nautica Ice', 'צמיד ומארז פלדה כסופים, בזל מוברש, חוגה בגוון טורקיז־אקווה בהיר עם קווים אופקיים, סמנים זוהרים וחלון תאריך.', [['מארז', 'פלדה כסופה'], ['בזל', 'מוברש (frosted)'], ['חוגה', 'טורקיז־אקווה בהיר'], ['סמנים', 'זוהרים'], ['תאריך', 'חלון תאריך'], ['רצועה', 'צמיד פלדת אל־חלד']], { preorder: true, hidden: true }],
  ['aqua-noir', 'Aqua Noir', 'מארז שחור עם בזל מוברש, רצועת גומי/סיליקון שחורה בטקסטורה, חוגה שחורה עם ספרות ערביות זוהרות, תת־חוגת שניות ב־6 וחלון תאריך.', [['מארז', 'שחור, בזל מוברש'], ['חוגה', 'שחורה, ספרות זוהרות'], ['תת־חוגה', 'שניות ב־6'], ['תאריך', 'חלון תאריך'], ['רצועה', 'גומי/סיליקון שחור']], { preorder: true, hidden: true }],
];

const photoCounts = counts as Record<string, number>;

export const allProducts: Product[] = seeds.map(([slug, name, description, specs, opts]) => ({
  slug,
  name,
  description,
  gender: 'men',
  preorder: false,
  photos: opts?.hidden ? 0 : photoCounts[slug] ?? 0,
  ...opts,
  specs: base(specs.map(([label, value]) => ({ label, value }))),
}));

/** Everything the shop shows (17 models). */
export const products = allProducts.filter((p) => !p.hidden);

export const getProduct = (slug: string) => products.find((p) => p.slug === slug);

export const PREORDER_BADGE = 'הזמנה מראש · עד 21 ימי עסקים';

/** The watch in the opening video, used for the glass cards. */
export const HERO_SLUG = 'aurelia-turquoise';

/** Watches in the dark "collection film", in order. */
export const FILM_SLUGS = [
  'regent-rose-emerald',
  'monarch-ice',
  'paradise-skeleton-noir',
  'regent-two-tone',
  'marina-orange',
  'petite-roma',
];

export const spec = (p: Product, label: string) => p.specs.find((s) => s.label === label)?.value;

export const photo = (slug: string, n: number) => ({
  src: `/assets/img/w/${slug}-${n}.webp`,
  srcset: `/assets/img/w/${slug}-${n}-600.webp 600w, /assets/img/w/${slug}-${n}.webp 1200w`,
  width: 1200,
  height: 1600,
});

export const card = (slug: string) => ({
  src: `/assets/img/card/${slug}-800.webp`,
  srcset: `/assets/img/card/${slug}-400.webp 400w, /assets/img/card/${slug}-800.webp 800w`,
  width: 800,
  height: 1000,
});

export const ogImage = (p: Product) => (p.photos ? `${SITE_URL}/assets/img/og/${p.slug}.jpg` : undefined);
export const absolutePhoto = (p: Product) => (p.photos ? `${SITE_URL}/assets/img/w/${p.slug}-1.webp` : undefined);
