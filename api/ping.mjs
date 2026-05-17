import { jsonResponse } from './_utils/http.mjs';

export default {
  fetch() {
    return jsonResponse(200, {
      message: 'pong',
      service: 'twilight-izakaya-vercel',
    });
  },
};
