import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  CharacterReward,
  NarrativeExit,
  NarrativeObservationExit,
  NodePlayerOption,
  NodePresentation,
  ScriptFlowStep,
} from '../data/content/types';
import { resolveNodeExit } from '../data/content/narrative';
import type { Guest, CharacterNode } from '../data/gameData';
import type { GuestTranscriptEntry } from '../state/gameState';
import PixelDialogueBox from './PixelDialogueBox';
import { findNodeForGuest } from '../data/gameData';

interface DialogueLine {
  type: 'env' | 'npc' | 'inner';
  text: string;
}

function buildScriptFlowLines(scriptFlow: ScriptFlowStep[] | undefined): DialogueLine[] {
  if (!Array.isArray(scriptFlow)) {
    return [];
  }

  return scriptFlow.flatMap(item => {
    if (item.type !== 'env' && item.type !== 'npc' && item.type !== 'inner') {
      return [];
    }

    const lines = Array.isArray(item.content) ? item.content : [item.content];
    return lines
      .map(line => line.trim())
      .filter(Boolean)
      .map(text => ({
        type: item.type,
        text,
      }));
  });
}

function buildAmbientLines(node: CharacterNode): DialogueLine[] {
  const atmosphereLines = Array.isArray(node.atmosphere_lines)
    ? node.atmosphere_lines
        .map(line => line.trim())
        .filter(Boolean)
        .map(text => ({ type: 'env' as const, text }))
    : [];

  const contentLines = Array.isArray(node.content)
    ? node.content
        .map(line => line.trim())
        .filter(Boolean)
        .map(text => ({ type: 'npc' as const, text }))
    : [];

  return [...atmosphereLines, ...contentLines];
}

function buildNodeDialogueLines(node: CharacterNode): DialogueLine[] {
  const scriptLines = buildScriptFlowLines(node.script_flow);
  if (scriptLines.length > 0) {
    return scriptLines;
  }

  return buildAmbientLines(node);
}

function getOptionBranchType(option: NodePlayerOption) {
  return option.branchType ?? option.branch_type ?? null;
}

function getOptionLabel(option: NodePlayerOption) {
  return option.option || option.text;
}

function buildOptionReply(option: NodePlayerOption) {
  const rawText = getOptionLabel(option).replace(/^[「」]+|[「」]+$/g, '');
  return `「${rawText}」`;
}

function buildOptionLines(option: NodePlayerOption): DialogueLine[] {
  return buildScriptFlowLines(option.script_flow);
}

interface Props {
  guest: Guest;
  startNodeId: string;
  currentNodeId: string | null;
  chatAvailabilityEnabled?: boolean;
  discoveredFeatures: string[];
  onNodeChange: (nodeId: string) => void;
  onEnterMixing: (teachingNode: CharacterNode | null, mixingNode: CharacterNode) => void;
  onEnterObservation: (trigger: NarrativeObservationExit) => void;
  onEnterTailChatBeforeNextNode?: (node: CharacterNode) => void;
  onComplete: () => void;
  onReward: (reward: CharacterReward) => void;
  showReward?: boolean;
  onChatAvailabilityChange?: (canOpen: boolean) => void;
  onTranscriptLine: (entry: GuestTranscriptEntry) => void;
}

