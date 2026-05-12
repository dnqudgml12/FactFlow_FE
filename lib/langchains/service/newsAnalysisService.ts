import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIModelFactory } from '@/lib/langchains/config/aiModelConfig';
import { extractFromUrl, isValidUrl } from '@/lib/langchains/utils/contentExtractor';
import { TitleRewriteChain } from '@/lib/langchains/chains/titleRewriteChain';
import { SummaryChain } from '@/lib/langchains/chains/summaryChain';
import { KeywordExtractionChain } from '@/lib/langchains/chains/keywordExtractionChain';
import { DifficultyAnalysisChain } from '@/lib/langchains/chains/difficiltyAnalysisChain';
import { ExpressionAnalysisChain } from '@/lib/langchains/chains/expressionAnalysisChain';
import { ThinkingQuestionChain } from '@/lib/langchains/chains/thinkingQuestionChain';
import { ComplementaryInsightChain } from '../chains/complementaryInsightChain';
import type {
    SupportedAIModel,
    NewsAnalysisResponse,
    AnalysisResult,
    ProcessedNews,
} from '@/types/newsAnalysisResponse';

import { fetchSimilarNews } from '@/lib/langchains/utils/fetchSimilarNews';

export const ContentExtractor = {
    extractFromUrl,
    isValidUrl,
};

export class NewsAnalysisService {
    private model: BaseChatModel;
    private modelType: SupportedAIModel;
    private chains!: {
        title: TitleRewriteChain;
        summary: SummaryChain;
        keywords: KeywordExtractionChain;
        difficulty: DifficultyAnalysisChain;
        expression: ExpressionAnalysisChain;
        questions: ThinkingQuestionChain;
        complementary: ComplementaryInsightChain;
    };

    constructor(modelType?: SupportedAIModel, apiKey?: string) {
        if (modelType && apiKey) {
            this.model = AIModelFactory.createModel({ model: modelType, apiKey });
            this.modelType = modelType;
        } else {
            this.model = AIModelFactory.createFromEnv();
            this.modelType = AIModelFactory.getActiveModel();
        }

        console.log(`🤖 ${this.modelType.toUpperCase()} AI 모델 초기화`);
        this.initializeChains();
    }

    private initializeChains(): void {
        this.chains = {
            title: new TitleRewriteChain(this.model),
            summary: new SummaryChain(this.model),
            keywords: new KeywordExtractionChain(this.model),
            difficulty: new DifficultyAnalysisChain(this.model),
            expression: new ExpressionAnalysisChain(this.model),
            questions: new ThinkingQuestionChain(this.model),
            complementary: new ComplementaryInsightChain(this.model),
        };
        console.log('✅ 모든 체인 초기화 완료');
    }

