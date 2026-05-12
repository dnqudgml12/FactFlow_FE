import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { SupportedAIModel } from '@/types/newsAnalysisResponse';

export interface AIModelConfig {
    model: SupportedAIModel;
    apiKey: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
}

export const AIModelFactory = {
    createModel(config: AIModelConfig): BaseChatModel {
        const {
            model,
            apiKey,
            temperature = 0.7,
            maxTokens = 4096,
            // timeout = 60000, // Remove timeout as it's not supported by all models
        } = config;

        switch (model) {
            case 'gemini':
                return new ChatGoogleGenerativeAI({
                    model: 'gemini-2.5-flash',
                    apiKey,
                    temperature,
                    maxOutputTokens: maxTokens,
                });

            case 'gpt':
                return new ChatOpenAI({
                    model: 'gpt-4o',
                    apiKey,
                    temperature,
                    maxTokens,
                });

            case 'claude':
                return new ChatAnthropic({
                    model: 'claude-3-5-sonnet-20241022',
                    apiKey,
                    temperature,
                    maxTokens,
                });

            default:
                throw new Error(`지원하지 않는 AI 모델: ${model}`);
        }
    },

    createFromEnv(): BaseChatModel {
        if (process.env.GOOGLE_API_KEY) {
            console.log('🤖 Gemini AI 사용');
            return AIModelFactory.createModel({
                model: 'gemini',
                apiKey: process.env.GOOGLE_API_KEY,
            });
        }

        if (process.env.OPENAI_API_KEY) {
            console.log('🤖 GPT-4 사용');
            return AIModelFactory.createModel({
                model: 'gpt',
                apiKey: process.env.OPENAI_API_KEY,
            });
        }

        if (process.env.ANTHROPIC_API_KEY) {
            console.log('🤖 Claude 사용');
            return AIModelFactory.createModel({
                model: 'claude',
                apiKey: process.env.ANTHROPIC_API_KEY,
            });
        }

        throw new Error('사용 가능한 AI API 키가 없습니다.');
    },

    getActiveModel(): SupportedAIModel {
        if (process.env.GOOGLE_API_KEY) return 'gemini';
        if (process.env.OPENAI_API_KEY) return 'gpt';
        if (process.env.ANTHROPIC_API_KEY) return 'claude';
        throw new Error('사용 가능한 AI 모델이 없습니다');
    },
};
