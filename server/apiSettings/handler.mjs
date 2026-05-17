import { createApiSettingsState } from './state.mjs';

function getErrorStatus(error) {
  return typeof error?.status === 'number' ? error.status : 400;
}

function normalizeMethod(method) {
  return typeof method === 'string' ? method.toUpperCase() : 'GET';
}

export async function handleApiSettingsRequest(
  request,
  apiSettingsState = createApiSettingsState(),
) {
  const method = normalizeMethod(request?.method);

  if (method === 'GET') {
    return {
      status: 200,
      body: apiSettingsState.getStatus(),
    };
  }

  if (method !== 'POST') {
    return {
      status: 405,
      body: {
        error: '当前接口不支持该请求方法。',
        status: apiSettingsState.getStatus(),
      },
    };
  }

  const mode = typeof request?.body?.mode === 'string' ? request.body.mode : '';

  try {
    if (mode === 'author') {
      const result = await apiSettingsState.useAuthorKey();
      if (!result.ok) {
        return {
          status: result.status || 409,
          body: {
            error: result.error || '无法使用作者 KEY。',
            status: apiSettingsState.getStatus(),
          },
        };
      }

      return {
        status: 200,
        body: result.status,
      };
    }

    if (mode === 'custom') {
      const result = await apiSettingsState.saveCustomKey(request.body?.apiKey);
      return {
        status: 200,
        body: result.status,
      };
    }

    if (mode === 'clear') {
      const result = await apiSettingsState.clearKey();
      return {
        status: 200,
        body: result.status,
      };
    }

    return {
      status: 400,
      body: {
        error: '未知的 API 设置操作。',
        status: apiSettingsState.getStatus(),
      },
    };
  } catch (error) {
    return {
      status: getErrorStatus(error),
      body: {
        error: error instanceof Error ? error.message : 'API 设置更新失败。',
        status: apiSettingsState.getStatus(),
      },
    };
  }
}
