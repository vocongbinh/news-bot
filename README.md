# news-bot

Personal curated software-engineering reading digest delivered to Telegram via GitHub Actions.

## What it does

1. Fetches RSS feeds + Hacker News
2. Filters for SE-relevant topics (AI/tooling, interviews, system design, etc.)
3. Cleans article text and summarizes with Gemini Flash
4. Sends a timed digest to Telegram (header + one message per article)
5. Commits `state/seen.json` so articles are not resent

## Setup

1. Create a Telegram bot with BotFather and note the token
2. DM the bot, then get your chat id
3. Get a Gemini API key
4. In the GitHub repo settings, add secrets:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `GEMINI_API_KEY`
5. Edit `config/sources.yaml` and `config/topics.yaml`

## Local run

```bash
cp .env.example .env
# fill real values, or keep DRY_RUN=1
export $(grep -v '^#' .env | xargs)
npm install
npm test
npm run digest
```

## Schedule

Workflow: `.github/workflows/digest.yml`

- 07:00 / 12:00 / 19:00 Asia/Ho_Chi_Minh
- Manual: Actions → Reading Digest → Run workflow

## Docs

- Design: `docs/superpowers/specs/2026-09-24-curated-news-digest-bot-design.md`
- Plan: `docs/superpowers/plans/2026-09-24-curated-news-digest-bot.md`
