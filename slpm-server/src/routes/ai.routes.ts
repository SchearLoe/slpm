import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, requireAuth } from '../middleware/auth.js';
import { requireWorkspace } from '../middleware/workspace.js';
import { requireSystemAdmin } from '../middleware/admin.js';
import { ApiError } from '../middleware/error.js';
import { encrypt, decrypt } from '../lib/crypto.js';

const router = Router();

// ============ 内部辅助：取配置单例（不存在则建空默认） ============

async function getConfig(createIfMissing = false) {
  let cfg = await prisma.systemConfig.findUnique({ where: { id: 'singleton' } });
  if (!cfg && createIfMissing) {
    cfg = await prisma.systemConfig.create({ data: { id: 'singleton' } });
  }
  return cfg;
}

// 返回脱敏后的配置（不暴露明文 key）
function maskConfig(cfg: { aiBaseUrl: string; aiModel: string; aiTemperature: number; aiApiKey: string } | null) {
  if (!cfg) return { aiBaseUrl: '', aiModel: '', aiTemperature: 0.4, hasApiKey: false, apiKeyMasked: '' };
  const hasKey = cfg.aiApiKey.length > 0;
  return {
    aiBaseUrl: cfg.aiBaseUrl,
    aiModel: cfg.aiModel,
    aiTemperature: cfg.aiTemperature,
    hasApiKey: hasKey,
    // 掩码：仅显示后 4 位（够管理员识别是否已配置 + 大致来源）
    apiKeyMasked: hasKey ? `••••${cfg.aiApiKey.slice(-4)}` : '',
  };
}

/**
 * P7 安全修复：校验 AI baseURL，防 SSRF。
 * 强制 http/https 协议；拒绝私网/保留段（127.0.0.0/8、10/8、172.16/12、192.168/16、169.254/16、::1）。
 * 注意：只做静态 URL 解析，DNS 解析后的二次校验（防 rebinding）留给生产网关。
 */
function validateAiBaseUrl(raw: string): { ok: boolean; error?: string } {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, error: 'AI baseURL 不是合法 URL' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, error: 'AI baseURL 必须是 http 或 https 协议' };
  }
  const host = u.hostname.toLowerCase();
  // 拒绝 IP 字面量形式的私网/保留段
  const ipMatch = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipMatch) {
    const [a, b] = [Number(ipMatch[1]), Number(ipMatch[2])];
    const isPrivate =
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 0);
    if (isPrivate) return { ok: false, error: 'AI baseURL 不能指向内网/保留地址' };
  }
  if (host === 'localhost' || host === '::1' || host.endsWith('.localhost')) {
    return { ok: false, error: 'AI baseURL 不能指向本地地址' };
  }
  return { ok: true };
}

// ============ 配置读写（仅 system_admin） ============

// GET /api/ai/config —— 取配置（key 脱敏）
router.get(
  '/config',
  requireAuth,
  requireSystemAdmin,
  asyncHandler(async (_req, res) => {
    const cfg = await getConfig(false);
    res.json({ config: maskConfig(cfg) });
  }),
);

