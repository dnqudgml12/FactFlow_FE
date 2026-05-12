'use client';

import { useState, useCallback } from 'react';
import type { NewsAnalysisResponse, SupportedAIModel } from '@/types/newsAnalysisResponse';

interface UseNewsAnalysisReturn {
    analyzeNews: (url: string, model?: SupportedAIModel) => Promise<void>;
    result: NewsAnalysisResponse | null;
    loading: boolean;
    error: string | null;
    progress: {
        current: number;
        total: number;
        currentStep: string;
    };
    clearResult: () => void;
    clearError: () => void;
}

const STAGE_LABELS = [
    '분석 준비 중...',
    '웹페이지 내용 추출 중...',
    '제목 재구성 중...',
    '요약 생성 중...',
    '키워드 추출 중...',
    '난이도 분석 중...',
    '표현 분석 중...',
    '분석 완료!',
];

export const useNewsAnalysis = (): UseNewsAnalysisReturn => {
    const [result, setResult] = useState<NewsAnalysisResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState({
        current: 0,
        total: 7,
        currentStep: '',
    });

    const analyzeNews = useCallback(async (url: string, model?: SupportedAIModel) => {
        setLoading(true);
        setError(null);
        setResult(null);
        setProgress({ current: 0, total: 7, currentStep: STAGE_LABELS[0] });

        try {
            if (!url.trim()) throw new Error('URL을 입력해주세요.');
            try {
                new URL(url);
            } catch {
                throw new Error('올바른 URL 형식이 아닙니다.');
            }

            // 단계별로 progress를 가짜로 연출
            for (let i = 1; i <= 6; i++) {
                await new Promise((res) => setTimeout(res, 2000));
                setProgress({ current: i, total: 7, currentStep: STAGE_LABELS[i] });
            }

            // 실제 fetch
            const response = await fetch('/api/news/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, model }),
            });

            setProgress({ current: 7, total: 7, currentStep: STAGE_LABELS[7] });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const message =
                    response.status === 429 || errorData.code === 'QUOTA_EXCEEDED'
                        ? 'AI API 일일 사용 한도를 초과했습니다. 내일 다시 시도하거나 결제 플랜을 확인해 주세요.'
                        : errorData.error || `HTTP ${response.status}: 분석 요청이 실패했습니다.`;
                throw new Error(message);
            }

            const data = await response.json();

            if (data.success) {
                // 0.4초 후에 결과 화면으로 넘어가도록 delay
                setTimeout(() => {
                    setResult(data.data);
                    setLoading(false);
                }, 400);
            } else {
                throw new Error(data.error || '분석 중 오류가 발생했습니다.');
            }
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message || '알 수 없는 오류가 발생했습니다.');
            } else {
                setError('알 수 없는 오류가 발생했습니다.');
            }
            setLoading(false);
        }
    }, []);

    const clearResult = useCallback(() => {
        setResult(null);
        setProgress({ current: 0, total: 7, currentStep: '' });
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        analyzeNews,
        result,
        loading,
        error,
        progress,
        clearResult,
        clearError,
    };
};
