import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyRound, RefreshCw, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import {
  clearMiniMaxKey,
  fetchApiKeyStatus,
  getApiKeySourceLabel,
  saveCustomMiniMaxKey,
  useAuthorMiniMaxKey,
  type ApiKeyStatus,
} from '../services/apiSettings';

interface Props {
  className?: string;
  onStatusChange?: (status: ApiKeyStatus) => void;
}

interface ApiSettingsLoadingState {
  isRefreshingStatus: boolean;
  isSubmitting: boolean;
}

export function isAuthorKeyButtonDisabled(
  status: ApiKeyStatus | null,
  loadingState: ApiSettingsLoadingState,
): boolean {
  return loadingState.isSubmitting || status?.supportsAuthorKey === false;
}

const panelClass = 'border-4 border-[#8b5a2b] bg-[#241914] p-5 pixel-rounded';
const labelClass = 'text-sm font-bold tracking-[0.18em] text-amber-300';
const inputClass =
  'mt-3 w-full rounded border-2 border-[#3e2723] bg-[#1a110c] px-3 py-3 text-base text-[#e8dcc4] outline-none focus:border-amber-500';
const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border-4 border-[#1a110c] bg-[#4a3f35] px-4 py-3 text-base font-bold text-[#e8dcc4] transition-colors hover:bg-[#5c4a3d] disabled:cursor-not-allowed disabled:opacity-50';

export default function ApiSettingsPanel({ className = '', onStatusChange }: Props) {
  const [status, setStatus] = useState<ApiKeyStatus | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const statusRequestIdRef = useRef(0);

  const applyStatus = useCallback((nextStatus: ApiKeyStatus) => {
    setStatus(nextStatus);
    onStatusChange?.(nextStatus);
  }, [onStatusChange]);

  const loadStatus = useCallback(async () => {
    const requestId = statusRequestIdRef.current + 1;
    statusRequestIdRef.current = requestId;
    setIsRefreshingStatus(true);
    setErrorMessage(null);

    try {
      const nextStatus = await fetchApiKeyStatus();
      if (requestId === statusRequestIdRef.current) {
        applyStatus(nextStatus);
      }
    } catch (error) {
      if (requestId === statusRequestIdRef.current) {
        setErrorMessage(error instanceof Error ? error.message : '无法读取 API Key 状态。');
      }
    } finally {
      if (requestId === statusRequestIdRef.current) {
        setIsRefreshingStatus(false);
      }
    }
  }, [applyStatus]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const beginSubmit = () => {
    statusRequestIdRef.current += 1;
    setIsRefreshingStatus(false);
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
      setMessage('已使用你填写的 MiniMax KEY。');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '保存 MiniMax KEY 失败。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUseAuthorKey = async () => {
    beginSubmit();

    try {
      const nextStatus = await useAuthorMiniMaxKey();
      applyStatus(nextStatus);
      setApiKeyInput('');
      setMessage('已切换为作者 KEY。');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '无法使用作者 KEY。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearKey = async () => {
    beginSubmit();

    try {
      const nextStatus = await clearMiniMaxKey();
      applyStatus(nextStatus);
      setMessage('已清除当前 KEY。');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '清除 KEY 失败。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={`${panelClass} ${className}`}>
      <div className="flex items-center justify-between gap-4 border-b-2 border-[#4a3f35] pb-3 text-[#f3e5c5]">
        <div className="flex items-center gap-3">
          <KeyRound size={24} />
          <h3 className="text-2xl font-bold">API 设置</h3>
        </div>
        <button
          type="button"
          onClick={() => void loadStatus()}
          disabled={isRefreshingStatus || isSubmitting}
          className="rounded-lg p-2 text-[#d8c7a8] transition-colors hover:bg-[#2c1e16] hover:text-amber-200 disabled:opacity-50"
          title="刷新状态"
        >
          <RefreshCw size={20} className={isRefreshingStatus ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className={labelClass}>当前供应商</div>
          <div className="mt-2 text-xl font-bold text-[#f3e5c5]">MiniMax</div>
          <div className="mt-1 text-sm text-[#9e8968]">
            当前仅支持 MiniMax 密钥，模型：{status?.model || 'MiniMax-M2.5'}
          </div>
        </div>
        <div
          className={`rounded-lg border-4 px-4 py-3 text-center ${
            status?.configured
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
          className={inputClass}
        />
      </label>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <button
          type="button"
          onClick={() => void handleSaveCustomKey()}
          disabled={isSubmitting || !apiKeyInput.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border-4 border-[#1a110c] bg-[#5c8a4a] px-4 py-3 text-base font-bold text-amber-100 transition-colors hover:bg-[#6c9a5a] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShieldCheck size={20} />
          保存 KEY
        </button>
        <button
          type="button"
          onClick={() => void handleUseAuthorKey()}
          disabled={isAuthorKeyButtonDisabled(status, { isRefreshingStatus, isSubmitting })}
          className={secondaryButtonClass}
        >
          <UserRound size={20} />
          使用作者的KEY
        </button>
        <button
          type="button"
          onClick={() => void handleClearKey()}
          disabled={isSubmitting || !status?.configured}
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
        <p>KEY 仅用于本地后端调用 NPC 尾声对话，不会进入存档或对话记录。</p>
        <p>作者 KEY 不会显示明文；如果额度用尽或调用失败，请切换为自己的 MiniMax KEY。</p>
        <p>未配置 KEY 时，开始新游戏会先提示进入此设置界面。</p>
      </div>
    </section>
  );
}