// PUT /api/ai/config —— 更新配置（apiKey 可选，空则保留旧值）
// P7 安全修复：aiBaseUrl 强制 http/https 协议 + 拒绝私网/保留段（防 SSRF）
const configSchema = z.object({
  aiBaseUrl: z.string().max(500).optional(),
  aiModel: z.string().max(100).optional(),
  aiTemperature: z.number().min(0).max(2).optional(),
  apiKey: z.string().max(500).optional(), // 明文，加密后落库；空串/undefined → 保留旧值
});
router.put(
  '/config',
  requireAuth,
  requireSystemAdmin,
  asyncHandler(async (req, res) => {
    const parsed = configSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());
    const d = parsed.data;

    // P7：校验 aiBaseUrl 不是内网/保留地址（防 SSRF 探测元数据服务等）
    if (d.aiBaseUrl !== undefined && d.aiBaseUrl !== '') {
      const validation = validateAiBaseUrl(d.aiBaseUrl);
      if (!validation.ok) throw new ApiError(400, validation.error ?? 'AI baseURL 格式不合法');
    }

    const existing = await getConfig(true); // 不存在则建空默认

    const data: Record<string, unknown> = {};
    if (d.aiBaseUrl !== undefined) data.aiBaseUrl = d.aiBaseUrl;
    if (d.aiModel !== undefined) data.aiModel = d.aiModel;
    if (d.aiTemperature !== undefined) data.aiTemperature = d.aiTemperature;
    // apiKey：非空字符串才更新（加密）；空串/undefined 保留旧值（允许只改其它字段）
    if (typeof d.apiKey === 'string' && d.apiKey.length > 0) {
      data.aiApiKey = encrypt(d.apiKey);
    }

    const updated = await prisma.systemConfig.update({
      where: { id: 'singleton' },
      data,
    });
    res.json({ config: maskConfig(updated) });
  }),
);

// ============ 连通性测试（仅 system_admin） ============

// POST /api/ai/test —— 用当前配置发一条最小消息，验证 baseURL+key 可用
router.post(
  '/test',
  requireAuth,
  requireSystemAdmin,
  asyncHandler(async (req, res) => {
    const cfg = await getConfig(false);
    if (!cfg || !cfg.aiBaseUrl || !cfg.aiApiKey) {
      throw new ApiError(400, '请先配置 baseURL 和 API Key');
    }
    const apiKey = decrypt(cfg.aiApiKey);
    const start = Date.now();
    try {
      const result = await callChatCompletion(cfg, apiKey, [
        { role: 'user', content: '回复"OK"两个字，用于连通性测试。' },
      ]);
      recordUsage(req.user!.sub, req.workspace?.id ?? 'global', 'test', result.usage);
      res.json({ ok: true, latencyMs: Date.now() - start, reply: result.content });
    } catch (e) {
      throw toApiError(e, '连通性测试失败');
    }
  }),
);

// ============ 任务智能建议（工作区成员均可调用） ============

