import type { CategoryItem, ExpenseItem, Project } from '../types/app';

export const DEFAULT_CATEGORIES_TEMPLATE: Array<{
  name: string;
  sortOrder: number;
  subcategories: string[];
}> = [
  {
    name: 'مواد و مصالح',
    sortOrder: 1,
    subcategories: ['سازه و اسکلت', 'سفت‌کاری', 'نازک‌کاری', 'تأسیسات و تجهیزات', 'عمومی کارگاه'],
  },
  {
    name: 'پیمان و اجرا',
    sortOrder: 2,
    subcategories: [
      'طراحی، مجوز و نظارت',
      'سازه و اسکلت',
      'سفت‌کاری',
      'نازک‌کاری',
      'تأسیسات مکانیکی و برقی',
      'انشعابات',
      'حمل‌ونقل و کارگاه',
    ],
  },
  {
    name: 'حقوق و دستمزد',
    sortOrder: 3,
    subcategories: ['پرسنل کارگاه', 'پاداش و مزایا', 'بیمه'],
  },
  {
    name: 'اداری و تشکیلاتی',
    sortOrder: 4,
    subcategories: ['دفتر و بالاسری', 'پشتیبانی کارگاه', 'عوارض و مالیات'],
  },
  {
    name: 'مالی و تسهیلات',
    sortOrder: 5,
    subcategories: ['بانکی', 'تسهیلات و بهره'],
  },
  {
    name: 'فروش و بازاریابی',
    sortOrder: 6,
    subcategories: ['تبلیغات', 'فروش و بازاریابی'],
  },
  {
    name: 'سایر هزینه‌ها',
    sortOrder: 7,
    subcategories: ['متفرقه'],
  },
];

export const PDF_SAMPLE_AUDIT_NOTE =
  'هشدار تطبیق مالی فایل پی‌دی‌اف (تاریخ ۱۴۰۵/۰۷/۲۷): جمع واقعی ۸۶ ردیف ثبت‌شده برابر با ۳۰۸٬۲۷۴٬۷۳۰٬۱۵۳ است، در حالی که در فایل پی‌دی‌اف «جمع کل هزینه‌ها» برابر با ۳۰۷٬۹۳۴٬۷۳۰٬۱۵۳ درج شده است (اختلاف ۳۴۰٬۰۰۰٬۰۰۰). بررسی ردیف‌به‌ردیف نشان می‌دهد در گروه «پیمان و اجرا»، جمع واقعی ۳۹ ردیف برابر با ۸۴٬۳۲۰٬۸۸۴٬۵۹۰ است، اما در فایل عدد ۸۳٬۹۸۰٬۸۸۴٬۵۹۰ چاپ شده که دقیقاً معادل نادیده‌گرفته‌شدن ردیف ۳۹ («اجرای فوم بتن» به مبلغ ۳۴۰٬۰۰۰٬۰۰۰) در فرمول جمع آن جدول است. پنج گروه دیگر دقیقاً با جمع درج‌شده در فایل مطابقت دارند. همچنین در پایین فایل «پیش‌بینی هزینه مدیریت پیمان (۱۲٪): ۳۴٬۰۵۵٬۹۰۳٬۲۸۳» به صورت بند توضیحی آمده و به عنوان ردیف پایه اضافه نشده است. واحد پول در فایل مشخص نیست و روی «تعیین‌نشده» قرار دارد.';

export interface SeedExpenseSpec {
  categoryName: string;
  subcategory: string;
  dateJalali: string;
  title: string;
  baseAmount: number;
}

