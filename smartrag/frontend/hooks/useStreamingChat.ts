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
          
          // 创建完整的消息对象，使用fullMessage而不是currentMessage
          const completeMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'model',
            text: fullMessage,
            timestamp: new Date()
          };
          
          onMessageComplete?.(completeMessage);
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
    setError(null);
  }, []);

  return {
    isStreaming,
    currentMessage,
    error,
    startStreaming,
    stopStreaming,
    resetMessage
  };
};