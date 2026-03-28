import React, { useState, useEffect } from 'react';
import PixelDialogueBox from './PixelDialogueBox';
import { Guest, findNodeForGuest } from '../data/gameData';

interface Props {
  guest: Guest;
  startNodeId: string;
  currentNodeId: string | null;
  discoveredFeatures: string[];
  onNodeChange: (nodeId: string) => void;
  onEnterMixing: (teachingNode: any, mixingNode: any) => void;
  onComplete: () => void;
  onReward: (reward: any) => void;
}

export default function StoryPhase({ guest, startNodeId, currentNodeId, discoveredFeatures, onNodeChange, onEnterMixing, onComplete, onReward }: Props) {
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [pendingNextNode, setPendingNextNode] = useState<string | null>(null);

  const activeNodeId = currentNodeId;
  const currentNode = activeNodeId ? findNodeForGuest(activeNodeId, guest.id, guest.nodeMap!) : null;

  useEffect(() => {
    if (currentNode) {
      let msg = "";
      if (currentNode.script_flow) {
        for (const item of currentNode.script_flow) {
          const content = Array.isArray(item.content) ? item.content.join('\n') : (item.content || '');
          if (item.type === 'env' || item.type === 'npc' || item.type === 'inner') {
            msg += (msg ? '\n\n' : '') + content;
          }
        }
      } else {
        if (currentNode.atmosphere_lines) msg += currentNode.atmosphere_lines.join('\n');
        const content = currentNode.content || currentNode.npc_talking;
        if (content) msg += (msg ? '\n\n' : '') + content.join('\n\n');
        if (currentNode.player_inner) msg += (msg ? '\n\n' : '') + currentNode.player_inner.join('\n\n');
        if (currentNode.bartender_reflection) msg += (msg ? '\n\n' : '') + currentNode.bartender_reflection;
        if (currentNode.bartender_inner) msg += (msg ? '\n\n' : '') + currentNode.bartender_inner;
      }

      const splitRegex = /([。！？\n]+[\s]*[」”’』）)]*)/;
      const parts = msg.split(splitRegex);
      const combined = [];
      for (let i = 0; i < parts.length; i += 2) {
        if (parts[i].trim()) {
          combined.push((parts[i] + (parts[i + 1] || '')).trim());
        }
      }
      if (combined.length === 0 && msg.trim()) {
        combined.push(msg);
      }
      
      setSentences(combined.length > 0 ? combined : ["..."]);
      setCurrentIdx(0);
      setShowOptions(false);
      setPendingNextNode(null);

      // Check for rewards
      if (currentNode.reward) {
        onReward(currentNode.reward);
      }
    } else {
      onComplete();
    }
  }, [activeNodeId, guest]);

  const handleNext = () => {
    if (currentIdx < sentences.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      if (pendingNextNode) {
        const next = pendingNextNode;
        setPendingNextNode(null);
        onNodeChange(next);
        return;
      }

      const gameAction = currentNode?.game_action || currentNode?.teaching?.game_action;
      if (gameAction && (gameAction.type === 'enter_mixing' || gameAction.action === 'ENTER_MIXING_MODE')) {
        const mixingNode = findNodeForGuest(currentNode.next_node, guest.id, guest.nodeMap!);
        onEnterMixing(currentNode, mixingNode);
        return;
      }

      if (currentNode?.player_options && currentNode.player_options.length > 0) {
        setShowOptions(true);
      } else if (currentNode?.next_node) {
        onNodeChange(currentNode.next_node);
      } else {
        onComplete();
      }
    }
  };

  const handleOptionClick = (opt: any) => {
    let replyMsg = "";
    if (opt.script_flow) {
      for (const item of opt.script_flow) {
        const content = Array.isArray(item.content) ? item.content.join('\n') : (item.content || '');
        replyMsg += (replyMsg ? '\n\n' : '') + content;
      }
    } else if (opt.immediate_response) {
      replyMsg = opt.immediate_response;
    }

    if (replyMsg) {
      setSentences([`「${opt.text || opt.option}」`, replyMsg]);
      setCurrentIdx(0);
      setShowOptions(false);
      setPendingNextNode(opt.next_node);
    } else {
      if (opt.next_node) {
        onNodeChange(opt.next_node);
      } else {
        onComplete();
      }
    }
  };

  if (!currentNode) return null;

  const options = currentNode.player_options?.map((opt: any) => ({
    label: opt.option || opt.text,
    onClick: () => handleOptionClick(opt),
    disabled: opt.condition?.need_item ? !discoveredFeatures.includes(opt.condition.need_item) : false,
    disabledReason: opt.condition?.locked_text || "缺少相关线索"
  })) || [];

  let speakerName = guest.name;
  if (sentences[currentIdx]?.startsWith('「') && pendingNextNode && currentIdx === 0) {
    speakerName = "我";
  } else if (sentences[currentIdx]?.startsWith('（') && sentences[currentIdx]?.endsWith('）')) {
    speakerName = "系统";
  } else if (sentences[currentIdx]?.includes('调酒进行中')) {
    speakerName = "系统";
  }

  return (
    <>
      <div className="absolute inset-0 flex items-center justify-center pb-32">
         {guest.image ? (
           <img 
             src={guest.image} 
             alt={guest.name} 
             className="w-64 h-96 object-contain shadow-[0_0_30px_rgba(0,0,0,0.8)] border-4 border-[#1a110c]" 
             referrerPolicy="no-referrer"
           />
         ) : (
           <div 
            className="w-64 h-96 shadow-[0_0_30px_rgba(0,0,0,0.8)] border-4 border-[#1a110c]"
            style={{ backgroundColor: guest.imagePlaceholderColor }}
          ></div>
         )}
      </div>
      <PixelDialogueBox 
        speakerName={speakerName}
        speakerAvatarColor={speakerName === "我" ? "#8b5a2b" : guest.avatarColor}
        text={sentences[currentIdx] || (showOptions ? "（请选择你的回应...）" : "")}
        onNext={!showOptions ? handleNext : undefined}
        options={showOptions ? options : undefined}
      />
    </>
  );
}
