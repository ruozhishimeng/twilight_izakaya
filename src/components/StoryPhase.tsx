import React, { useState, useEffect, useCallback, useRef } from 'react';
import PixelDialogueBox from './PixelDialogueBox';
import { Guest, findNodeForGuest } from '../data/gameData';

interface ObservationTrigger {
  prompt: string;
  continue_node: string;
  feature_groups?: string[];
}

interface ScriptFlowItem {
  type: 'env' | 'npc' | 'inner';
  content: string;
}

interface NodePresentation {
  portrait?: 'show' | 'hide' | 'keep';
  expression?: string;
  speaker?: 'npc' | 'system' | 'player';
}

interface Props {
  guest: Guest;
  startNodeId: string;
  currentNodeId: string | null;
  discoveredFeatures: string[];
  onNodeChange: (nodeId: string) => void;
  onEnterMixing: (teachingNode: any, mixingNode: any) => void;
  onEnterObservation: (trigger: ObservationTrigger) => void;
  onComplete: () => void;
  onReward: (reward: any) => void;
  showReward?: boolean;
  onTranscriptLine: (entry: { key: string; speaker: string; text: string }) => void;
}

export default function StoryPhase({ guest, startNodeId, currentNodeId, discoveredFeatures, onNodeChange, onEnterMixing, onEnterObservation, onComplete, onReward, showReward, onTranscriptLine }: Props) {
  const [sentences, setSentences] = useState<string[]>([]);
  const [sentenceTypes, setSentenceTypes] = useState<ScriptFlowItem['type'][]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [pendingNextNode, setPendingNextNode] = useState<string | null>(null);
  const [completedOptions, setCompletedOptions] = useState<Set<number>>(new Set());
  const [rewardPending, setRewardPending] = useState(false);
  const [rewardShownNodeId, setRewardShownNodeId] = useState<string | null>(null);
  const [portraitVisible, setPortraitVisible] = useState(false);
  const [portraitExpression, setPortraitExpression] = useState('dialogue');
  const emittedTranscriptKeysRef = useRef<Set<string>>(new Set());

  const activeNodeId = currentNodeId;
  const currentNode = activeNodeId ? findNodeForGuest(activeNodeId, guest.id, guest.nodeMap!) : null;
  const currentPresentation = (currentNode?.presentation || {}) as NodePresentation;

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

    const combined: string[] = [];
    const combinedTypes: ScriptFlowItem['type'][] = [];

    if (currentNode.script_flow) {
      for (const item of currentNode.script_flow) {
        if (item.type === 'env' || item.type === 'npc' || item.type === 'inner') {
          const lines = Array.isArray(item.content) ? item.content : [item.content || ''];
          for (const line of lines) {
            if (line.trim()) {
              combined.push(line);
              combinedTypes.push(item.type);
            }
          }
        }
      }
    } else {
      if (currentNode.atmosphere_lines) combined.push(...currentNode.atmosphere_lines);
      const content = currentNode.content || currentNode.npc_talking;
      if (content) combined.push(...content);
      if (currentNode.player_inner) combined.push(...currentNode.player_inner);
      if (currentNode.bartender_reflection) combined.push(currentNode.bartender_reflection);
      if (currentNode.bartender_inner) combined.push(currentNode.bartender_inner);
      for (let i = 0; i < combined.length; i++) combinedTypes.push('npc');
    }

    setSentences(combined.length > 0 ? combined : ["..."]);
    setSentenceTypes(combinedTypes);
    setCurrentIdx(0);
    setShowOptions(false);
    setPendingNextNode(null);
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

  const resolveSpeakerName = useCallback((sentenceType: ScriptFlowItem['type']) => {
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

  const isMixingNode = useCallback((node: any) => {
    if (!node) {
      return false;
    }

    const nodeGameAction = node.game_action;
    return (
      nodeGameAction?.type === 'enter_mixing' ||
      nodeGameAction?.action === 'ENTER_MIXING_MODE' ||
      !!node.drink_request ||
      !!node.on_mixing_complete ||
      !!node.on_mixing_fail
    );
  }, []);

  const resolveMixingTransition = useCallback((sourceNode: any, targetNodeId?: string | null) => {
    const targetNode = targetNodeId
      ? findNodeForGuest(targetNodeId, guest.id, guest.nodeMap!)
      : null;

    if (targetNode && isMixingNode(targetNode)) {
      return {
        teachingNode: sourceNode?.teaching ? sourceNode : null,
        mixingNode: targetNode,
      };
    }

    if (sourceNode?.teaching && sourceNode?.next_node) {
      const nextNode = findNodeForGuest(sourceNode.next_node, guest.id, guest.nodeMap!);
      if (isMixingNode(nextNode)) {
        return {
          teachingNode: sourceNode,
          mixingNode: nextNode,
        };
      }
    }

    return null;
  }, [guest, isMixingNode]);

  const enterNodeOrMixing = useCallback((nodeId: string | null | undefined) => {
    if (!nodeId) {
      onComplete();
      return;
    }

    const mixingTransition = resolveMixingTransition(currentNode, nodeId);
    if (mixingTransition) {
      onEnterMixing(mixingTransition.teachingNode, mixingTransition.mixingNode);
      return;
    }

    onNodeChange(nodeId);
  }, [currentNode, onComplete, onEnterMixing, onNodeChange, resolveMixingTransition]);

  const continueFromNodeEnd = useCallback(() => {
    if (pendingNextNode) {
      const next = pendingNextNode;
      setPendingNextNode(null);
      enterNodeOrMixing(next);
      return;
    }

    const mixingTransition = resolveMixingTransition(currentNode, currentNode?.next_node);
    if (mixingTransition) {
      onEnterMixing(mixingTransition.teachingNode, mixingTransition.mixingNode);
      return;
    }

    if (currentNode?.trigger_observation) {
      onEnterObservation(currentNode.trigger_observation);
      return;
    }

    if (currentNode?.player_options && currentNode.player_options.length > 0) {
      const hasChoiceOptions = currentNode.player_options.some(
        (opt: any) => (opt.branchType || opt.branch_type) === 'choice'
      );

      if (hasChoiceOptions) {
        const totalOptions = currentNode.player_options.length;
        if (completedOptions.size === totalOptions && currentNode.next_node) {
          enterNodeOrMixing(currentNode.next_node);
        } else {
          setShowOptions(true);
        }
      } else {
        setShowOptions(true);
      }
    } else if (currentNode?.next_node) {
      enterNodeOrMixing(currentNode.next_node);
    } else {
      onComplete();
    }
  }, [completedOptions, currentNode, enterNodeOrMixing, onComplete, onEnterMixing, onEnterObservation, pendingNextNode, resolveMixingTransition]);

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

      /*
      if (currentNode?.player_options && currentNode.player_options.length > 0) {
        // 检查是否有 choice 类型的选项
        const hasChoiceOptions = currentNode.player_options.some(
          (opt: any) => (opt.branchType || opt.branch_type) === 'choice'
        );

        if (hasChoiceOptions) {
          // 有 choice 类型：检查是否都完成
          const totalOptions = currentNode.player_options.length;
          if (completedOptions.size === totalOptions && currentNode.next_node) {
            onNodeChange(currentNode.next_node);
          } else {
            setShowOptions(true);
          }
        } else {
          // 纯 flavor 类型：直接显示选项
          setShowOptions(true);
        }
      } else if (currentNode?.next_node) {
        onNodeChange(currentNode.next_node);
      } else {
        onComplete();
      }
      */
    }
  };

  const handleOptionClick = (opt: any, idx: number) => {
    const branchType = opt.branchType || opt.branch_type;

    // choice 类型：标记完成，不跳转，继续显示选项
    if (branchType === 'choice') {
      setCompletedOptions(prev => new Set([...prev, idx]));

      if (opt.script_flow) {
        const optionSentences: string[] = [];
        const optionSentenceTypes: ScriptFlowItem['type'][] = [];

        for (const item of opt.script_flow) {
          if (item.type === 'env' || item.type === 'npc' || item.type === 'inner') {
            const lines = Array.isArray(item.content) ? item.content : [item.content || ''];
            for (const line of lines) {
              if (line.trim()) {
                optionSentences.push(line);
                optionSentenceTypes.push(item.type);
              }
            }
          }
        }

        if (optionSentences.length > 0) {
          const rawText = (opt.text || opt.option).replace(/^[「」]+|[「」]+$/g, '');
const playerReply = `「${rawText}」`;
          setSentences([playerReply, ...optionSentences]);
          setSentenceTypes(['inner' as const, ...optionSentenceTypes]);
          setCurrentIdx(0);
          setShowOptions(false);
          setPendingNextNode(null);
          return;
        }
      }

      if (opt.immediate_response) {
        setSentences([`「${(opt.text || opt.option).replace(/^[「」]+|[「」]+$/g, '')}」`, opt.immediate_response]);
        setCurrentIdx(0);
        setShowOptions(false);
        setPendingNextNode(null);
        return;
      }
    }

    // flavor 类型（默认行为）：直接跳转
    if (opt.script_flow) {
      const optionSentences: string[] = [];
      const optionSentenceTypes: ScriptFlowItem['type'][] = [];

      for (const item of opt.script_flow) {
        if (item.type === 'env' || item.type === 'npc' || item.type === 'inner') {
          const lines = Array.isArray(item.content) ? item.content : [item.content || ''];
          for (const line of lines) {
            if (line.trim()) {
              optionSentences.push(line);
              optionSentenceTypes.push(item.type);
            }
          }
        }
      }

      if (optionSentences.length > 0) {
        const rawText = (opt.text || opt.option).replace(/^[「」]+|[「」]+$/g, '');
const playerReply = `「${rawText}」`;
        setSentences([playerReply, ...optionSentences]);
        setSentenceTypes(['inner' as const, ...optionSentenceTypes]);
        setCurrentIdx(0);
        setShowOptions(false);
        setPendingNextNode(opt.next_node || currentNode.next_node);
        return;
      }
    }

    if (opt.immediate_response) {
      setSentences([`「${(opt.text || opt.option).replace(/^[「」]+|[「」]+$/g, '')}」`, opt.immediate_response]);
      setCurrentIdx(0);
      setShowOptions(false);
      setPendingNextNode(opt.next_node || currentNode.next_node);
      return;
    }

    if (opt.next_node) {
      onNodeChange(opt.next_node);
    } else {
      onComplete();
    }
  };

  if (!currentNode) return null;

  const options = currentNode.player_options?.map((opt: any, idx: number) => {
    const branchType = opt.branchType || opt.branch_type;
    const isChoice = branchType === 'choice';
    return {
      label: opt.option || opt.text,
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
      />
    </div>
  );
}
