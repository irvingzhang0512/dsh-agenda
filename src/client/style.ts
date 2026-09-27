/**
 * dsh-agenda — 注入的样式（唯一 `<style>`，全部类名带 `da-` 前缀）。
 *
 * 颜色全部取自 DSH 主题变量（dsh-client-ui-theme 的 --dsw-alias-*，带兜底值），
 * 与「新会话」等主界面保持一致：背景 bg-base、卡片 bg-layer-1、边框 border-l*、
 * 文字 label-*、强调 brand-primary、状态色 state-*。
 */
const CSS = `
.da-root{--da-border:var(--dsw-alias-border-l2,#e5e7eb);--da-border-strong:var(--dsw-alias-border-l3,#d0d3d9);--da-text:var(--dsw-alias-label-primary,#1f2328);--da-text-dim:var(--dsw-alias-label-secondary,#57606a);--da-text-faint:var(--dsw-alias-label-tertiary,#8b949e);--da-accent:var(--dsw-alias-brand-primary,#2f6fed);--da-bg:var(--dsw-alias-bg-base,#f7f8fa);--da-card:var(--dsw-alias-bg-layer-1,#ffffff);--da-card-2:var(--dsw-alias-bg-layer-2,#f2f3f5);--da-hover:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05));--da-holiday:var(--dsw-alias-state-error-primary,#c62828);--da-work:var(--dsw-alias-state-business-primary,#1565c0);--da-ok:var(--dsw-alias-state-success-primary,#2e7d32);--da-warn:var(--dsw-alias-state-warn-primary,#b26a00);
display:flex;flex-direction:column;height:100%;min-height:0;background:var(--da-bg);color:var(--da-text);font-size:14px;line-height:1.5;overflow:hidden;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;}
.da-root *{box-sizing:border-box;}
.da-header{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--da-border-strong);background:var(--da-card);flex:none;}
.da-header h1{font-size:15px;font-weight:600;margin:0;letter-spacing:.2px;}
.da-nav{display:flex;gap:2px;flex:1;justify-content:center;}
.da-nav button{border:0;background:transparent;color:var(--da-text-dim);padding:5px 14px;border-radius:6px;cursor:pointer;font-size:13px;}
.da-nav button:hover{background:var(--da-hover);}
.da-nav button.da-active{background:var(--da-hover);color:var(--da-text);font-weight:600;}
.da-main{flex:1;min-height:0;overflow:auto;padding:16px;}
.da-card{background:var(--da-card);border:1px solid var(--da-border);border-radius:10px;padding:14px;}
.da-btn{border:1px solid var(--da-border);background:var(--da-card);color:var(--da-text);padding:4px 12px;border-radius:6px;cursor:pointer;font-size:13px;}
.da-btn:hover{background:var(--da-hover);}
.da-btn.da-primary{background:var(--da-accent);border-color:var(--da-accent);color:#fff;}
.da-btn.da-primary:hover{filter:brightness(1.05);}
.da-btn.da-danger{color:var(--da-holiday);border-color:color-mix(in srgb,var(--da-holiday) 40%,transparent);}
.da-btn:disabled{opacity:.5;cursor:default;}
.da-input,.da-select,.da-textarea{border:1px solid var(--da-border);border-radius:6px;padding:5px 10px;font-size:13px;background:var(--da-card);color:var(--da-text);}
.da-input:focus,.da-select:focus,.da-textarea:focus{outline:2px solid color-mix(in srgb,var(--da-accent) 35%,transparent);outline-offset:-1px;}
.da-textarea{resize:vertical;min-height:64px;font-family:inherit;}
.da-dim{color:var(--da-text-dim);font-size:12px;}
.da-row{display:flex;align-items:center;gap:8px;}
.da-grow{flex:1;min-width:0;}
.da-divider{height:1px;background:var(--da-border);margin:10px 0;}
.da-list{display:flex;flex-direction:column;gap:4px;}
.da-empty{color:var(--da-text-dim);text-align:center;padding:24px 8px;font-size:13px;}
.da-badge{display:inline-flex;align-items:center;border-radius:6px;padding:0 6px;font-size:11px;line-height:18px;flex:none;}
.da-badge.da-holiday{background:color-mix(in srgb,var(--da-holiday) 12%,transparent);color:var(--da-holiday);}
.da-badge.da-work{background:color-mix(in srgb,var(--da-work) 12%,transparent);color:var(--da-work);}
.da-badge.da-weekend{background:var(--da-hover);color:var(--da-text-dim);}
.da-badge.da-cat{background:color-mix(in srgb,var(--da-accent) 10%,transparent);color:var(--da-accent);}
.da-badge.da-ok{background:color-mix(in srgb,var(--da-ok) 12%,transparent);color:var(--da-ok);}
.da-badge.da-festival{background:color-mix(in srgb,var(--da-warn) 16%,transparent);color:var(--da-warn);}
.da-chip{display:inline-block;padding:1px 8px;border-radius:999px;background:var(--da-hover);color:var(--da-text-dim);font-size:12px;cursor:pointer;}
.da-chip:hover{color:var(--da-text);}
.da-event-item{display:flex;gap:8px;align-items:flex-start;padding:6px 8px;border-radius:8px;cursor:pointer;}
.da-event-item:hover{background:var(--da-hover);}
.da-event-item .da-time{color:var(--da-text-dim);font-size:12px;min-width:86px;flex:none;padding-top:1px;}
.da-event-item .da-title{font-weight:500;}
.da-event-item.da-allday .da-title{font-weight:400;}
.da-todo-item{display:flex;gap:8px;align-items:flex-start;padding:6px 8px;border-radius:8px;cursor:pointer;}
.da-todo-item:hover{background:var(--da-hover);}
.da-todo-item.da-done .da-todo-title{text-decoration:line-through;color:var(--da-text-dim);}
.da-check{width:16px;height:16px;border:1.5px solid var(--da-text-dim);border-radius:50%;flex:none;margin-top:2px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;color:#fff;cursor:pointer;}
.da-check.da-checked{background:var(--da-ok);border-color:var(--da-ok);}
.da-calendar{border:1px solid var(--da-border);border-radius:10px;background:var(--da-card);overflow:hidden;}
.da-cal-header{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--da-border);}
.da-cal-title{font-weight:600;font-size:14px;flex:1;text-align:center;}
.da-grid{display:grid;grid-template-columns:repeat(7,1fr);}
.da-grid-head{display:grid;grid-template-columns:repeat(7,1fr);border-bottom:1px solid var(--da-border);}
.da-grid-head div{text-align:center;padding:6px 0;font-size:12px;color:var(--da-text-dim);}
.da-grid-head div.da-head-nonwork{color:color-mix(in srgb,var(--da-holiday) 60%,var(--da-text-dim));}
.da-day{min-height:96px;border-right:1px solid var(--da-border);border-bottom:1px solid var(--da-border);padding:6px;cursor:pointer;position:relative;display:flex;flex-direction:column;gap:2px;overflow:hidden;}
.da-day:nth-child(7n){border-right:0;}
.da-day:hover{background:var(--da-hover);}
.da-day.da-other{color:var(--da-text-dim);opacity:.55;}
/* 日期格底色体系（MIUI/钉钉式）：周末灰底 / 法定节假日红底 / 调休蓝底 / 今日浅主色底。
 * 次序约定：.da-day:hover 特异性 (0,2,0) 高于这四类 (0,1,0)，悬停反馈始终生效；
 * da-today-cell 定义在三个 dayType 底色类之后，同优先级下覆盖它们；
 * 今天的圆号数字规则（下文）定义在 nonwork 红字规则之后，白字覆盖红字。 */
.da-weekend-cell{background:color-mix(in srgb,var(--da-card-2) 60%,transparent);}
.da-holiday-cell{background:color-mix(in srgb,var(--da-holiday) 7%,transparent);}
.da-adjusted-cell{background:color-mix(in srgb,var(--da-work) 8%,transparent);}
.da-today-cell{background:color-mix(in srgb,var(--da-accent) 6%,transparent);}
.da-day-top{display:flex;align-items:center;gap:4px;justify-content:space-between;}
.da-day-num{font-weight:500;}
.da-day.da-nonwork .da-day-num{color:var(--da-holiday);}
.da-day.da-today-cell .da-day-num{width:24px;height:24px;border-radius:50%;background:var(--da-accent);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:600;}
.da-day-lunar{font-size:11px;color:var(--da-text-dim);}
/* 农历位节日着色：独立类，月视图（da-day-lunar）与周视图列头（da-dim）通用；
 * 定义在两者之后，同优先级下覆盖灰色。 */
.da-lunar-holiday{color:var(--da-holiday);font-weight:600;}
.da-lunar-festival{color:var(--da-warn);font-weight:600;}
.da-day-badges{display:flex;gap:2px;}
.da-ev{font-size:11px;padding:1px 5px;border-radius:5px;background:color-mix(in srgb,var(--da-accent) 10%,transparent);color:var(--da-accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:16px;}
.da-ev.da-allday{background:color-mix(in srgb,var(--da-accent) 18%,transparent);}
.da-ev.da-more{background:transparent;color:var(--da-text-dim);}
.da-week{display:grid;grid-template-columns:56px repeat(7,1fr);grid-template-rows:auto auto 720px;border:1px solid var(--da-border);border-radius:10px;background:var(--da-card);overflow:hidden;}
.da-week .da-whead{display:contents;}
.da-week .da-whead>div{display:flex;flex-direction:column;align-items:center;padding:6px 0;border-left:1px solid var(--da-border);font-size:12px;}
.da-week .da-whead>div:first-child{border-left:0;}
.da-week .da-whead .da-dow{color:var(--da-text-dim);}
.da-week .da-whead .da-dom{font-weight:600;}
.da-week .da-whead .da-nonwork .da-dom{color:var(--da-holiday);}
.da-gutter-hours{grid-column:1;grid-row:3;position:relative;border-top:1px solid var(--da-border);}
.da-week .da-wcol{position:relative;grid-row:3;border-left:1px solid var(--da-border);}
.da-hour{position:absolute;left:0;right:0;border-top:1px solid rgba(0,0,0,.05);font-size:10px;color:var(--da-text-dim);padding-left:2px;transform:translateY(-50%);cursor:pointer;}
.da-wev{position:absolute;left:4px;right:4px;border-radius:6px;background:color-mix(in srgb,var(--da-accent) 12%,transparent);color:var(--da-accent);font-size:11px;padding:2px 6px;overflow:hidden;cursor:pointer;line-height:1.35;}
.da-wev:hover{background:color-mix(in srgb,var(--da-accent) 20%,transparent);}
.da-modal{position:fixed;inset:0;background:var(--dsw-alias-bg-mask-2,rgba(0,0,0,.4));display:flex;align-items:center;justify-content:center;z-index:1000;padding:24px;}
.da-modal-card{background:var(--da-card);border:1px solid var(--da-border);border-radius:12px;padding:18px;width:520px;max-width:100%;max-height:90vh;overflow:auto;box-shadow:0 8px 32px rgba(0,0,0,.18);}
.da-modal-card h2{margin:0 0 14px;font-size:15px;}
.da-form{display:flex;flex-direction:column;gap:10px;}
.da-form .da-field{display:flex;flex-direction:column;gap:4px;}
.da-form label{font-size:12px;color:var(--da-text-dim);}
.da-form .da-inline{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.da-stats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;}
.da-stat-card{background:var(--da-card);border:1px solid var(--da-border);border-radius:10px;padding:12px;}
.da-stat-num{font-size:22px;font-weight:700;}
.da-stat-label{font-size:12px;color:var(--da-text-dim);}
.da-bar{height:8px;border-radius:4px;background:var(--da-hover);overflow:hidden;flex:1;min-width:60px;}
.da-bar>i{display:block;height:100%;background:var(--da-accent);border-radius:4px;}
.da-cat-row{display:flex;align-items:center;gap:8px;font-size:13px;padding:4px 0;}
.da-cat-row .da-cat-name{min-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.da-search-box{display:flex;gap:8px;margin-bottom:14px;}
.da-search-box input{flex:1;}
.da-section-title{font-size:13px;font-weight:600;color:var(--da-text-dim);margin:14px 0 8px;}
.da-tabs{display:flex;gap:8px;margin-bottom:12px;}
.da-tabs button{border:0;background:var(--da-card);color:var(--da-text-dim);border:1px solid var(--da-border);padding:3px 12px;border-radius:6px;cursor:pointer;font-size:12px;}
.da-tabs button.da-active{color:var(--da-text);font-weight:600;border-color:var(--da-accent);}
.da-date-head{display:flex;align-items:baseline;gap:10px;margin-bottom:12px;}
.da-date-head .da-big{font-size:20px;font-weight:700;}
.da-date-head .da-sub{color:var(--da-text-dim);font-size:13px;}
.da-date-head .da-sub.da-nonwork{color:var(--da-holiday);}

/* ── DSH 侧边栏面板条目展示覆盖（非 .da- 体系）──────────────────────────
 * 框架把面板条目渲染为透明灰字行（panelRow），而「新会话」是白卡片（newSession）。
 * 这里把条目卡片化对齐「新会话」；CSS modules 类名为“哈希前缀+原名”，
 * 用 [class*=原名] 稳定匹配，失配时自动降级回框架原生样式（纯视觉，无功能影响）。
 */
body [class*="root"]:not([class*="collapsed"]) nav[class*="panelList"] button[class*="panelRow"]{
  border:.5px solid var(--dsw-alias-border-l3,#d0d3d9);
  background:var(--dsw-alias-button-elevated-fill,#ffffff);
  border-radius:12px;height:38px;min-height:38px;margin:0 2px;
  justify-content:center;gap:6px;padding:8px 16px;
  color:var(--dsw-alias-label-primary,#1f2328);
  font-size:14px;font-weight:500;line-height:22px;
}
body [class*="root"]:not([class*="collapsed"]) nav[class*="panelList"] button[class*="panelRow"]:hover{
  background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04));
}
body [class*="root"]:not([class*="collapsed"]) nav[class*="panelList"] button[class*="panelRow"][class*="panelActive"]{
  background:var(--dsw-alias-interactive-bg-active,rgba(47,111,237,.1));
  box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary,#2f6fed);
  color:var(--dsw-alias-label-primary,#1f2328);
}
/* 折叠态（36px rail）：还原为透明图标，与「新会话」折叠态一致 */
[class*="collapsed"] nav[class*="panelList"] button[class*="panelRow"]{
  background:0 0;border-color:transparent;border-radius:8px;
  width:36px;height:36px;min-height:36px;margin:0;justify-content:center;padding:0;box-shadow:none;
}
`

let injected = false

/** 注入一次样式；幂等。 */
export function injectStyle(): void {
  if (injected) return
  const style = document.createElement('style')
  style.setAttribute('data-dsh-agenda-style', '')
  style.textContent = CSS
  document.head.appendChild(style)
  injected = true
}

/** 测试/卸载用（可逆）。 */
export function removeStyle(): void {
  document.head.querySelectorAll('[data-dsh-agenda-style]').forEach(node => node.remove())
  injected = false
}