// POST /api/ai/suggest —— body: { task: { title, description?, phase?, status?, priority? } }
const suggestSchema = z.object({
  task: z.object({
    title: z.string().min(1).max(300),
    description: z.string().max(2000).optional().default(''),
    phase: z.string().max(50).optional().default(''),
    status: z.string().max(50).optional().default(''),
    priority: z.string().max(50).optional().default(''),
  }),
});
router.post(
  '/suggest',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const parsed = suggestSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());
    const t = parsed.data.task;

    const cfg = await getConfig(false);
    if (!cfg || !cfg.aiBaseUrl || !cfg.aiApiKey) {
      throw new ApiError(400, '管理员尚未配置 AI（baseURL/API Key），请联系系统管理员在设置页配置');
    }
    const apiKey = decrypt(cfg.aiApiKey);

    const userContent = [
      `任务标题：${t.title}`,
      t.description ? `任务描述：${t.description}` : '',
      t.phase ? `当前阶段：${t.phase}` : '',
      t.status ? `状态：${t.status}` : '',
      t.priority ? `优先级：${t.priority}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const systemPrompt =
      '你是项目管理助手。根据给定任务信息，给出 2-3 条简洁可执行的建议（如风险提示、关联资源、下一步行动）。' +
      '严格用 JSON 格式返回：{"suggestions":["建议1","建议2"],"confidence":85}，confidence 是 0-100 的整体判断置信度。不要输出其它内容。';

    try {
      const result = await callChatCompletion(
        cfg,
        apiKey,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        { temperature: cfg.aiTemperature },
      );
      // 解析 JSON（容错：模型可能带 ```json ``` 包裹）
      const parsed2 = parseJsonFromModel(result.content);
      recordUsage(req.user!.sub, req.workspace!.id, 'suggest', result.usage);
      res.json({
        suggestions: Array.isArray(parsed2.suggestions) ? parsed2.suggestions.slice(0, 5) : [],
        confidence: typeof parsed2.confidence === 'number' ? parsed2.confidence : 80,
      });
    } catch (e) {
      throw toApiError(e, 'AI 调用失败');
    }
  }),
);

// POST /api/ai/suggest/stream —— 任务智能建议（流式 SSE）
// 逐 token 推给前端：data: {"delta":"..."}，结束时 data: {"done":true,"confidence":80}
router.post(
  '/suggest/stream',
  requireAuth,
  requireWorkspace,
  asyncHandler(async (req, res) => {
    const parsed = suggestSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, '参数校验失败', parsed.error.flatten());
    const t = parsed.data.task;

    const cfg = await getConfig(false);
    if (!cfg || !cfg.aiBaseUrl || !cfg.aiApiKey) {
      throw new ApiError(400, '管理员尚未配置 AI（baseURL/API Key），请联系系统管理员在设置页配置');
    }
    const apiKey = decrypt(cfg.aiApiKey);

    const userContent = [
      `任务标题：${t.title}`,
      t.description ? `任务描述：${t.description}` : '',
      t.phase ? `当前阶段：${t.phase}` : '',
      t.status ? `状态：${t.status}` : '',
      t.priority ? `优先级：${t.priority}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    // 流式用「每行一条建议」格式，便于前端增量按行展示
    const systemPrompt =
      '你是项目管理助手。根据给定任务信息，给出 2-3 条简洁可执行的建议（每条一行，不要编号不要 markdown）。' +
      '直接输出建议内容，每行一条，不要任何额外说明。';

    // SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx 不缓冲
    res.flushHeaders?.();

    // 客户端断开时 abort 上游
    const abortCtrl = new AbortController();
    req.on('close', () => abortCtrl.abort());

    // 增量推 delta
    const onDelta = (delta: string) => {
      res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    };

    try {
      const usage = await callChatCompletionStream(
        cfg,
        apiKey,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        onDelta,
        { temperature: cfg.aiTemperature, signal: abortCtrl.signal },
      );
      recordUsage(req.user!.sub, req.workspace!.id, 'suggest-stream', usage);
      res.write(`data: ${JSON.stringify({ done: true, confidence: 80 })}\n\n`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '未知错误';
      res.write(`data: ${JSON.stringify({ error: msg.slice(0, 200) })}\n\n`);
    } finally {
      res.end();
    }
  }),
);

// GET /api/ai/usage —— Token 用量聚合（近 30 天，仅 system_admin）
router.get(
  '/usage',
  requireAuth,
  requireSystemAdmin,
  asyncHandler(async (_req, res) => {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const records = await prisma.aiUsageRecord.findMany({
      where: { createdAt: { gte: since } },
      select: { promptTokens: true, completionTokens: true, totalTokens: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const totalTokens = records.reduce((s, r) => s + r.totalTokens, 0);
    const promptTokens = records.reduce((s, r) => s + r.promptTokens, 0);
    const completionTokens = records.reduce((s, r) => s + r.completionTokens, 0);

    // 按日聚合（YYYY-MM-DD）
    const byDayMap = new Map<string, number>();
    for (const r of records) {
      const day = r.createdAt.toISOString().slice(0, 10);
      byDayMap.set(day, (byDayMap.get(day) ?? 0) + r.totalTokens);
    }
    const byDay = [...byDayMap.entries()].map(([date, tokens]) => ({ date, tokens }));

    res.json({
      usage: {
        totalTokens,
        promptTokens,
        completionTokens,
        count: records.length,
        byDay,
      },
    });
  }),
);

// ============ 内部辅助 ============

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** P1-5：OpenAI 兼容的 token 用量 */
interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/** P1-5：best-effort 记录 AI 用量（失败仅日志，不影响主流程） */
function recordUsage(userId: string, workspaceId: string, endpoint: string, usage: TokenUsage) {
  prisma.aiUsageRecord
    .create({
      data: {
        userId,
        workspaceId,
        endpoint,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
    })
    .catch((e) => console.error('[aiUsage] 记录失败', e));
}

/** 调 OpenAI 兼容 /chat/completions，返回 { content, raw, usage } */
async function callChatCompletion(
  cfg: { aiBaseUrl: string; aiModel: string },
  apiKey: string,
  messages: ChatMessage[],
  opts: { temperature?: number } = {},
): Promise<{ content: string; raw: unknown; usage: TokenUsage }> {
  const url = `${cfg.aiBaseUrl.replace(/\/+$/, '')}/chat/completions`;
  const body: Record<string, unknown> = {
    model: cfg.aiModel,
    messages,
    temperature: opts.temperature ?? 0.4,
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000), // 30s 超时
  });
  if (!resp.ok) {
    // P7 安全修复：上游错误细节仅写服务端日志，不透传给客户端（防泄露 URL/密钥信息）
    const errText = await resp.text().catch(() => '');
    console.warn(`[ai] 上游返回 ${resp.status}: ${errText.slice(0, 300)}`);
    throw new ApiError(502, 'AI 上游服务暂不可用，请稍后重试或检查配置');
  }
  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: TokenUsage;
  };
  const content = data.choices?.[0]?.message?.content ?? '';
  return { content, raw: data, usage: data.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } };
}

