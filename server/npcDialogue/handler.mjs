import { buildMiniMaxNpcDialogueMessages } from './promptBuilder.mjs';
import { requestMiniMaxNpcDialogue, MiniMaxProviderError } from './provider.mjs';
import { parseModelOutput, validateNpcDialogueResponse } from './responseParser.mjs';
import { buildUnsupportedNpcDialogueResponse, moderateNpcDialogueInput } from './safety.mjs';
import { validateNpcDialogueRequest } from './schema.mjs';

export async function handleNpcDialogueRequest(body) {
  const validation = validateNpcDialogueRequest(body);

  if (!validation.ok) {
    return {
      status: 400,
      body: {
        error: validation.error,
      },
    };
  }

  try {
    const moderation = moderateNpcDialogueInput(validation.value.playerText);
    if (!moderation.allowed) {
      return {
        status: 200,
        body: buildUnsupportedNpcDialogueResponse(moderation, validation.value.playerText.length),
      };
    }

    const promptPayload = buildMiniMaxNpcDialogueMessages(validation.value);
    const providerResult = await requestMiniMaxNpcDialogue(promptPayload);
    const parsedOutput = parseModelOutput(providerResult.content);
    const responseValidation = validateNpcDialogueResponse(parsedOutput);

    if (!responseValidation.ok) {
      return {
        status: 502,
        body: {
          error: responseValidation.error,
        },
      };
    }

    return {
      status: 200,
      body: {
        ...responseValidation.value,
        usage: providerResult.usage,
      },
    };
  } catch (error) {
    if (error instanceof MiniMaxProviderError) {
      return {
        status: error.status,
        body: {
          error: error.message,
        },
      };
    }

    return {
      status: 502,
      body: {
        error: '对话服务返回了无效内容。',
      },
    };
  }
}
