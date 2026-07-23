import { handleNpcDialogueRequest } from '../server/npcDialogue/handler.mjs';
import { parseMiniMaxAuthorizationHeader } from '../server/npcDialogue/apiKey.mjs';
import { jsonResponse, readJsonRequest } from './_utils/http.mjs';

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return jsonResponse(405, {
        error: '当前接口只支持 POST 请求。',
      });
    }

    const auth = parseMiniMaxAuthorizationHeader(request.headers.get('authorization'));
    if (!auth.ok) {
      return jsonResponse(401, {
        error: auth.error,
      });
    }

    let body;
    try {
      body = await readJsonRequest(request);
    } catch {
      return jsonResponse(400, {
        error: '请求体必须是有效 JSON。',
      });
    }

    const result = await handleNpcDialogueRequest(body, {
      apiKey: auth.apiKey,
      signal: request.signal,
      includeDebug: body?.debug === true,
    });
    return jsonResponse(result.status, result.body);
  },
};
