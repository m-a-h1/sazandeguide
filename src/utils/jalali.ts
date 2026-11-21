export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function normalizeDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const pIdx = PERSIAN_DIGITS.indexOf(ch);
    if (pIdx !== -1) {
      out += String(pIdx);
      continue;
    }
    const aIdx = ARABIC_DIGITS.indexOf(ch);
    if (aIdx !== -1) {
      out += String(aIdx);
      continue;
    }
    out += ch;
  }
  return out;
}

export function toPersianDigits(input: string | number): string {
  const str = String(input);
  return str.replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)] ?? d);
}

/**
 * Birashk 33-year cycle leap year check for Jalali calendar.
 */
export function isJalaliLeapYear(jy: number): boolean {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
    2192, 2262, 2324, 2394, 2456, 3178,
  ];
  let bl = breaks.length;
  let jp = breaks[0];
  let jump = 0;
  for (let i = 1; i < bl; i++) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    jp = jm;
  }
  let n = jy - jp;
  if (jump - n < 6) {
    n = n - jump + Math.floor((jump + 4) / 33) * 33;
  }
  let leap = (((n + 1) % 33) - 1) % 4;
  if (leap === -1) leap = 4;
  return leap === 0;
}

export function getDaysInJalaliMonth(jy: number, jm: number): number {
  if (jm >= 1 && jm <= 6) return 31;
  if (jm >= 7 && jm <= 11) return 30;
  if (jm === 12) return isJalaliLeapYear(jy) ? 30 : 29;
  return 0;
}

export interface JalaliParseResult {
  valid: boolean;
  normalized?: string;
  year?: number;
  month?: number;
  day?: number;
  error?: string;
}

export function parseJalaliDate(raw: string): JalaliParseResult {
  const trimmed = normalizeDigits(String(raw ?? '').trim());
  if (!trimmed) {
    return { valid: false, error: 'تاریخ وارد نشده است.' };
  }

  const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(trimmed);
  if (!match) {
    return {
      valid: false,
      error: 'قالب تاریخ باید دقیقاً به صورت YYYY/MM/DD شمسی باشد (نمونه: ۱۴۰۵/۰۷/۲۷).',
    };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1300 || year > 1500) {
    return {
      valid: false,
      error: 'سال تاریخ باید سال معتبر شمسی (بین ۱۳۰۰ تا ۱۵۰۰) باشد.',
    };
  }

  if (month < 1 || month > 12) {
    return { valid: false, error: 'ماه تاریخ شمسی باید بین ۰۱ تا ۱۲ باشد.' };
  }

  const maxDay = getDaysInJalaliMonth(year, month);
  if (day < 1 || day > maxDay) {
    return {
      valid: false,
      error: `روز تاریخ برای ماه ${JALALI_MONTHS[month - 1]} معتبر نیست.`,
    };
  }

  const normalized = `${String(year).padStart(4, '0')}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
  return { valid: true, normalized, year, month, day };
}

export function formatJalaliDisplay(dateStr: string): string {
  if (!dateStr) return '—';
  return toPersianDigits(normalizeDigits(dateStr));
}

export function compareJalaliDates(a: string, b: string): number {
  const na = normalizeDigits(a);
  const nb = normalizeDigits(b);
  if (na < nb) return -1;
  if (na > nb) return 1;
  return 0;
}

export function isJalaliInRange(
  dateStr: string,
  fromStr?: string,
  toStr?: string
): boolean {
  const target = normalizeDigits(dateStr.trim());
  if (!target) return false;
  if (fromStr && fromStr.trim()) {
    const f = parseJalaliDate(fromStr);
    if (f.valid && f.normalized && target < f.normalized) return false;
  }
  if (toStr && toStr.trim()) {
    const t = parseJalaliDate(toStr);
    if (t.valid && t.normalized && target > t.normalized) return false;
  }
  return true;
}

export function gregorianToJalali(gy: number, gm: number, gd: number): string {
  const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    gdm[gm - 1];
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm =
    days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd =
    1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return `${String(jy).padStart(4, '0')}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
}

export function getTodayJalali(): string {
  const now = new Date();
  return gregorianToJalali(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate()
  );
}