export const PDF_SAMPLE_EXPENSES: SeedExpenseSpec[] = [
  // ۱. فروش و بازاریابی (جمع فایل: 250,000,000)
  { categoryName: 'فروش و بازاریابی', subcategory: 'تبلیغات', dateJalali: '1405/07/27', title: 'هزینه تبلیغات و آگهی', baseAmount: 250000000 },
  { categoryName: 'فروش و بازاریابی', subcategory: 'فروش و بازاریابی', dateJalali: '1405/07/27', title: 'تخفیفات فاکتور فروش', baseAmount: 0 },
  { categoryName: 'فروش و بازاریابی', subcategory: 'فروش و بازاریابی', dateJalali: '1405/07/27', title: 'تخفیفات کلی', baseAmount: 0 },
  { categoryName: 'فروش و بازاریابی', subcategory: 'فروش و بازاریابی', dateJalali: '1405/07/27', title: 'ویزیتوری', baseAmount: 0 },
  { categoryName: 'فروش و بازاریابی', subcategory: 'فروش و بازاریابی', dateJalali: '1405/07/27', title: 'اشانتیون', baseAmount: 0 },

  // ۲. مالی و تسهیلات (جمع فایل: 23,731,267,952)
  { categoryName: 'مالی و تسهیلات', subcategory: 'بانکی', dateJalali: '1405/07/27', title: 'کارمزدهای بانکی', baseAmount: 17557952 },
  { categoryName: 'مالی و تسهیلات', subcategory: 'تسهیلات و بهره', dateJalali: '1405/07/27', title: 'بهره پرداختی', baseAmount: 23713710000 },

  // ۳. اداری و تشکیلاتی (جمع فایل: 899,327,433)
  { categoryName: 'اداری و تشکیلاتی', subcategory: 'دفتر و بالاسری', dateJalali: '1405/07/27', title: 'هزینه اجاره دفتر', baseAmount: 137074443 },
  { categoryName: 'اداری و تشکیلاتی', subcategory: 'دفتر و بالاسری', dateJalali: '1405/07/27', title: 'هزینه قبوض', baseAmount: 86106500 },
  { categoryName: 'اداری و تشکیلاتی', subcategory: 'دفتر و بالاسری', dateJalali: '1405/07/27', title: 'کالاهای مصرفی (ملزومات)', baseAmount: 10550000 },
  { categoryName: 'اداری و تشکیلاتی', subcategory: 'پشتیبانی کارگاه', dateJalali: '1405/07/27', title: 'هزینه صبحانه کارگری (پذیرایی)', baseAmount: 526329472 },
  { categoryName: 'اداری و تشکیلاتی', subcategory: 'پشتیبانی کارگاه', dateJalali: '1405/07/27', title: 'هزینه تجهیزات مصرفی (اداری)', baseAmount: 19152000 },
  { categoryName: 'اداری و تشکیلاتی', subcategory: 'دفتر و بالاسری', dateJalali: '1405/07/27', title: 'هزینه تعمیرات و نگهداری', baseAmount: 61700000 },
  { categoryName: 'اداری و تشکیلاتی', subcategory: 'دفتر و بالاسری', dateJalali: '1405/07/27', title: 'هزینه‌های جاری', baseAmount: 15833633 },
  { categoryName: 'اداری و تشکیلاتی', subcategory: 'عوارض و مالیات', dateJalali: '1405/07/27', title: 'هزینه مالیات', baseAmount: 42581385 },

  // ۴. حقوق و دستمزد (جمع فایل: 8,513,924,768)
  { categoryName: 'حقوق و دستمزد', subcategory: 'پرسنل کارگاه', dateJalali: '1405/07/27', title: 'هزینه حقوق و دستمزد', baseAmount: 7200300001 },
  { categoryName: 'حقوق و دستمزد', subcategory: 'پاداش و مزایا', dateJalali: '1405/07/27', title: 'هزینه عیدی و پاداش', baseAmount: 1313624767 },
  { categoryName: 'حقوق و دستمزد', subcategory: 'بیمه', dateJalali: '1405/07/27', title: 'هزینه بیمه تأمین اجتماعی', baseAmount: 0 },

  // ۵. پیمان و اجرا (۳۹ ردیف، جمع فایل: 83,980,884,590)
  { categoryName: 'پیمان و اجرا', subcategory: 'حمل‌ونقل و کارگاه', dateJalali: '1405/07/27', title: 'کرایه حمل', baseAmount: 1841040666 },
  { categoryName: 'پیمان و اجرا', subcategory: 'طراحی، مجوز و نظارت', dateJalali: '1405/07/27', title: 'هزینه کمیسیون املاک', baseAmount: 2434250000 },
  { categoryName: 'پیمان و اجرا', subcategory: 'طراحی، مجوز و نظارت', dateJalali: '1405/07/27', title: 'هزینه‌های شهرداری و اداری، محضری، ثبتی و کارشناسی و حقوقی', baseAmount: 24135536129 },
  { categoryName: 'پیمان و اجرا', subcategory: 'طراحی، مجوز و نظارت', dateJalali: '1405/07/27', title: 'هزینه طراحی، نقشه‌کشی و نظام مهندسی', baseAmount: 6053774830 },
  { categoryName: 'پیمان و اجرا', subcategory: 'طراحی، مجوز و نظارت', dateJalali: '1405/07/27', title: 'هزینه بیمه مسئولیت و بیمه تأمین اجتماعی', baseAmount: 2221675203 },
  { categoryName: 'پیمان و اجرا', subcategory: 'سازه و اسکلت', dateJalali: '1405/07/27', title: 'هزینه تخریب و تسطیح و گودبرداری', baseAmount: 390000000 },
  { categoryName: 'پیمان و اجرا', subcategory: 'سازه و اسکلت', dateJalali: '1405/07/27', title: 'هزینه جوشکاری اسکلت ساختمان', baseAmount: 478880000 },
  { categoryName: 'پیمان و اجرا', subcategory: 'سازه و اسکلت', dateJalali: '1405/07/27', title: 'هزینه آرماتوربندی', baseAmount: 5267800000 },
  { categoryName: 'پیمان و اجرا', subcategory: 'سفت‌کاری', dateJalali: '1405/07/27', title: 'هزینه سفت‌کاری و تیغه‌چینی', baseAmount: 0 },
  { categoryName: 'پیمان و اجرا', subcategory: 'تأسیسات مکانیکی و برقی', dateJalali: '1405/07/27', title: 'تأسیسات مکانیکی', baseAmount: 7344291000 },
  { categoryName: 'پیمان و اجرا', subcategory: 'تأسیسات مکانیکی و برقی', dateJalali: '1405/07/27', title: 'تأسیسات گازی', baseAmount: 821400000 },
  { categoryName: 'پیمان و اجرا', subcategory: 'تأسیسات مکانیکی و برقی', dateJalali: '1405/07/27', title: 'تأسیسات آتش‌نشانی', baseAmount: 507600000 },
  { categoryName: 'پیمان و اجرا', subcategory: 'سفت‌کاری', dateJalali: '1405/07/27', title: 'گچ‌کاری', baseAmount: 4149755000 },
  { categoryName: 'پیمان و اجرا', subcategory: 'نازک‌کاری', dateJalali: '1405/07/27', title: 'نازک‌کاری کاشی و سرامیک', baseAmount: 3162500000 },
  { categoryName: 'پیمان و اجرا', subcategory: 'سفت‌کاری', dateJalali: '1405/07/27', title: 'هزینه والپست و جوشکاری جزئی', baseAmount: 30000000 },
  { categoryName: 'پیمان و اجرا', subcategory: 'تأسیسات مکانیکی و برقی', dateJalali: '1405/07/27', title: 'هزینه نصب و راه‌اندازی آسانسور', baseAmount: 113334425 },
  { categoryName: 'پیمان و اجرا', subcategory: 'نازک‌کاری', dateJalali: '1405/07/27', title: 'هزینه نما و سیمان‌کاری و سنگ‌کاری', baseAmount: 7371870000 },
  { categoryName: 'پیمان و اجرا', subcategory: 'حمل‌ونقل و کارگاه', dateJalali: '1405/07/27', title: 'حقوق کارگران روزمزد', baseAmount: 7885650000 },
  { categoryName: 'پیمان و اجرا', subcategory: 'حمل‌ونقل و کارگاه', dateJalali: '1405/07/27', title: 'اجاره ابزارآلات', baseAmount: 0 },
  { categoryName: 'پیمان و اجرا', subcategory: 'طراحی، مجوز و نظارت', dateJalali: '1405/07/27', title: 'هزینه آزمایشگاه خاک و بتن', baseAmount: 641700000 },
  { categoryName: 'پیمان و اجرا', subcategory: 'حمل‌ونقل و کارگاه', dateJalali: '1405/07/27', title: 'هزینه تجهیز کارگاه', baseAmount: 0 },
  { categoryName: 'پیمان و اجرا', subcategory: 'سازه و اسکلت', dateJalali: '1405/07/27', title: 'چاه‌کنی', baseAmount: 280000000 },
  { categoryName: 'پیمان و اجرا', subcategory: 'سفت‌کاری', dateJalali: '1405/07/27', title: 'بنا', baseAmount: 40000000 },
  { categoryName: 'پیمان و اجرا', subcategory: 'حمل‌ونقل و کارگاه', dateJalali: '1405/07/27', title: 'جرثقیل', baseAmount: 25000000 },
  { categoryName: 'پیمان و اجرا', subcategory: 'حمل‌ونقل و کارگاه', dateJalali: '1405/07/27', title: 'داربست', baseAmount: 320000000 },
  { categoryName: 'پیمان و اجرا', subcategory: 'حمل‌ونقل و کارگاه', dateJalali: '1405/07/27', title: 'هزینه ایاب‌وذهاب، سوخت', baseAmount: 125647500 },
  { categoryName: 'پیمان و اجرا', subcategory: 'حمل‌ونقل و کارگاه', dateJalali: '1405/07/27', title: 'هزینه تجهیزات مصرفی (کارگاه)', baseAmount: 51310000 },
  { categoryName: 'پیمان و اجرا', subcategory: 'حمل‌ونقل و کارگاه', dateJalali: '1405/07/27', title: 'هزینه نظافت و تمیزکاری', baseAmount: 0 },
  { categoryName: 'پیمان و اجرا', subcategory: 'نازک‌کاری', dateJalali: '1405/07/27', title: 'نقاش و نصاب کاغذ دیواری', baseAmount: 830000000 },
  { categoryName: 'پیمان و اجرا', subcategory: 'تأسیسات مکانیکی و برقی', dateJalali: '1405/07/27', title: 'تأسیسات برقی', baseAmount: 2000000000 },
  { categoryName: 'پیمان و اجرا', subcategory: 'انشعابات', dateJalali: '1405/07/27', title: 'امتیاز و انشعاب آب و فاضلاب', baseAmount: 1493996000 },
  { categoryName: 'پیمان و اجرا', subcategory: 'نازک‌کاری', dateJalali: '1405/07/27', title: 'کناف‌کار', baseAmount: 0 },
  { categoryName: 'پیمان و اجرا', subcategory: 'نازک‌کاری', dateJalali: '1405/07/27', title: 'رابیتس‌کار', baseAmount: 706000000 },
  { categoryName: 'پیمان و اجرا', subcategory: 'نازک‌کاری', dateJalali: '1405/07/27', title: 'قرنیزکار داخلی', baseAmount: 0 },
  { categoryName: 'پیمان و اجرا', subcategory: 'انشعابات', dateJalali: '1405/07/27', title: 'امتیاز و انشعاب گاز', baseAmount: 210741526 },
  { categoryName: 'پیمان و اجرا', subcategory: 'انشعابات', dateJalali: '1405/07/27', title: 'امتیاز و انشعاب برق', baseAmount: 3047132311 },
  { categoryName: 'پیمان و اجرا', subcategory: 'انشعابات', dateJalali: '1405/07/27', title: 'امتیاز و انشعاب تلفن', baseAmount: 0 },
  { categoryName: 'پیمان و اجرا', subcategory: 'حمل‌ونقل و کارگاه', dateJalali: '1405/07/27', title: 'حوادث و درمان', baseAmount: 0 },
  { categoryName: 'پیمان و اجرا', subcategory: 'سفت‌کاری', dateJalali: '1405/07/27', title: 'اجرای فوم‌بتن', baseAmount: 340000000 },

  // ۶. مواد و مصالح (۲۹ ردیف، جمع فایل: 190,559,325,410)
  { categoryName: 'مواد و مصالح', subcategory: 'عمومی کارگاه', dateJalali: '1405/07/27', title: 'زمین', baseAmount: 0 },
  { categoryName: 'مواد و مصالح', subcategory: 'سفت‌کاری', dateJalali: '1405/07/27', title: 'سیمان، گچ، پودر سنگ و ...', baseAmount: 10930600000 },
  { categoryName: 'مواد و مصالح', subcategory: 'سفت‌کاری', dateJalali: '1405/07/27', title: 'ماسه و گراویه', baseAmount: 1248787738 },
  { categoryName: 'مواد و مصالح', subcategory: 'سازه و اسکلت', dateJalali: '1405/07/27', title: 'آهن و میلگرد', baseAmount: 18010058501 },
  { categoryName: 'مواد و مصالح', subcategory: 'سازه و اسکلت', dateJalali: '1405/07/27', title: 'بتن آماده', baseAmount: 8210670130 },
  { categoryName: 'مواد و مصالح', subcategory: 'سفت‌کاری', dateJalali: '1405/07/27', title: 'آجر و بلوک', baseAmount: 4354720000 },
  { categoryName: 'مواد و مصالح', subcategory: 'نازک‌کاری', dateJalali: '1405/07/27', title: 'سنگ و قرنیز', baseAmount: 12135300002 },
  { categoryName: 'مواد و مصالح', subcategory: 'نازک‌کاری', dateJalali: '1405/07/27', title: 'سرامیک و کاشی', baseAmount: 5030624000 },
  { categoryName: 'مواد و مصالح', subcategory: 'نازک‌کاری', dateJalali: '1405/07/27', title: 'درب‌ها', baseAmount: 8793860000 },
  { categoryName: 'مواد و مصالح', subcategory: 'نازک‌کاری', dateJalali: '1405/07/27', title: 'پنجره دوجداره', baseAmount: 7738000000 },
  { categoryName: 'مواد و مصالح', subcategory: 'تأسیسات و تجهیزات', dateJalali: '1405/07/27', title: 'لوازم برقی و تأسیسات', baseAmount: 6221738779 },
  { categoryName: 'مواد و مصالح', subcategory: 'تأسیسات و تجهیزات', dateJalali: '1405/07/27', title: 'لوازم گازی', baseAmount: 1601337000 },
  { categoryName: 'مواد و مصالح', subcategory: 'تأسیسات و تجهیزات', dateJalali: '1405/07/27', title: 'لوازم آتش‌نشانی', baseAmount: 0 },
  { categoryName: 'مواد و مصالح', subcategory: 'تأسیسات و تجهیزات', dateJalali: '1405/07/27', title: 'آسانسور', baseAmount: 20000000000 },
  { categoryName: 'مواد و مصالح', subcategory: 'نازک‌کاری', dateJalali: '1405/07/27', title: 'سقف کاذب، کناف، پی‌وی‌سی و رابیتس', baseAmount: 7931600000 },
  { categoryName: 'مواد و مصالح', subcategory: 'نازک‌کاری', dateJalali: '1405/07/27', title: 'شیرآلات، روشویی و سنگ بهداشتی', baseAmount: 8639338200 },
  { categoryName: 'مواد و مصالح', subcategory: 'نازک‌کاری', dateJalali: '1405/07/27', title: 'کابینت و نصب', baseAmount: 22500000000 },
  { categoryName: 'مواد و مصالح', subcategory: 'نازک‌کاری', dateJalali: '1405/07/27', title: 'هود، سینک، گاز، پکیج', baseAmount: 9301988000 },
  { categoryName: 'مواد و مصالح', subcategory: 'تأسیسات و تجهیزات', dateJalali: '1405/07/27', title: 'لوازم مکانیکی آب و فاضلاب و تأسیسات', baseAmount: 2807840000 },
  { categoryName: 'مواد و مصالح', subcategory: 'عمومی کارگاه', dateJalali: '1405/07/27', title: 'هزینه ابزارآلات', baseAmount: 7919407560 },
  { categoryName: 'مواد و مصالح', subcategory: 'سازه و اسکلت', dateJalali: '1405/07/27', title: 'تیرچه', baseAmount: 4786664000 },
  { categoryName: 'مواد و مصالح', subcategory: 'نازک‌کاری', dateJalali: '1405/07/27', title: 'نرده', baseAmount: 1642000000 },
  { categoryName: 'مواد و مصالح', subcategory: 'نازک‌کاری', dateJalali: '1405/07/27', title: 'رنگ نقاشی و کاغذ دیواری', baseAmount: 2216230000 },
  { categoryName: 'مواد و مصالح', subcategory: 'سفت‌کاری', dateJalali: '1405/07/27', title: 'ایزوگام، سقف ایرانیت و خدمات', baseAmount: 4001540000 },
  { categoryName: 'مواد و مصالح', subcategory: 'نازک‌کاری', dateJalali: '1405/07/27', title: 'قرنیز تزئیناتی', baseAmount: 9449836000 },
  { categoryName: 'مواد و مصالح', subcategory: 'سازه و اسکلت', dateJalali: '1405/07/27', title: 'آهن پروفیل، قوطی و نبشی', baseAmount: 3556093000 },
  { categoryName: 'مواد و مصالح', subcategory: 'سازه و اسکلت', dateJalali: '1405/07/27', title: 'میلگرد بستر، قالب و گیره', baseAmount: 660832500 },
  { categoryName: 'مواد و مصالح', subcategory: 'نازک‌کاری', dateJalali: '1405/07/27', title: 'شیشه و آینه', baseAmount: 870260000 },
  { categoryName: 'مواد و مصالح', subcategory: 'سفت‌کاری', dateJalali: '1405/07/27', title: 'یونولیت', baseAmount: 0 },
];

