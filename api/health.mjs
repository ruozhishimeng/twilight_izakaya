import { jsonResponse } from './_utils/http.mjs';

export default {
  fetch() {
    return jsonResponse(200, {
      ok: true,
      service: 'twilight-izakaya-vercel',
      time: new Date().toISOString(),
    });
  },
};
