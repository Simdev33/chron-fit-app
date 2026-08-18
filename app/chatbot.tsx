import { useRouter } from 'expo-router';
import React from 'react';

import { ChatbotView } from '@/components/figma/AIChatModal';
import { useProfile } from '@/context/ProfileContext';

export default function ChatbotScreen() {
  const router = useRouter();
  const { profile } = useProfile();

  return (
    <ChatbotView
      onClose={() => router.back()}
      remission={profile.phase === 'remission'}
    />
  );
}