/**
 * P1-5：流式调 OpenAI 兼容 /chat/completions（stream: true）。
 * 逐 delta 回调 onDelta(text)；返回最终 usage（从末尾的 chunk 提取）。
 */
async function callChatCompletionStream(
  cfg: { aiBaseUrl: string; aiModel: string },
  apiKey: string,
  messages: ChatMessage[],
  onDelta: (text: string) => void,
  opts: { temperature?: number; signal?: AbortSignal } = {},
): Promise<TokenUsage> {
  const url = `${cfg.aiBaseUrl.replace(/\/+$/, '')}/chat/completions`;
  const body: Record<string, unknown> = {
    model: cfg.aiModel,
    messages,
    temperature: opts.temperature ?? 0.4,
    stream: true,
    // 请求 stream_options 让上游在末尾 chunk 返回 usage
    stream_options: { include_usage: true },
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: opts.signal ?? AbortSignal.timeout(60000), // 流式放宽到 60s
  });
  if (!resp.ok) {
    // P7 安全修复：上游错误细节仅写服务端日志
    const errText = await resp.text().catch(() => '');
    console.warn(`[ai/stream] 上游返回 ${resp.status}: ${errText.slice(0, 300)}`);
    throw new ApiError(502, 'AI 上游服务暂不可用，请稍后重试或检查配置');
  }
  if (!resp.body) throw new ApiError(502, '上游未返回流');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let usage: TokenUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  // SSE 分块可能跨 chunk，按行缓冲解析
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? ''; // 保留最后不完整的行
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const chunk = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
          usage?: TokenUsage;
        };
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) onDelta(delta);
        if (chunk.usage) usage = chunk.usage;
      } catch {
        // 单个 chunk 解析失败忽略（可能是心跳/部分包）
      }
    }
  }
  return usage;
}

/** 从模型回复里提取 JSON（容错 ```json 包裹 / 前后多余文本） */
function parseJsonFromModel(text: string): { suggestions?: string[]; confidence?: number } {
  // 去掉 ```json ... ``` 包裹
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1] : text;
  try {
    return JSON.parse(candidate.trim());
  } catch {
    // 兜底：找第一个 { ... }
    const objMatch = candidate.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]);
      } catch {
        /* fallthrough */
      }
    }
    return {};
  }
}

/** 把上游/解密等错误统一转成 ApiError */
function toApiError(e: unknown, fallbackMsg: string): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof Error) {
    // AbortError（超时）
    if (e.name === 'AbortError') return new ApiError(504, 'AI 请求超时（30s）');
    return new ApiError(502, `${fallbackMsg}: ${e.message.slice(0, 200)}`);
  }
  return new ApiError(500, fallbackMsg);
}

export default router;
