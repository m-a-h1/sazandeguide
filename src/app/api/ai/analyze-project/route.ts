import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { requireAnySession } from '../../../../lib/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function POST(request: NextRequest) {
  const { response: authError } = await requireAnySession(request);
  if (authError) return authError;

  try {
    const ai = getGeminiClient();
    if (!ai) {
      return NextResponse.json(
        {
          error:
            'کلید سرویس هوش مصنوعی تنظیم نشده است. لطفاً کلید را در تنظیمات محیطی اضافه کنید.',
        },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      projectName,
      currency,
      areaSqm,
      totalBaseAmount,
      totalEstimatedAmount,
      diffPercent,
      versionName,
      categoryBreakdown,
      topItems,
    } = body ?? {};

    if (!projectName || typeof projectName !== 'string' || !Array.isArray(categoryBreakdown)) {
      return NextResponse.json(
        { error: 'اطلاعات پروژه برای تحلیل ناقص است.' },
        { status: 400 }
      );
    }

    const prompt = `
شما یک مدیر پروژه و برآوردگر ارشد هزینه‌های ساختمانی در ایران هستید.
فقط به زبان فارسی رسمی و دقیق پاسخ بده. هیچ واژهٔ انگلیسی در خروجی استفاده نکن.
اطلاعات پروژه:
- نام پروژه: ${String(projectName)}
- نسخهٔ مورد بررسی: ${String(versionName || 'پیش‌نویس کاری')}
- واحد پول: ${String(currency || 'تعیین‌نشده')}
- متراژ زیربنا: ${areaSqm ? `${areaSqm} مترمربع` : 'ثبت‌نشده'}
- جمع قیمت پایه: ${Math.round(Number(totalBaseAmount) || 0)}
- جمع قیمت برآوردی: ${Math.round(Number(totalEstimatedAmount) || 0)}
- درصد تغییر کل: ${Number(diffPercent || 0).toFixed(2)}٪

سهم دسته‌های اصلی:
${categoryBreakdown
  .slice(0, 10)
  .map(
    (c: {
      categoryName: string;
      baseAmount: number;
      estimatedAmount: number;
      shareOfEstimatedPercent: number;
    }) =>
      `- ${c.categoryName}: پایه ${Math.round(c.baseAmount)} | برآوردی ${Math.round(c.estimatedAmount)} (${Number(c.shareOfEstimatedPercent || 0).toFixed(1)}٪)`
  )
  .join('\n')}

بزرگ‌ترین اقلام هزینه:
${
  Array.isArray(topItems)
    ? topItems
        .slice(0, 8)
        .map(
          (i: {
            title: string;
            categoryName: string;
            estimatedAmount: number;
            effectivePercent: number;
          }) =>
            `- ${i.title} (${i.categoryName}): ${Math.round(i.estimatedAmount)} با نرخ ${i.effectivePercent}٪`
        )
        .join('\n')
    : ''
}

لطفاً یک تحلیل مدیریتی دقیق، کاربردی و کوتاه دربارهٔ ساختار هزینه‌ها، ریسک‌های تورمی و پیشنهادهای کنترل هزینه ارائه بده.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'تحلیلگر ارشد هزینه‌های ساختمانی. پاسخ‌ها کوتاه، عددی، دقیق و تماماً فارسی بدون کلمات انگلیسی باشد.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: 'خلاصه مدیریتی وضعیت هزینه و برآورد پروژه به فارسی',
            },
            keyDrivers: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'مهم‌ترین پیشران‌های هزینه در پروژه (۳ مورد)',
            },
            riskWarnings: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'ریسک‌های تورمی و نقاط حساس هزینه (۲ تا ۳ مورد)',
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'پیشنهادهای اجرایی برای مدیریت و بهینه‌سازی هزینه (۳ مورد)',
            },
          },
          required: [
            'summary',
            'keyDrivers',
            'riskWarnings',
            'recommendations',
          ],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Gemini analyze-project failed:', error);
    return NextResponse.json(
      {
        error:
          'دریافت تحلیل هوشمند با خطا مواجه شد. لطفاً لحظاتی دیگر دوباره تلاش کنید.',
      },
      { status: 500 }
    );
  }
}
