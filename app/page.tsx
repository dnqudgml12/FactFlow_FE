'use client';
import { useNewsAnalysis } from '@/lib/hooks/useNewsAnalysis';
import NewsAnalysisForm from '@/components/NewsAnalysisForm';
import NewsAnalysisResults from '@/components/NewsAnalysisResult';
import LoadingScreen from '@/components/LoadingScreen';
import { useEffect, useState } from 'react';

export default function Home() {
    const { analyzeNews, loading, error, progress, result, clearResult } = useNewsAnalysis();
    const [url, setUrl] = useState('');

    useEffect(() => {
        if (error) console.error('[FactFlow] 분석 요청 오류:', error);
    }, [error]);

    useEffect(() => {
        if (!result?.analysis) return;
        const a = result.analysis;
        const titleFb =
            a.title_rewrite.change_reason === '분석 실패'
            || a.title_rewrite.rewritten_title === '제목 분석 실패';
        const summaryFb = a.summary.one_sentence === '요약 실패';
        if (titleFb && summaryFb) {
            console.warn(
                '[FactFlow] 응답이 LLM 폴백 상태입니다.',
                '터미널(Spring Boot) 로그에서 [FactFlow][LLM:title_rewrite] · [FactFlow][LLM:summary] 등 WARN/ERROR 를 확인하세요.',
                '(JSON 파싱 실패면 응답 미리보기 블록이 같이 찍힙니다.)'
            );
        }
    }, [result]);

    // URL 변경 처리
    const handleUrlChange = (value: string | ((prev: string) => string)) => {
        const newUrl = typeof value === 'function' ? value(url) : value;
        setUrl(newUrl);
        if (newUrl?.startsWith('http') && !loading) {
            analyzeNews(newUrl);
        }
    };

    // URL 붙여넣으면 자동 분석
    const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
        const pasted = e.clipboardData.getData('Text');
        handleUrlChange(pasted);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* 상단바 */}
            <main className="flex-1 flex flex-col items-center justify-start w-full">
                {/* 로딩 화면 */}
                {loading ? (
                    <LoadingScreen clearResult={clearResult} progress={progress} />
                ) : result ? (
                    <div className="w-full max-w-2xl mx-auto">
                        <NewsAnalysisResults
                            result={result}
                            setUrl={handleUrlChange}
                            handlePaste={handlePaste}
                            loading={loading}
                        />
                    </div>
                ) : (
                    <div className="w-full max-w-md mx-auto">
                        <NewsAnalysisForm
                            clearResult={clearResult}
                            loading={loading}
                            error={error}
                            url={url}
                            setUrl={handleUrlChange}
                            handlePaste={handlePaste}
                        />
                    </div>
                )}
            </main>
        </div>
    );
}
