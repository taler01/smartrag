import { useState, useCallback, useRef } from 'react';
import { streamChatMessage, ChatMessageRequest } from '../services/apiService';
import { ChatMessage } from '../types';

interface UseStreamingChatProps {
  onMessageComplete?: (message: ChatMessage) => void;
  onError?: (error: Error) => void;
}

export const useStreamingChat = ({ onMessageComplete, onError }: UseStreamingChatProps = {}) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [error, setError] = useState<Error | null>(null);
  const [urlMapping, setUrlMapping] = useState<Record<string, string>>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  const startStreaming = useCallback(async (
    request: ChatMessageRequest,
    onChunk?: (chunk: string) => void
  ) => {
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();
    
    setIsStreaming(true);
    setCurrentMessage('');
    setUrlMapping({});
    setError(null);

    // 用于存储完整的消息内容
    let fullMessage = '';

    try {
      await streamChatMessage(
        request,
        (chunk: string) => {
          fullMessage += chunk;
          setCurrentMessage(fullMessage);
          onChunk?.(chunk);
        },
        (error: Error) => {
          setError(error);
          setIsStreaming(false);
          onError?.(error);
        },
        () => {
          setIsStreaming(false);
          
          // 使用URL映射表替换占位符
          let processedMessage = fullMessage;
          Object.entries(urlMapping).forEach(([placeholder, url]: [string, string]) => {
            processedMessage = processedMessage.replace(
              new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
              url
            );
          });
          
          // 创建完整的消息对象，使用processedMessage
          // 延迟1秒以确保助手消息的时间戳比用户消息晚
          const assistantTimestamp = new Date(Date.now() + 1000);
          
          const completeMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'model',
            text: processedMessage,
            timestamp: assistantTimestamp
          };
          
          onMessageComplete?.(completeMessage);
        },
        (mapping: Record<string, string>) => {
          setUrlMapping(mapping);
        }
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error occurred');
      setError(error);
      setIsStreaming(false);
      onError?.(error);
    }
  }, [onMessageComplete, onError]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsStreaming(false);
  }, []);

  const resetMessage = useCallback(() => {
    setCurrentMessage('');
    setUrlMapping({});
    setError(null);
  }, []);

  return {
    isStreaming,
    currentMessage,
    error,
    urlMapping,
    startStreaming,
    stopStreaming,
    resetMessage
  };
};