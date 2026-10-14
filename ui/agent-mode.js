/**
 * Agent 模式 —— UI 插件
 *
 * 一个 ui 插件同时拥有 ctx.ui（挂侧边栏）与 ctx.systemPrompt（注入提示词）。
 * 开关状态存在 plugins-config.json（侧边栏与插件逻辑都能读到）。
 */
export const name = 'agent-mode';

const PLUGIN_ID = 'agent-mode';

/** 委派准则（注入系统提示词） */
const GUIDE = [
  '## Agent 委派准则',
  '',
  '你应当像一个真正的 agent 那样工作——主动把合适的任务委派给子代理，而不是全部自己扛。',
  '',
  '**何时委派**（用 runAgent(name, task)）：',
  '- 大范围搜索/探索：需要扫很多文件才能定位时，委派子代理，只拿结论。',
  '- 独立子任务：与主线弱耦合、可并行推进的活（如"写测试""查文档"）。',
  '- 上下文保护：会产出大量中间信息、但只需摘要的任务，委派后只回摘要。',
  '- 需要专精：有对口的专用子代理（如 arch-guard / tool-smith / build-doctor）时优先用它。',
  '',
  '**何时不委派**：',
  '- 单步、直接的小操作（读一个文件、跑一条命令）——自己做完更快。',
  '- 需要主线连续上下文才能判断的任务。',
  '',
  '**委派时**：给子代理清晰、自包含的任务描述（它没有你的上下文）。收到摘要后，据此继续推进。',
].join('\n');

/** 生成侧边栏面板 HTML（内联 onchange 可直接用，避免 innerHTML 里 <script> 不执行的问题） */
function panelHtml(enabled) {
  var checked = enabled ? ' checked' : '';
  return '<div style="padding:14px">' +
    '<div style="font-size:13px;font-weight:600;color:var(--ck-text);margin-bottom:5px">Agent 模式</div>' +
    '<div style="font-size:11px;color:var(--ck-text-dim);line-height:1.6;margin-bottom:14px">' +
      '开启后，AI 会更主动地把任务委派给子代理（大范围搜索、独立子任务、上下文保护），像真正的 agent。' +
    '</div>' +
    '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--ck-text)">' +
      '<input type="checkbox" id="agent-mode-toggle"' + checked +
      ' onchange="window.shellAPI.pluginConfigSet(\'' + PLUGIN_ID + '\',{enabled:this.checked})" style="cursor:pointer">' +
      '启用委派准则' +
    '</label>' +
    '<div style="font-size:11px;color:var(--ck-text-dim);margin-top:10px;line-height:1.6">' +
      '提示词在<strong>新会话</strong>（重新初始化项目）后生效。' +
    '</div>' +
  '</div>';
}

export function apply(ctx) {
  ctx.log('agent-mode 已激活');
  var API = (window && window.electronAPI) || null;

  function readEnabled() {
    if (!API || typeof API.pluginConfigGet !== 'function') return Promise.resolve(true);
    return API.pluginConfigGet(PLUGIN_ID).then(function (r) {
      if (r && r.success && r.values) return r.values.enabled !== false;
      return true;
    }).catch(function () { return true; });
  }

  function applyPrompt(on) {
    try {
      ctx.systemPrompt.section({ name: 'agent-mode-guide', order: 50, text: on ? GUIDE : '' });
    } catch (e) { /* ignore */ }
  }

  readEnabled().then(function (enabled) {
    applyPrompt(enabled);
    // 挂侧边栏面板（ui 插件专属能力）
    try {
      if (ctx.ui && ctx.ui.shell && typeof ctx.ui.shell.addSidebarPanel === 'function') {
        ctx.ui.shell.addSidebarPanel({ id: PLUGIN_ID, title: 'Agent 模式', merge: true, icon: '<svg class="ck-ab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>', html: panelHtml(enabled) });
      }
    } catch (e) { ctx.log('挂侧边栏失败: ' + (e && e.message ? e.message : e)); }

    // 轮询开关变化（侧边栏改 → 插件同步）
    ctx.effect(function () {
      var last = enabled;
      var t = setInterval(function () {
        readEnabled().then(function (cur) {
          if (cur !== last) { last = cur; applyPrompt(cur); ctx.log('开关 -> ' + (cur ? '开' : '关')); }
        });
      }, 2500);
      return function () { clearInterval(t); };
    });
  });
}
