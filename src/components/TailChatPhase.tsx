import React from 'react';
import PixelDialogueBox from './PixelDialogueBox';

interface Props {
  mode: 'lobby' | 'session';
  guestName: string;
  speakerName?: string;
  portraitUrl?: string;
  turnsUsed: number;
  maxTurns: number;
  displayText: string;
  inputValue: string;
  sessionStage?: 'input' | 'player' | 'npc';
  isRequesting: boolean;
  errorMessage?: string | null;
  onInputChange: (value: string) => void;
  onStartChat: () => void;
  onBackToLobby: () => void;
  onAdvance?: () => void;
  onSend: () => void;
  onFinish: () => void;
}

export default function TailChatPhase({
  mode,
  guestName,
  speakerName,
  portraitUrl,
  turnsUsed,
  maxTurns,
  displayText,
  inputValue,
  sessionStage = 'input',
  isRequesting,
  errorMessage,
  onInputChange,
  onStartChat,
  onBackToLobby,
  onAdvance,
  onSend,
  onFinish,
}: Props) {
  const canStillChat = turnsUsed < maxTurns;
  const showPortrait = Boolean(portraitUrl);

  const renderShell = (content: React.ReactNode) => (
    <div className="relative h-full w-full">
      {showPortrait && (
        <div
          className="absolute left-10 bottom-0 z-30 h-[30rem] w-[20rem] animate-character-enter md:left-16 md:h-[34rem] md:w-[24rem] lg:left-24 lg:h-[40rem] lg:w-[28rem]"
          style={{
            backgroundImage: `url(${portraitUrl})`,
            backgroundSize: 'contain',
            backgroundPosition: 'center bottom',
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}
      {content}
    </div>
  );

  if (mode === 'lobby') {
    return renderShell(
      <PixelDialogueBox
        speakerName={guestName}
        text={displayText}
        options={[
          {
            label: '聊一聊',
            onClick: onStartChat,
          },
          {
            label: '继续',
            onClick: onFinish,
          },
        ]}
        footer={(
          <div className="rounded-lg border-2 border-[#4a3f35] bg-[#1a110c] px-4 py-3 text-sm text-[#bda98a]">
            本次来访可聊 {maxTurns} 次，当前已聊 {turnsUsed} 次。
          </div>
        )}
      />
    );
  }

  if (sessionStage !== 'input') {
    return renderShell(
      <PixelDialogueBox
        speakerName={speakerName || guestName}
        text={displayText}
        onNext={onAdvance}
      />
    );
  }

  return renderShell(
    <PixelDialogueBox
      speakerName={guestName}
      text={displayText}
      footer={(
        <div className="space-y-3">
          <div className="rounded-lg border-2 border-[#4a3f35] bg-[#1a110c] p-4">
            <textarea
              value={inputValue}
              onChange={event => onInputChange(event.target.value)}
              disabled={isRequesting || !canStillChat}
              maxLength={60}
              placeholder={canStillChat ? '说点什么吧……（最多 60 字）' : '今天已经聊得够多了。'}
              className="h-24 w-full resize-none bg-transparent text-lg leading-8 text-[#e8dcc4] outline-none placeholder:text-[#8c7760]"
            />
            <div className="mt-3 flex items-center justify-between gap-4">
              <div className="text-sm text-[#bda98a]">
                {isRequesting
                  ? '对方正在斟酌该怎么接话……'
                  : errorMessage || `本次来访 ${turnsUsed} / ${maxTurns}`}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onBackToLobby}
                  className="pixel-button px-6 py-2 text-lg font-bold"
                >
                  返回
                </button>
                <button
                  type="button"
                  onClick={onSend}
                  disabled={
                    isRequesting ||
                    !canStillChat ||
                    inputValue.trim().length === 0 ||
                    inputValue.trim().length > 60
                  }
                  className="pixel-button px-6 py-2 text-lg font-bold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  发送
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    />
  );
}
