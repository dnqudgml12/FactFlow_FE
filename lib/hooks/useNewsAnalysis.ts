'use client';

import { useState, useCallback, type Dispatch, type SetStateAction } from 'react';
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

/** Spring `NewsAnalysisService.ANALYSIS_STAGE_TOTAL`와 맞춤 (첫 이벤트 전 기본 진행 폭). */
const DEFAULT_STAGE_TOTAL = 11;

function streamAnalyzeEndpoint(): string {
    const base = (process.env.NEXT_PUBLIC_BACKEND_URL || '').trim().replace(/\/+$/, '');
    if (!base) {
        throw new Error(
            'NEXT_PUBLIC_BACKEND_URL이 필요합니다. FactFlow_BE 주소를 .env.local 등에 설정하세요. (예: http://localhost:8080)'
        );
    }
    return `${base}/api/v1/news/analyze/stream`;
}

/** 원시 SSE 바이너리를 이벤트 블록으로 나누고, 블록마다 `{ event, dataRaw }` 를 돌려줍니다. */
function appendAndDrainSse(
    decoder: TextDecoder,
    buffer: string,
    chunk: Uint8Array | undefined,
    doneReading: boolean
): { remaining: string; events: Array<{ event: string; dataRaw: string }> } {
    let work = buffer;
    if (chunk && chunk.byteLength > 0) {
        work += decoder.decode(chunk, { stream: !doneReading });
    } else if (doneReading) {
        work += decoder.decode(new Uint8Array(), { stream: false });
    }

    const events: Array<{ event: string; dataRaw: string }> = [];

    while (true) {
        let sep = work.indexOf('\n\n');
        let sepLen = 2;
        if (sep === -1) {
            sep = work.indexOf('\r\n\r\n');
            sepLen = 4;
        }
        if (sep === -1) break;

        const block = work.slice(0, sep);
        work = work.slice(sep + sepLen);
        const trimmed = block.trim();
        if (!trimmed) continue;

        let eventType = 'message';
        const dataLines: string[] = [];
        for (const rawLine of block.split(/\r?\n/)) {
            if (!rawLine) continue;
            if (rawLine.startsWith(':')) continue;
            if (rawLine.startsWith('event:')) {
                eventType = rawLine.slice('event:'.length).trim();
            } else if (rawLine.startsWith('data:')) {
                dataLines.push(rawLine.slice('data:'.length).trimStart());
            }
        }
        const dataRaw = dataLines.join('\n').trimEnd();
        if (dataRaw) {
            events.push({ event: eventType, dataRaw });
        }
    }

    return { remaining: work, events };
}

async function consumeAnalyzeSseStream(
    response: Response,
    setProgressCb: Dispatch<
        SetStateAction<{
            current: number;
            total: number;
            currentStep: string;
        }>
    >
): Promise<NewsAnalysisResponse> {
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('스트림을 읽을 수 없습니다.');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            const drained = appendAndDrainSse(decoder, buffer, value, done);
            buffer = drained.remaining;

            for (const { event, dataRaw } of drained.events) {
                if (event === 'progress') {
                    const parsed = JSON.parse(dataRaw) as {
                        step: number;
                        total: number;
                        phase?: string;
                        message?: string;
                    };
                    setProgressCb(() => ({
                        current: parsed.step,
                        total: parsed.total >= 1 ? parsed.total : DEFAULT_STAGE_TOTAL,
                        currentStep:
                            parsed.message?.trim()
                                || parsed.phase?.trim()
                                || `진행 중 (${parsed.step}/${parsed.total})`,
                    }));
                    continue;
                }

                if (event === 'complete') {
                    const payload = JSON.parse(dataRaw) as {
                        success: boolean;
                        data?: NewsAnalysisResponse;
                        error?: string;
                    };
                    if (!payload.success || !payload.data) {
                        throw new Error(payload.error || '분석 결과를 받지 못했습니다.');
                    }
                    return payload.data;
                }

                if (event === 'error') {
                    const errBody = JSON.parse(dataRaw) as {
                        success: boolean;
                        code?: string;
                        error?: string;
                    };
                    console.error('[FactFlow][SSE error 이벤트]', errBody);
                    const code = errBody.code;
                    const msg = errBody.error || '분석 중 오류가 발생했습니다.';
                    if (
                        code === 'QUOTA_EXCEEDED' ||
                        msg.includes('일일') ||
                        msg.includes('quota')
                    ) {
                        throw new Error(
                            'AI API 일일 사용 한도를 초과했습니다. 내일 다시 시도하거나 결제 플랜을 확인해 주세요.'
                        );
                    }
                    throw new Error(msg);
                }
            }

            if (done) break;
        }
    } finally {
        reader.releaseLock();
    }

    throw new Error('스트림이 비정상 종료되었습니다. (complete 없음)');
}

export function useNewsAnalysis(): UseNewsAnalysisReturn {
    const [result, setResult] = useState<NewsAnalysisResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState({
        current: 0,
        total: DEFAULT_STAGE_TOTAL,
        currentStep: '',
    });

    const analyzeNews = useCallback(async (url: string, model?: SupportedAIModel) => {
        setLoading(true);
        setError(null);
        setResult(null);
        setProgress({
            current: 0,
            total: DEFAULT_STAGE_TOTAL,
            currentStep: '백엔드에 연결하는 중…',
        });

        try {
            if (!url.trim()) throw new Error('URL을 입력해주세요.');
            try {
                new URL(url);
            } catch {
                throw new Error('올바른 URL 형식이 아닙니다.');
            }

            let endpoint: string;
            try {
                endpoint = streamAnalyzeEndpoint();
            } catch (e) {
                throw e instanceof Error ? e : new Error(String(e));
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { Accept: 'text/event-stream', 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, model }),
            });

            if (!response.ok) {
                const raw = await response.text();
                let message = '';

                try {
                    const j = JSON.parse(raw) as { error?: string; message?: string; code?: string };
                    message =
                        j.error ||
                        j.message ||
                        `HTTP ${response.status}: 분석 요청이 실패했습니다.`;
                    if (j.code === 'QUOTA_EXCEEDED') {
                        message =
                            'AI API 일일 사용 한도를 초과했습니다. 내일 다시 시도하거나 결제 플랜을 확인해 주세요.';
                    }
                } catch {
                    /* 응답 본문이 JSON이 아님 */
                }

                if (response.status === 429) {
                    message =
                        'AI API 일일 사용 한도를 초과했습니다. 내일 다시 시도하거나 결제 플랜을 확인해 주세요.';
                } else                 if (!message.trim()) {
                    message = raw.trim() || `HTTP ${response.status}: 분석 요청이 실패했습니다.`;
                }

                console.error('[FactFlow][HTTP 분석 요청 실패]', {
                    status: response.status,
                    message,
                    bodyPreview: raw.length > 800 ? `${raw.slice(0, 800)}…` : raw,
                });
                throw new Error(message);
            }

            const data = await consumeAnalyzeSseStream(response, setProgress);
            setProgress((p) => ({
                current: p.total,
                total: p.total,
                currentStep: '분석 완료!',
            }));
            setResult(data);
            setLoading(false);
        } catch (err: unknown) {
            console.error('[FactFlow][analyzeNews 예외]', err);
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
        setProgress({ current: 0, total: DEFAULT_STAGE_TOTAL, currentStep: '' });
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
}
