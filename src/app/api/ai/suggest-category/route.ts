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
        { error: 'کلید سرویس هوش مصنوعی تنظیم نشده است.' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { title, categoriesList } = body ?? {};
    if (!title || typeof title !== 'string' || !Array.isArray(categoriesList)) {
      return NextResponse.json(
        { error: 'نام هزینه و فهرست دسته‌ها الزامی است.' },
        { status: 400 }
      );
    }

    const prompt = `نام هزینه: «${title.trim()}»
دسته‌ها و زیرمجموعه‌های موجود در پروژه:
${categoriesList
  .map(
    (c: { name: string; subcategories: string[] }) =>
      `- ${c.name}: [${(c.subcategories ?? []).join('، ')}]`
  )
  .join('\n')}

بهترین دسته اصلی و زیردستهٔ مناسب برای این هزینه را فقط از میان فهرست بالا یا با یک زیردستهٔ دقیق فارسی پیشنهاد بده.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        systemInstruction:
          'فقط به فارسی پاسخ بده و دقیقاً یک دسته اصلی از فهرست موجود انتخاب کن.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            categoryName: { type: Type.STRING },
            subcategory: { type: Type.STRING },
          },
          required: ['categoryName', 'subcategory'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Gemini suggest-category failed:', error);
    return NextResponse.json(
      { error: 'پیشنهاد دسته‌بندی هوشمند در حال حاضر در دسترس نیست.' },
      { status: 500 }
    );
  }
}