export function createClientSeedBundle(): {
  project: Project;
  categories: CategoryItem[];
  expenses: ExpenseItem[];
} {
  const projectId = 1;
  const project: Project = {
    id: projectId,
    name: 'گروه مهندسی مفخم ۱۲ - صیاد ۵',
    address: 'بلوار صیاد شیرازی (دادهٔ نمونه از گزارش پی‌دی‌اف)',
    description:
      'پروژهٔ نمونه بارگذاری‌شده از گزارش هزینه‌ها به تاریخ ۱۴۰۵/۰۷/۲۷. مبالغ پایه دقیقاً مطابق سند اولیه حفظ شده‌اند و قابل ویرایش هستند.',
    areaSqm: null,
    usefulAreaSqm: null,
    floors: null,
    units: null,
    startDateJalali: '1405/07/27',
    endDateJalali: '',
    status: 'در حال ساخت',
    currency: 'تعیین‌نشده',
    taxPercent: 0,
    landPrice: 0,
    partnershipPercent: null,
    pdfAuditNote: PDF_SAMPLE_AUDIT_NOTE,
    draftCategoryRates: {},
  };

  const categories: CategoryItem[] = DEFAULT_CATEGORIES_TEMPLATE.map((c, idx) => ({
    id: idx + 1,
    projectId,
    name: c.name,
    sortOrder: c.sortOrder,
    subcategories: [...c.subcategories],
  }));

  const catIdByName = new Map(categories.map((c) => [c.name, c.id]));

  const expenses: ExpenseItem[] = PDF_SAMPLE_EXPENSES.map((item, idx) => ({
    id: idx + 1,
    projectId,
    categoryId: catIdByName.get(item.categoryName) ?? null,
    categoryName: item.categoryName,
    subcategory: item.subcategory,
    dateJalali: item.dateJalali,
    title: item.title,
    baseAmount: item.baseAmount,
    overridePercent: null,
    source: 'نمونه',
  }));

  return { project, categories, expenses };
}