export default function StoryPhase({
  guest,
  startNodeId,
  currentNodeId,
  chatAvailabilityEnabled = false,
  discoveredFeatures,
  onNodeChange,
  onEnterMixing,
  onEnterObservation,
  onEnterTailChatBeforeNextNode,
  onComplete,
  onReward,
  showReward,
  onChatAvailabilityChange,
  onTranscriptLine,
}: Props) {
  const [sentences, setSentences] = useState<string[]>([]);
  const [sentenceTypes, setSentenceTypes] = useState<DialogueLine['type'][]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [pendingNextNode, setPendingNextNode] = useState<string | null>(null);
  const [pendingNodeExit, setPendingNodeExit] = useState(false);
  const [completedOptions, setCompletedOptions] = useState<Set<number>>(new Set());
  const [rewardPending, setRewardPending] = useState(false);
  const [rewardShownNodeId, setRewardShownNodeId] = useState<string | null>(null);
  const [portraitVisible, setPortraitVisible] = useState(false);
  const [portraitExpression, setPortraitExpression] = useState('dialogue');
  const [isDialogueTyping, setIsDialogueTyping] = useState(false);
  const emittedTranscriptKeysRef = useRef<Set<string>>(new Set());

  const activeNodeId = currentNodeId;
  const currentNode = activeNodeId ? findNodeForGuest(activeNodeId, guest.id, guest.nodeMap) : null;
  const currentExit = useMemo(
    () => (currentNode ? resolveNodeExit(currentNode) : null),
    [currentNode],
  );
  const currentPresentation: NodePresentation = currentNode?.presentation || {};

  useEffect(() => {
    setPortraitVisible(false);
    setPortraitExpression('dialogue');
    emittedTranscriptKeysRef.current = new Set();
  }, [guest.id, startNodeId]);

  useEffect(() => {
    if (!activeNodeId) {
      return;
    }

    if (!currentNode) {
      onComplete();
      return;
    }

    const dialogueLines = buildNodeDialogueLines(currentNode);
    const combined = dialogueLines.map(line => line.text);
    const combinedTypes = dialogueLines.map(line => line.type);

    setSentences(combined.length > 0 ? combined : ["..."]);
    setSentenceTypes(combinedTypes);
    setCurrentIdx(0);
    setShowOptions(false);
    setPendingNextNode(null);
    setPendingNodeExit(false);
    setCompletedOptions(new Set());
    setRewardPending(false);
  }, [activeNodeId, guest.id]);

  useEffect(() => {
    if (!currentNode) {
      return;
    }

    if (currentPresentation.portrait === 'show') {
      setPortraitVisible(true);
    } else if (currentPresentation.portrait === 'hide') {
      setPortraitVisible(false);
    }

    if (currentPresentation.expression) {
      setPortraitExpression(currentPresentation.expression);
    }
  }, [currentNode, currentPresentation.expression, currentPresentation.portrait]);

  useEffect(() => {
    if (!portraitVisible && sentenceTypes[currentIdx] === 'npc') {
      setPortraitVisible(true);
    }
  }, [currentIdx, portraitVisible, sentenceTypes]);

  useEffect(() => {
    return () => {
      onChatAvailabilityChange?.(false);
    };
  }, [onChatAvailabilityChange]);

  const resolveSpeakerName = useCallback((sentenceType: DialogueLine['type']) => {
    if (sentenceType === 'env') {
      return '\u7cfb\u7edf';
    }
    if (sentenceType === 'inner') {
      return '\u6211';
    }
    if (currentPresentation.speaker === 'system') {
      return '\u7cfb\u7edf';
    }
    if (currentPresentation.speaker === 'player') {
      return '\u6211';
    }
    return guest.name;
  }, [currentPresentation.speaker, guest.name]);

  const recordCurrentLine = useCallback(() => {
    const currentText = sentences[currentIdx]?.trim();
    if (!activeNodeId || !currentText || currentText === '...') {
      return;
    }

    const transcriptKey = `${activeNodeId}:${currentIdx}:${currentText}`;
    if (emittedTranscriptKeysRef.current.has(transcriptKey)) {
      return;
    }

    emittedTranscriptKeysRef.current.add(transcriptKey);
    onTranscriptLine({
      key: transcriptKey,
      speaker: resolveSpeakerName(sentenceTypes[currentIdx] || 'npc'),
      text: currentText,
    });
  }, [activeNodeId, currentIdx, onTranscriptLine, resolveSpeakerName, sentenceTypes, sentences]);

  const followExit = useCallback((exit: NarrativeExit | null) => {
    if (!exit || !currentNode) {
      onComplete();
      return;
    }

    switch (exit.kind) {
      case 'next':
        onNodeChange(exit.target);
        return;
      case 'observation':
        onEnterObservation(exit);
        return;
      case 'mixing':
        onEnterMixing(currentNode.teaching ? currentNode : null, currentNode);
        return;
      case 'end_visit':
        onComplete();
    }
  }, [currentNode, onComplete, onEnterMixing, onEnterObservation, onNodeChange]);

  const continueFromNodeEnd = useCallback(() => {
    if (pendingNextNode) {
      const next = pendingNextNode;
      setPendingNextNode(null);

      if (
        currentNode?.llm_chat?.entry_mode === 'before_next_node' &&
        currentExit?.kind === 'next' &&
        next === currentExit.target
      ) {
        onEnterTailChatBeforeNextNode?.(currentNode);
        return;
      }

      onNodeChange(next);
      return;
    }

    if (pendingNodeExit) {
      setPendingNodeExit(false);
      followExit(currentExit);
      return;
    }

    if (currentNode?.player_options && currentNode.player_options.length > 0) {
      const hasChoiceOptions = currentNode.player_options.some(
        opt => getOptionBranchType(opt) === 'choice'
      );

      if (hasChoiceOptions) {
        const totalOptions = currentNode.player_options.length;
        if (completedOptions.size === totalOptions) {
          followExit(currentExit);
        } else {
          setShowOptions(true);
        }
      } else {
        setShowOptions(true);
      }
    } else if (
      currentNode?.llm_chat?.entry_mode === 'before_next_node' &&
      currentExit?.kind === 'next'
    ) {
      onEnterTailChatBeforeNextNode?.(currentNode);
    } else {
      followExit(currentExit);
    }
  }, [
    completedOptions,
    currentNode,
    currentExit,
    followExit,
    onNodeChange,
    onEnterTailChatBeforeNextNode,
    pendingNodeExit,
    pendingNextNode,
  ]);

  useEffect(() => {
    const hasChoiceStep = Array.isArray(currentNode?.player_options) && currentNode.player_options.length > 0;
    const hasBlockingExit = currentExit?.kind === 'observation' || currentExit?.kind === 'mixing';
    const canOpenChat = Boolean(
      chatAvailabilityEnabled &&
      currentNode &&
      sentences.length > 0 &&
      currentIdx === sentences.length - 1 &&
      !isDialogueTyping &&
      !showOptions &&
      !pendingNextNode &&
      !rewardPending &&
      !showReward &&
      !hasChoiceStep &&
      !hasBlockingExit &&
      !currentNode.reward &&
      currentExit?.kind === 'next',
    );

    onChatAvailabilityChange?.(canOpenChat);
  }, [
    chatAvailabilityEnabled,
    currentIdx,
    currentNode,
    currentExit,
    isDialogueTyping,
    onChatAvailabilityChange,
    pendingNextNode,
    rewardPending,
    sentences.length,
    showOptions,
    showReward,
  ]);

  useEffect(() => {
    if (!rewardPending || showReward) {
      return;
    }

    setRewardPending(false);
    continueFromNodeEnd();
  }, [continueFromNodeEnd, rewardPending, showReward]);

  const handleNext = () => {
    recordCurrentLine();

    if (currentIdx < sentences.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      if (currentNode?.reward && !rewardPending) {
        if (rewardShownNodeId === activeNodeId) {
          continueFromNodeEnd();
          return;
        }

        onReward(currentNode.reward);
        setRewardPending(true);
        setRewardShownNodeId(activeNodeId);
        return;
      }

      continueFromNodeEnd();
      return;
    }
  };

  const handleOptionClick = (opt: NodePlayerOption, idx: number) => {
    const branchType = getOptionBranchType(opt);

    // choice 类型：标记完成，不跳转，继续显示选项
    if (branchType === 'choice') {
      setCompletedOptions(prev => new Set([...prev, idx]));

      if (opt.script_flow) {
        const optionLines = buildOptionLines(opt);
        const optionSentences = optionLines.map(line => line.text);
        const optionSentenceTypes = optionLines.map(line => line.type);
        if (optionSentences.length > 0) {
          const playerReply = buildOptionReply(opt);
          setSentences([playerReply, ...optionSentences]);
          setSentenceTypes(['inner' as const, ...optionSentenceTypes]);
          setCurrentIdx(0);
          setShowOptions(false);
          setPendingNextNode(null);
          setPendingNodeExit(false);
          return;
        }
      }

      if (opt.immediate_response) {
        setSentences([`「${(opt.text || opt.option).replace(/^[「」]+|[「」]+$/g, '')}」`, opt.immediate_response]);
        setCurrentIdx(0);
        setShowOptions(false);
        setPendingNextNode(null);
        setPendingNodeExit(false);
        return;
      }
    }

    // flavor 类型（默认行为）：直接跳转
    if (opt.script_flow) {
      const optionLines = buildOptionLines(opt);
      const optionSentences = optionLines.map(line => line.text);
      const optionSentenceTypes = optionLines.map(line => line.type);
      if (optionSentences.length > 0) {
        const playerReply = buildOptionReply(opt);
        setSentences([playerReply, ...optionSentences]);
        setSentenceTypes(['inner' as const, ...optionSentenceTypes]);
        setCurrentIdx(0);
        setShowOptions(false);
        const nextTarget = opt.next_node || (currentExit?.kind === 'next' ? currentExit.target : null);
        setPendingNextNode(nextTarget);
        setPendingNodeExit(!nextTarget);
        return;
      }
    }

    if (opt.immediate_response) {
      setSentences([`「${(opt.text || opt.option).replace(/^[「」]+|[「」]+$/g, '')}」`, opt.immediate_response]);
      setCurrentIdx(0);
      setShowOptions(false);
      const nextTarget = opt.next_node || (currentExit?.kind === 'next' ? currentExit.target : null);
      setPendingNextNode(nextTarget);
      setPendingNodeExit(!nextTarget);
      return;
    }

    if (opt.next_node) {
      onNodeChange(opt.next_node);
    } else {
      followExit(currentExit);
    }
  };

  if (!currentNode) return null;

  const options = currentNode.player_options?.map((opt, idx: number) => {
    const branchType = getOptionBranchType(opt);
    const isChoice = branchType === 'choice';
    return {
      label: getOptionLabel(opt),
      onClick: () => handleOptionClick(opt, idx),
      disabled: (isChoice && completedOptions.has(idx)) || (opt.condition?.need_item ? !discoveredFeatures.includes(opt.condition.need_item) : false),
      disabledReason: (isChoice && completedOptions.has(idx)) ? "已选择" : (opt.condition?.locked_text || "缺少相关线索")
    };
  }) || [];

  const currentSentenceType = sentenceTypes[currentIdx] || 'npc';
  let speakerName = guest.name;
  /*

  // env 类型：环境描述，不显示头像
  if (currentSentenceType === 'env') {
    speakerName = "系统";
  } else if (currentSentenceType === 'inner') {
    speakerName = "我";
  } else if (sentences[currentIdx]?.startsWith('（') && sentences[currentIdx]?.endsWith('）')) {
    // 系统消息
    speakerName = "系统";
  } else if (sentences[currentIdx]?.includes('调酒进行中')) {
    speakerName = "系统";
  } else if (sentences[currentIdx]?.startsWith('「') && pendingNextNode && currentIdx === 0) {
    // 玩家选择的回复
    speakerName = "我";
  }

  // 主立绘：始终显示（只要有图片）
  if (currentPresentation.speaker === 'system') {
    speakerName = "绯荤粺";
  } else if (currentPresentation.speaker === 'player') {
    speakerName = "鎴?;
  } else if (currentPresentation.speaker === 'npc') {
    speakerName = guest.name;
  }

  const portraitUrl =
    guest.expressions[portraitExpression] ||
    guest.expressions.dialogue ||
    guest.image;
  const showPortrait = portraitVisible && !!portraitUrl;

  */

  speakerName = resolveSpeakerName(currentSentenceType);

  const portraitUrl = guest.expressions[portraitExpression] || guest.image;
  const showPortrait = portraitVisible && !!portraitUrl;

  return (
    <div className="relative w-full h-full">
      {/* 主立绘：位于对话框左侧，置于下层 z-30 */}
      {showPortrait && (
        <div
          className="absolute left-10 md:left-16 lg:left-24 bottom-0 w-[20rem] h-[30rem] md:w-[24rem] md:h-[34rem] lg:w-[28rem] lg:h-[40rem] z-30 animate-character-enter"
          style={{
            backgroundImage: `url(${portraitUrl})`,
            backgroundSize: 'contain',
            backgroundPosition: 'center bottom',
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}
      <PixelDialogueBox
        speakerName={speakerName}
        speakerAvatarColor={undefined}
        speakerAvatarUrl={undefined}
        text={sentences[currentIdx] || (showOptions ? "（请选择你的回应...）" : "")}
        onNext={!showOptions ? handleNext : undefined}
        options={showOptions ? options : undefined}
        onTypingStateChange={setIsDialogueTyping}
      />
    </div>
  );
}