    async analyzeNewsFromUrl(newsUrl: string): Promise<NewsAnalysisResponse> {
        try {
            console.log(`🚀 뉴스 분석 시작: ${newsUrl}`);
            const startTime = Date.now();

            if (!isValidUrl(newsUrl)) {
                throw new Error('유효하지 않은 URL입니다');
            }

            // 웹페이지 내용 추출
            const extractedData = await extractFromUrl(newsUrl);

            // 모든 분석 실행
            const analysisResults = await this.runAllAnalyses(extractedData.content, extractedData.title);

            const processingTime = Date.now() - startTime;

            return {
                metadata: {
                    original_url: newsUrl,
                    extracted_title: extractedData.title,
                    extracted_author: extractedData.author ?? '',
                    extracted_date: extractedData.publishDate ?? '',
                    ai_model: this.modelType.toUpperCase(),
                    analyzed_at: new Date().toISOString(),
                    processing_time_ms: processingTime,
                    processing_time_readable: this.formatTime(processingTime),
                    content_length: extractedData.content.length,
                    version: '2.0.0',
                },
                extracted_content: extractedData as NewsAnalysisResponse['extracted_content'],
                analysis: analysisResults as NewsAnalysisResponse['analysis'],
                share_info: {
                    share_id: this.generateId(),
                    share_url: `/share/${this.generateId()}`,
                },
            };
        } catch (error: unknown) {
            console.error('❌ 뉴스 분석 실패:', error);
            throw new Error(`뉴스 분석 실패: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async runAllAnalyses(content: string, title = ''): Promise<AnalysisResult> {
        const input = { content, title };
        const results: Record<string, unknown> = {};
        console.log('📊 전체 분석 병렬 실행 중...');

        // 기본 분석들을 먼저 병렬로 실행
        const basicAnalyses = [
            'title_rewrite',
            'summary',
            'keywords',
            'difficulty',
            'expression',
            'thinking_questions',
        ] as const;

        const basicTasks = basicAnalyses.map(async (analysisType) => {
            try {
                let result;
                switch (analysisType) {
                    case 'title_rewrite':
                        result = await this.executeWithRetry(() => this.chains.title.invoke(input), analysisType);
                        break;
                    case 'summary':
                        result = await this.executeWithRetry(() => this.chains.summary.invoke(input), analysisType);
                        break;
                    case 'keywords':
                        result = await this.executeWithRetry(() => this.chains.keywords.invoke(input), analysisType);
                        break;
                    case 'difficulty':
                        result = await this.executeWithRetry(() => this.chains.difficulty.invoke(input), analysisType);
                        break;
                    case 'expression':
                        result = await this.executeWithRetry(() => this.chains.expression.invoke(input), analysisType);
                        break;
                    case 'thinking_questions':
                        result = await this.executeWithRetry(() => this.chains.questions.invoke(input), analysisType);
                        break;
                }

                results[analysisType] = result;
                console.log(`✅ ${analysisType} 완료`);
            } catch (error) {
                console.error(`❌ ${analysisType} 분석 실패:`, error);
                if (this.isQuotaError(error)) {
                    throw error;
                }
                results[analysisType] = this.getDefaultValue(analysisType);
            }
        });

        // 기본 분석들 완료 대기
        await Promise.all(basicTasks);

        // 요약/키워드 후속 처리
        let summary = input.content.slice(0, 300);
        if (results.summary && typeof results.summary === 'object' && 'text' in results.summary) {
            summary = (results.summary as { text: string }).text;
        }

        let keywords: string[] = [];
        if (results.keywords && typeof results.keywords === 'object' && 'high_importance' in results.keywords) {
            keywords = (results.keywords as { high_importance: { keyword: string }[] }).high_importance.map(
                (k) => k.keyword
            );
        }

        // 관련 기사 검색
        let similarArticles: ProcessedNews[] = [];
        try {
            similarArticles = await fetchSimilarNews(summary, keywords);
            console.log('📊 관련 기사 수:', similarArticles.length);
        } catch (error) {
            console.warn('⚠️ 관련 기사 검색 실패:', error);
            similarArticles = [];
        }

        // 보완 인사이트 (의존성 있는 분석) - 수정된 부분
        try {
            if (similarArticles.length > 0 && keywords.length > 0) {
                console.log('🔍 보완 인사이트 분석 시작...');

                // ComplementaryInsightChain 실행 시 추가 검증
                const complementaryResult = await this.executeWithRetry(
                    async () => {
                        const result = await this.chains.complementary.run({
                            articles: similarArticles,
                            keywords,
                        });

                        // 결과 구조 검증
                        if (this.isValidComplementaryResult(result)) {
                            return result;
                        } else {
                            throw new Error('보완 인사이트 결과 구조가 올바르지 않습니다');
                        }
                    },
                    'complementary_insight',
                    2 // 재시도 횟수를 2로 줄임
                );

                results.complementary_insight = complementaryResult;
                console.log('✅ 보완 인사이트 분석 완료');
            } else {
                console.log('⚠️ 보완 인사이트 분석 건너뛰기 - 관련 기사 또는 키워드 부족');
                results.complementary_insight = {
                    complementary_articles: [],
                    insight: '관련 기사를 찾을 수 없어 보완 분석을 제공할 수 없습니다.',
                };
            }
        } catch (error) {
            console.error('❌ 보완 인사이트 최종 실패:', error);
            results.complementary_insight = {
                complementary_articles: [],
                insight: '보완 분석을 제공할 수 없습니다.',
                error: error instanceof Error ? error.message : String(error),
            };
        }

        return results as AnalysisResult;
    }

    /** Gemini 등 AI API 429/할당량 초과 여부 판별 */
    private isQuotaError(error: unknown): boolean {
        const message = error instanceof Error ? error.message : String(error);
        return (
            message.includes('429') ||
            message.includes('Too Many Requests') ||
            message.includes('quota') ||
            message.includes('exceeded your current quota')
        );
    }

    // 헬퍼 메서드
    private getDefaultValue(analysisType: string): unknown {
        const defaults: Record<string, unknown> = {
            title_rewrite: { title: '제목 분석 실패' },
            summary: { text: '요약 실패' },
            keywords: { high_importance: [] },
            difficulty: { level: 'unknown', reason: '분석 실패' },
            expression: { expressions: [] },
            thinking_questions: { questions: [] },
        };

        return defaults[analysisType] || {};
    }

    private async executeWithRetry<T>(operation: () => Promise<T>, operationName: string, maxRetries = 3): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await operation();

                // 결과 검증: 빈 객체나 null/undefined 체크
                if (this.isValidResult(result)) {
                    console.log(`✅ ${operationName} 시도 ${attempt}/${maxRetries} 성공`);
                    return result;
                } else {
                    throw new Error(`Invalid result: ${JSON.stringify(result)}`);
                }
            } catch (error: unknown) {
                lastError = error instanceof Error ? error : new Error(String(error));
                const message = lastError.message;

                console.warn(`⚠️ ${operationName} 재시도 ${attempt}/${maxRetries} 실패: ${message}`);

                // JSON 파싱 오류인 경우 특별 처리
                if (message.includes('JSON 파싱 실패')) {
                    console.error(`❌ ${operationName} JSON 파싱 오류 상세:`, {
                        error: message,
                        attempt,
                        operationName,
                    });
                }

                if (attempt < maxRetries) {
                    // 지수 백오프
                    await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
                }
            }
        }

        // 모든 재시도가 실패한 경우
        console.error(`❌ ${operationName} 최종 실패 (${maxRetries}/${maxRetries}): ${lastError?.message}`);
        throw lastError || new Error(`${operationName} 실행 실패`);
    }

    private isValidResult(result: unknown): boolean {
        if (result === null || result === undefined) {
            return false;
        }

        if (typeof result === 'object') {
            // 빈 객체 체크
            if (Object.keys(result as object).length === 0) {
                return false;
            }
        }

        return true;
    }

    async runSingleAnalysis(type: string, content: string, title?: string): Promise<unknown> {
        const input = { content, title: title || '' };

        switch (type) {
            case 'title':
                return await this.chains.title.invoke(input);
            case 'summary':
                return await this.chains.summary.invoke(input);
            case 'keywords':
                return await this.chains.keywords.invoke(input);
            case 'difficulty':
                return await this.chains.difficulty.invoke(input);
            case 'expression':
                return await this.chains.expression.invoke(input);
            case 'questions':
                return await this.chains.questions.invoke(input);
            default:
                throw new Error(`지원하지 않는 분석 유형: ${type}`);
        }
    }

    // 보완 인사이트 결과 검증 메서드 추가
    private isValidComplementaryResult(result: unknown): boolean {
        if (!result || typeof result !== 'object') {
            return false;
        }

        const complementaryResult = result as Record<string, unknown>;

        // 필수 필드 검증
        if (
            !complementaryResult.hasOwnProperty('complementary_articles') ||
            !complementaryResult.hasOwnProperty('insight')
        ) {
            return false;
        }

        // complementary_articles가 배열인지 확인
        if (!Array.isArray(complementaryResult.complementary_articles)) {
            return false;
        }

        // insight가 문자열인지 확인
        if (typeof complementaryResult.insight !== 'string') {
            return false;
        }

        return true;
    }

    private formatTime(ms: number): string {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}초`;
        return `${(ms / 60000).toFixed(1)}분`;
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    getModelInfo() {
        return {
            model: this.modelType.toUpperCase(),
            type: this.modelType,
        };
    }
}
