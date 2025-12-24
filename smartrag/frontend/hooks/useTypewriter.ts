import { useState, useEffect } from 'react';

interface UseTypewriterProps {
  text: string;
  speed?: number;
  isComplete?: boolean;
  onScrollToBottom?: () => void;
}

export const useTypewriter = ({ text, speed = 30, isComplete = true, onScrollToBottom }: UseTypewriterProps) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!isComplete) {
      // 如果消息还未完成，不显示打字机效果
      setDisplayedText(text);
      setIsTyping(false);
      return;
    }

    if (!text) {
      setDisplayedText('');
      setIsTyping(false);
      return;
    }

    setIsTyping(true);
    setDisplayedText('');

    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(prev => prev + text[currentIndex]);
        currentIndex++;
        // 每显示几个字符就滚动到底部
        if (currentIndex % 10 === 0) {
          onScrollToBottom?.();
        }
      } else {
        setIsTyping(false);
        clearInterval(interval);
        // 打字完成后确保滚动到底部
        onScrollToBottom?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, isComplete]);

  return { displayedText, isTyping };
};