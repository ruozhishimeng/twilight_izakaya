import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  CharacterReward,
  NarrativeObservationExit,
  NodePlayerOption,
  NodePresentation,
  ScriptFlowStep,
} from '../data/content/types';
import { resolveNodeExit } from '../data/content/narrative';
import {
  getNarrativeOptionKey,
  interpretNodeCompletion,
  type NarrativeDirective,
  type TailChatResume,
} from '../data/content/interpreter';
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
  onEnterTailChatBeforeNextNode?: (node: CharacterNode, resume: TailChatResume) => void;
  onOptionSelected?: (node: CharacterNode, option: NodePlayerOption) => void;
  onNodeCompleted?: (node: CharacterNode) => void;
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
  onOptionSelected,
  onNodeCompleted,
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
  const [pendingDirective, setPendingDirective] = useState<NarrativeDirective | null>(null);
  const [completedOptionKeys, setCompletedOptionKeys] = useState<Set<string>>(new Set());
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
  const availableOptionKeys = useMemo(() => {
    return currentNode?.player_options
      ?.map((option, index) => ({ option, key: getNarrativeOptionKey(option, index) }))
      .filter(({ option }) => (
        !option.condition?.need_item || discoveredFeatures.includes(option.condition.need_item)
      ))
      .map(({ key }) => key) || [];
  }, [currentNode, discoveredFeatures]);
  const optionContext = useMemo(() => ({
    availableOptionKeys,
    completedOptionKeys: [...completedOptionKeys],
  }), [availableOptionKeys, completedOptionKeys]);

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
    setPendingDirective(null);
    setCompletedOptionKeys(new Set());
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

  const followDirective = useCallback((directive: NarrativeDirective | null) => {
    if (!directive || !currentNode) {
      onComplete();
      return;
    }

    if (directive.kind === 'await_choice') {
      setCompletedOptionKeys(new Set(directive.completedOptionKeys));
      setShowOptions(true);
      return;
    }

    onNodeCompleted?.(currentNode);

    switch (directive.kind) {
      case 'node':
        onNodeChange(directive.nodeId);
        return;
      case 'tail_chat':
        if (onEnterTailChatBeforeNextNode) {
          onEnterTailChatBeforeNextNode(currentNode, directive.resume);
        } else if (directive.resume.kind === 'node') {
          onNodeChange(directive.resume.nodeId);
        } else {
          onComplete();
        }
        return;
      case 'observation':
        onEnterObservation({
          kind: 'observation',
          prompt: directive.prompt,
          continue_node: directive.continueNodeId,
          feature_groups: directive.featureGroups,
        });
        return;
      case 'mixing':
        onEnterMixing(currentNode.teaching ? currentNode : null, currentNode);
        return;
      case 'end_visit':
        onComplete();
    }
  }, [
    currentNode,
    onComplete,
    onEnterMixing,
    onEnterObservation,
    onEnterTailChatBeforeNextNode,
    onNodeChange,
    onNodeCompleted,
  ]);

  const continueFromNodeEnd = useCallback(() => {
    if (!currentNode) {
      onComplete();
      return;
    }

    if (pendingDirective) {
      const directive = pendingDirective;
      setPendingDirective(null);
      followDirective(directive);
      return;
    }

    followDirective(interpretNodeCompletion(currentNode, undefined, optionContext));
  }, [
    currentNode,
    followDirective,
    onComplete,
    optionContext,
    pendingDirective,
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
      !pendingDirective &&
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
    pendingDirective,
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
    if (!currentNode) {
      return;
    }

    const directive = interpretNodeCompletion(currentNode, idx, optionContext);
    onOptionSelected?.(currentNode, opt);

    // 展示差异回应后，再执行解释器给出的统一出口或逐项查看进度。
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
        setPendingDirective(directive);
        return;
      }
    }

    if (opt.immediate_response) {
      setSentences([`「${(opt.text || opt.option).replace(/^[「」]+|[「」]+$/g, '')}」`, opt.immediate_response]);
      setSentenceTypes(['inner', 'npc']);
      setCurrentIdx(0);
      setShowOptions(false);
      setPendingDirective(directive);
      return;
    }

    followDirective(directive);
  };

  if (!currentNode) return null;

  const options = currentNode.player_options?.map((opt, idx: number) => {
    const optionKey = getNarrativeOptionKey(opt, idx);
    const isCompleted = completedOptionKeys.has(optionKey);
    const needsMissingItem = opt.condition?.need_item
      ? !discoveredFeatures.includes(opt.condition.need_item)
      : false;
    return {
      label: getOptionLabel(opt),
      onClick: () => handleOptionClick(opt, idx),
      disabled: isCompleted || needsMissingItem,
      disabledReason: isCompleted ? "已选择" : (opt.condition?.locked_text || "缺少相关线索")
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
