import { createApiSettingsState } from '../../server/apiSettings/state.mjs';
import { handleApiSettingsRequest } from '../../server/apiSettings/handler.mjs';
import { jsonResponse, readJsonRequest } from '../_utils/http.mjs';

const apiSettingsState = createApiSettingsState({
  authorApiKey:
    process.env.TWILIGHT_AUTHOR_MINIMAX_API_KEY ||
    process.env.AUTHOR_MINIMAX_API_KEY ||
    process.env.MINIMAX_API_KEY ||
    '',
  allowCurrentKeyAsAuthor: true,
});

export default {
  async fetch(request) {
    let body = {};

    if (request.method === 'POST') {
      try {
        body = await readJsonRequest(request);
      } catch {
        return jsonResponse(400, {
          error: '请求体必须是有效 JSON。',
          status: apiSettingsState.getStatus(),
        });
      }
    }

    const result = await handleApiSettingsRequest(
      {
        method: request.method,
        body,
      },
      apiSettingsState,
    );

    return jsonResponse(result.status, result.body);
  },
};
