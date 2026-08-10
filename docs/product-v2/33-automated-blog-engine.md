# LeadThur Automated Blog Engine

**Status:** Implemented (Blocks 1–4 in code). Production DB migration applied. Deploy + live article generation required for final acceptance.

## What was built

Isolated content automation module around the existing `blog_posts` blog (no second blog).

Pipeline: topic discovery → research (Tavily + Serper fallback) → brief → DeepSeek generation → quality (≥90) → revise → OpenAI image → draft/publish via existing blog table → hourly scheduler + Admin controls.

## Defaults

- Daily target: **4** articles
- Automation: **paused** until Admin Resume
- Auto-publish: off until Resume (enables both)

## Env (production Coolify only)

`DEEPSEEK_API_KEY`, `TAVILY_API_KEY`, `SERPER_API_KEY`, `OPENAI_API_KEY`

## Admin

`/admin/content-automation`
