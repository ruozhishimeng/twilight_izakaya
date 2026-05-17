import { handleNpcDialogueRequest } from '../server/npcDialogue/handler.mjs';
import { jsonResponse, readJsonRequest } from './_utils/http.mjs';

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return jsonResponse(405, {
        error: '当前接口只支持 POST 请求。',
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

    const result = await handleNpcDialogueRequest(body);
    return jsonResponse(result.status, result.body);
  },
};
