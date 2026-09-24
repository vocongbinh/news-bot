export interface TelegramSendPayload {
  text: string;
  replyMarkup?: unknown;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendTelegramMessage(input: {
  botToken: string;
  chatId: string;
  text: string;
  replyMarkup?: unknown;
  dryRun?: boolean;
}): Promise<void> {
  if (input.dryRun) {
    console.log('[dry-run telegram]', input.text.slice(0, 120).replaceAll('\n', ' '));
    return;
  }

  const body: Record<string, unknown> = {
    chat_id: input.chatId,
    text: input.text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  if (input.replyMarkup) {
    body.reply_markup = input.replyMarkup;
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${input.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok: boolean; description?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.description ?? `Telegram HTTP ${res.status}`);
      }
      return;
    } catch (err) {
      lastError = err;
      if (attempt < 2) await sleep(500);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function sendDigestMessages(input: {
  botToken: string;
  chatId: string;
  header: string;
  articles: TelegramSendPayload[];
  dryRun?: boolean;
}): Promise<number> {
  await sendTelegramMessage({
    botToken: input.botToken,
    chatId: input.chatId,
    text: input.header,
    dryRun: input.dryRun,
  });

  let sent = 0;
  for (const article of input.articles) {
    await sleep(400);
    try {
      await sendTelegramMessage({
        botToken: input.botToken,
        chatId: input.chatId,
        text: article.text,
        replyMarkup: article.replyMarkup,
        dryRun: input.dryRun,
      });
      sent += 1;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      (error as Error & { sentCount?: number }).sentCount = sent;
      throw error;
    }
  }
  return sent;
}
