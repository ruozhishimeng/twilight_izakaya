import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import {
  clearMiniMaxKey,
  getApiKeySourceLabel,
  getMiniMaxApiKeyStatus,
  saveCustomMiniMaxKey,
  type ApiKeyStatus,
} from '../services/apiSettings';

interface Props {
  className?: string;
  onStatusChange?: (status: ApiKeyStatus) => void;
}

export function isMiniMaxKeySubmitDisabled(apiKeyInput: string, isSubmitting: boolean): boolean {
  return isSubmitting || apiKeyInput.trim().length === 0;
}

const panelClass = 'border-4 border-[#8b5a2b] bg-[#241914] p-5 pixel-rounded';
const labelClass = 'text-sm font-bold tracking-[0.18em] text-amber-300';
const inputClass =
  'mt-3 w-full rounded border-2 border-[#3e2723] bg-[#1a110c] px-3 py-3 text-base text-[#e8dcc4] outline-none focus:border-amber-500';
const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border-4 border-[#1a110c] bg-[#4a3f35] px-4 py-3 text-base font-bold text-[#e8dcc4] transition-colors hover:bg-[#5c4a3d] disabled:cursor-not-allowed disabled:opacity-50';

export default function ApiSettingsPanel({ className = '', onStatusChange }: Props) {
  const [status, setStatus] = useState<ApiKeyStatus>(() => getMiniMaxApiKeyStatus());
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const applyStatus = useCallback((nextStatus: ApiKeyStatus) => {
    setStatus(nextStatus);
    onStatusChange?.(nextStatus);
  }, [onStatusChange]);

  useEffect(() => {
    applyStatus(getMiniMaxApiKeyStatus());
  }, [applyStatus]);

  const beginSubmit = () => {
    setIsSubmitting(true);
    setMessage(null);
    setErrorMessage(null);
  };

  const handleSaveCustomKey = async () => {
    beginSubmit();

    try {
      const nextStatus = await saveCustomMiniMaxKey(apiKeyInput);
      applyStatus(nextStatus);
      setApiKeyInput('');
      setMessage('MiniMax KEY 已在本次运行中启用。');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '启用 MiniMax KEY 失败。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearKey = async () => {
    beginSubmit();

    try {
      const nextStatus = await clearMiniMaxKey();
      applyStatus(nextStatus);
      setMessage('已从本次运行内存中清除 KEY。');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '清除 KEY 失败。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={`${panelClass} ${className}`}>
      <div className="flex items-center gap-3 border-b-2 border-[#4a3f35] pb-3 text-[#f3e5c5]">
        <KeyRound size={24} />
        <h3 className="text-2xl font-bold">API 设置</h3>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className={labelClass}>当前供应商</div>
          <div className="mt-2 text-xl font-bold text-[#f3e5c5]">MiniMax</div>
          <div className="mt-1 text-sm text-[#9e8968]">
            当前仅支持 MiniMax，模型：{status.model}
          </div>
        </div>
        <div
          className={`rounded-lg border-4 px-4 py-3 text-center ${
            status.configured
              ? 'border-[#4d6b3b] bg-[#24351f] text-[#d9f0c8]'
              : 'border-[#6b3b35] bg-[#351f1c] text-[#f0c8bf]'
          }`}
        >
          <div className="text-sm tracking-[0.2em] opacity-80">KEY</div>
          <div className="mt-1 text-lg font-bold">{getApiKeySourceLabel(status)}</div>
        </div>
      </div>

      <label className="mt-5 block">
        <div className={labelClass}>填写自己的 MiniMax KEY</div>
        <input
          type="password"
          value={apiKeyInput}
          onChange={event => setApiKeyInput(event.target.value)}
          placeholder="sk-api-..."
          autoComplete="off"
          spellCheck={false}
          className={inputClass}
        />
      </label>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => void handleSaveCustomKey()}
          disabled={isMiniMaxKeySubmitDisabled(apiKeyInput, isSubmitting)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border-4 border-[#1a110c] bg-[#5c8a4a] px-4 py-3 text-base font-bold text-amber-100 transition-colors hover:bg-[#6c9a5a] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShieldCheck size={20} />
          本次运行使用
        </button>
        <button
          type="button"
          onClick={() => void handleClearKey()}
          disabled={isSubmitting || !status.configured}
          className={secondaryButtonClass}
        >
          <Trash2 size={20} />
          清除 KEY
        </button>
      </div>

      {message && (
        <div className="mt-4 rounded-lg border-2 border-[#4d6b3b] bg-[#24351f] px-4 py-3 text-sm leading-6 text-[#d9f0c8]">
          {message}
        </div>
      )}
      {errorMessage && (
        <div className="mt-4 rounded-lg border-2 border-[#7a4339] bg-[#341f1b] px-4 py-3 text-sm leading-6 text-[#f0c8bf]">
          {errorMessage}
        </div>
      )}

      <div className="mt-5 space-y-2 border-t-2 border-[#4a3f35] pt-4 text-sm leading-6 text-[#cbb89a]">
        <p>KEY 只保存在当前页面的运行内存中；刷新、关闭或重启后需要重新填写。</p>
        <p>对话时 KEY 会经同源后端转发给 MiniMax；应用不会把它写入磁盘、存档、业务日志或服务端全局状态。</p>
        <p>线上部署仍需确保托管平台和反向代理不会记录 Authorization 请求头。</p>
        <p>建议使用可随时撤销、已设置额度限制的独立 MiniMax KEY。</p>
      </div>
    </section>
  );
}
