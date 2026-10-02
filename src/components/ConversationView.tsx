'use client';

import { useState } from 'react';
import { ArrowUpRight, CheckCircle2, RotateCw } from 'lucide-react';
import { formatMicroDollars } from '@/config/pricing';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isComputed?: boolean;
  isBlocked?: boolean;
  userMessageId?: string;
  recallOffer?: {
    priorMessageId: string;
    priorQuestion: string;
    priorAnswer: string;
    priorDate: string;
    similarity: number;
  };
  escalated?: boolean;
  escalatedToTier?: string;
}

interface ConversationViewProps {
  messages: ChatMessage[];
  onAcceptRecall: (userMessageId: string, priorAnswer: string, similarity: number) => void;
  onAskFresh: (userMessageId: string, promptText: string) => void;
  onEscalate: (userMessageId: string) => void;
  escalatingMessageId?: string | null;
}

export function ConversationView({
  messages,
  onAcceptRecall,
  onAskFresh,
  onEscalate,
  escalatingMessageId,
}: ConversationViewProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-16 text-[#575D65]">
          <h2 className="text-xl font-serif text-[#15181C] mb-2 font-normal">
            Gatehouse Pre-Flight Assistant
          </h2>
          <p className="text-xs leading-relaxed mb-6 font-reading">
            Four local gates evaluate every query at zero token cost before model dispatch.
            Queries may be blocked by policy, resolved by local arithmetic, offered via recall, or routed to Haiku/Sonnet/Opus tiers.
          </p>
        </div>
      ) : (
        messages.map((msg, index) => {
          const isUser = msg.role === 'user';

          if (isUser) {
            return (
              <div key={msg.id || index} className="flex justify-end">
                <div className="max-w-2xl bg-white border border-[#E2E0DA] rounded-xs px-4 py-3 shadow-xs">
                  <div className="text-[10px] uppercase tracking-wider text-[#575D65] font-semibold mb-1">
                    Counsel Query
                  </div>
                  <div className="text-sm font-reading text-[#15181C] whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          }

          // Assistant message
          return (
            <div key={msg.id || index} className="flex flex-col space-y-2 max-w-3xl">
              <div
                className={`p-5 rounded-xs border ${
                  msg.isBlocked
                    ? 'border-[#8F2C27] bg-[#FDF8F7]'
                    : msg.recallOffer
                    ? 'border-[#9A6B18] bg-[#FDFBF7]'
                    : 'border-[#E2E0DA] bg-white'
                }`}
              >
                {/* Header indicators */}
                <div className="flex items-center justify-between pb-2 mb-2 hairline-b text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-[#15181C]">Gatehouse</span>
                    {msg.isComputed && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-xs bg-[#2F6B4F] text-white font-semibold">
                        Computed, not generated
                      </span>
                    )}
                    {msg.isBlocked && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-xs bg-[#8F2C27] text-white font-semibold">
                        Policy Blocked
                      </span>
                    )}
                    {msg.recallOffer && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-xs bg-[#9A6B18] text-white font-semibold">
                        Prior Match ({(msg.recallOffer.similarity * 100).toFixed(1)}%)
                      </span>
                    )}
                    {msg.escalated && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-xs bg-[#15181C] text-white font-semibold">
                        Escalated to {msg.escalatedToTier?.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Recall Offer Interactive Box */}
                {msg.recallOffer ? (
                  <div className="space-y-3">
                    <p className="text-xs text-[#575D65]">
                      A previously accepted answer exists for this matter from{' '}
                      <span className="font-medium text-[#15181C]">
                        {new Date(msg.recallOffer.priorDate).toLocaleDateString()}
                      </span>
                      .
                    </p>
                    <div className="p-3 bg-[#FBFBF9] border border-[#E2E0DA] rounded-xs font-reading text-xs text-[#15181C] space-y-1">
                      <div className="text-[10px] font-mono text-[#575D65] uppercase">Prior Question:</div>
                      <div className="italic font-medium">{msg.recallOffer.priorQuestion}</div>
                      <div className="text-[10px] font-mono text-[#575D65] uppercase pt-2">Prior Answer:</div>
                      <div>{msg.recallOffer.priorAnswer}</div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() =>
                          onAcceptRecall(
                            msg.userMessageId!,
                            msg.recallOffer!.priorAnswer,
                            msg.recallOffer!.similarity
                          )
                        }
                        className="px-3 py-1.5 bg-[#2F6B4F] hover:bg-[#25563F] text-white rounded-xs text-xs font-medium transition-colors flex items-center gap-1.5"
                      >
                        <CheckCircle2 size={13} />
                        <span>Reuse Prior Answer ($0 tokens)</span>
                      </button>
                      <button
                        onClick={() => onAskFresh(msg.userMessageId!, msg.recallOffer!.priorQuestion)}
                        className="px-3 py-1.5 border border-[#E2E0DA] hover:bg-[#ECEAE4] text-[#15181C] rounded-xs text-xs font-medium transition-colors"
                      >
                        Ask Fresh (Call Model)
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Standard Content Body */
                  <div className="font-reading text-sm text-[#15181C] leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>
                )}
              </div>

              {/* The Outcome Capture / Escalation Control */}
              {!msg.isBlocked && !msg.recallOffer && msg.userMessageId && (
                <div className="pl-1">
                  <button
                    disabled={escalatingMessageId === msg.userMessageId}
                    onClick={() => onEscalate(msg.userMessageId!)}
                    className="text-[11px] text-[#575D65] hover:text-[#15181C] transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RotateCw size={11} className={escalatingMessageId === msg.userMessageId ? 'animate-spin' : ''} />
                    <span>↳ This didn't answer my question (escalate to higher tier)</span>
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
