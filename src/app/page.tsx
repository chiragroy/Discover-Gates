'use client';

import { useState, useEffect } from 'react';
import { MatterSelector, Matter } from '@/components/MatterSelector';
import { ConversationView, ChatMessage } from '@/components/ConversationView';
import { Composer } from '@/components/Composer';
import { LedgerRail } from '@/components/LedgerRail';
import { ChainExecutionSummary } from '@/types/gate';
import { CallResult } from '@/lib/providers';

export default function Home() {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [selectedMatterId, setSelectedMatterId] = useState<string>('');
  const [conversationId, setConversationId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [escalatingMessageId, setEscalatingMessageId] = useState<string | null>(null);

  // Active ledger rail details for the latest response
  const [currentSummary, setCurrentSummary] = useState<ChainExecutionSummary | null>(null);
  const [currentCall, setCurrentCall] = useState<CallResult | null>(null);
  const [statsRefreshKey, setStatsRefreshKey] = useState(1);

  // Load matters on mount
  useEffect(() => {
    async function loadMatters() {
      try {
        const res = await fetch('/api/matters');
        if (res.ok) {
          const data = await res.json();
          setMatters(data.matters);
          if (data.matters.length > 0) {
            setSelectedMatterId(data.matters[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load matters:', err);
      }
    }
    loadMatters();
  }, []);

  // When matter changes, reset conversation
  const handleSelectMatter = (matterId: string) => {
    setSelectedMatterId(matterId);
    setConversationId('');
    setMessages([]);
    setCurrentSummary(null);
    setCurrentCall(null);
  };

  // Send a message
  const handleSendMessage = async (text: string, bypassRecall = false) => {
    if (!selectedMatterId || !text.trim()) return;

    setLoading(true);

    const tempUserMsgId = `usr-${Date.now()}`;
    const newMessages: ChatMessage[] = [
      ...messages,
      {
        id: tempUserMsgId,
        role: 'user',
        content: text,
      },
    ];
    setMessages(newMessages);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matterId: selectedMatterId,
          conversationId: conversationId || undefined,
          message: text,
          bypassRecall,
        }),
      });

      const data = await res.json();

      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      // Update Ledger Rail
      if (data.decisions) {
        setCurrentSummary({
          envelope: {
            id: data.userMessageId || tempUserMsgId,
            conversationId: data.conversationId,
            matterId: selectedMatterId,
            text,
            tokens: { system: 120, history: 200, user: Math.ceil(text.length / 4) },
            turnIndex: messages.length + 1,
            spendSoFarMicro: 0,
          },
          decisions: data.decisions,
          selectedTier: data.selectedTier || 'standard',
          totalGateLatencyMs: data.totalGateLatencyMs,
          totalCostAvoidedMicro: data.totalCostAvoidedMicro || 0,
        });
      }

      if (data.call) {
        setCurrentCall(data.call);
      } else {
        setCurrentCall(null);
      }

      // Handle response types
      if (data.status === 'recall_offered') {
        setMessages([
          ...newMessages,
          {
            id: `asst-${Date.now()}`,
            role: 'assistant',
            content: '',
            userMessageId: data.userMessageId,
            recallOffer: data.recallOffer,
          },
        ]);
      } else if (data.status === 'blocked') {
        setMessages([
          ...newMessages,
          {
            id: data.asstMessageId || `asst-${Date.now()}`,
            role: 'assistant',
            content: data.text,
            isBlocked: true,
            userMessageId: data.userMessageId,
          },
        ]);
      } else if (data.status === 'resolved') {
        setMessages([
          ...newMessages,
          {
            id: data.asstMessageId || `asst-${Date.now()}`,
            role: 'assistant',
            content: data.text,
            isComputed: true,
            userMessageId: data.userMessageId,
          },
        ]);
      } else {
        // Standard success
        setMessages([
          ...newMessages,
          {
            id: data.asstMessageId || `asst-${Date.now()}`,
            role: 'assistant',
            content: data.text,
            userMessageId: data.userMessageId,
          },
        ]);
      }

      // Trigger stats refresh
      setStatsRefreshKey(k => k + 1);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setLoading(false);
    }
  };

  // Accept Recall Offer ($0 tokens)
  const handleAcceptRecall = async (userMessageId: string, priorAnswer: string, similarity: number) => {
    try {
      const res = await fetch('/api/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessageId,
          conversationId,
          priorAnswer,
          similarity,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Replace recall widget with accepted answer
        setMessages(prev =>
          prev.map(m =>
            m.userMessageId === userMessageId && m.role === 'assistant'
              ? {
                  ...m,
                  content: priorAnswer,
                  recallOffer: undefined,
                }
              : m
          )
        );

        setStatsRefreshKey(k => k + 1);
      }
    } catch (err) {
      console.error('Failed to accept recall:', err);
    }
  };

  // Ask Fresh (Call Model) when Recall is offered
  const handleAskFresh = (userMessageId: string, promptText: string) => {
    // Remove the recall offer assistant message from list
    setMessages(prev => prev.filter(m => !(m.userMessageId === userMessageId && m.role === 'assistant')));
    // Send with bypassRecall = true
    handleSendMessage(promptText, true);
  };

  // Escalate outcome
  const handleEscalate = async (userMessageId: string) => {
    setEscalatingMessageId(userMessageId);
    try {
      const res = await fetch('/api/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessageId, conversationId }),
      });

      if (res.ok) {
        const data = await res.json();
        // Append escalated response or replace
        setMessages(prev => [
          ...prev,
          {
            id: data.asstMessageId || `esc-${Date.now()}`,
            role: 'assistant',
            content: data.text,
            escalated: true,
            escalatedToTier: data.newTier,
            userMessageId,
          },
        ]);

        if (data.call) {
          setCurrentCall(data.call);
        }

        setStatsRefreshKey(k => k + 1);
      }
    } catch (err) {
      console.error('Escalation failed:', err);
    } finally {
      setEscalatingMessageId(null);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#FBFBF9]">
      {/* Top Header / Matter Selector */}
      <MatterSelector
        matters={matters}
        selectedMatterId={selectedMatterId}
        onSelectMatter={handleSelectMatter}
      />

      {/* Main Split Interface (60% Left pane / 40% Right Ledger Rail) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Conversation Pane (60%) */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#FBFBF9]">
          <ConversationView
            messages={messages}
            onAcceptRecall={handleAcceptRecall}
            onAskFresh={handleAskFresh}
            onEscalate={handleEscalate}
            escalatingMessageId={escalatingMessageId}
          />

          <Composer onSendMessage={handleSendMessage} disabled={loading} />
        </main>

        {/* Right Ledger Rail (40%) */}
        <LedgerRail
          currentSummary={currentSummary}
          currentCall={currentCall}
          statsRefreshKey={statsRefreshKey}
        />
      </div>
    </div>
  );
}
