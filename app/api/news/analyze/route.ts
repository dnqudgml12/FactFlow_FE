import { type NextRequest, NextResponse } from 'next/server';
import { NewsAnalysisService } from '@/lib/langchains/service/newsAnalysisService';

export async function POST(request: NextRequest) {
    try {
        console.log('📰 뉴스 분석 API 호출');

        const body = await request.json();
        const { url, model } = body;

        if (!url) {
            return NextResponse.json(
                {
                    success: false,
                    error: '뉴스 기사 URL이 필요합니다.',
                    code: 'MISSING_URL',
                },
                { status: 400 }
            );
        }

        try {
            new URL(url);
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    error: '유효하지 않은 URL 형식입니다.',
                    code: 'INVALID_URL',
                },
                { status: 400 }
            );
        }

        const analysisService = new NewsAnalysisService(model);
        const result = await analysisService.analyzeNewsFromUrl(url);

        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (error: unknown) {
        console.error('❌ 뉴스 분석 API 오류:', error);

        let errorCode = 'UNKNOWN_ERROR';
        let statusCode = 500;
        const rawMessage = (error as Error).message || '뉴스 분석 중 오류가 발생했습니다.';

        if (rawMessage.includes('429') || rawMessage.includes('Too Many Requests') || rawMessage.includes('quota') || rawMessage.includes('exceeded your current quota')) {
            errorCode = 'QUOTA_EXCEEDED';
            statusCode = 429;
        } else if (rawMessage.includes('API 키')) {
            errorCode = 'API_KEY_ERROR';
        } else if (rawMessage.includes('추출')) {
            errorCode = 'CONTENT_EXTRACTION_ERROR';
            statusCode = 400;
        }

        const errorMessage =
            errorCode === 'QUOTA_EXCEEDED'
                ? 'AI API 일일 사용 한도를 초과했습니다. 내일 다시 시도하거나 결제 플랜을 확인해 주세요.'
                : rawMessage;

        return NextResponse.json(
            {
                success: false,
                error: errorMessage,
                code: errorCode,
            },
            { status: statusCode }
        );
    }
}

export async function GET() {
    return NextResponse.json({
        api_name: 'News Analysis API',
        version: '2.0.0',
        description: 'URL을 입력하면 뉴스 기사를 자동으로 분석합니다',
        usage: {
            method: 'POST',
            endpoint: '/api/news/analyze',
            body: {
                url: 'https://news.example.com/article',
                model: 'gemini',
            },
        },
    });
}
