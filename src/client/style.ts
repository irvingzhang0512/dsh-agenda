/**
 * dsh-agenda — 注入的样式（唯一 `<style>`，全部类名带 `da-` 前缀）。
 *
 * 颜色优先取 DSH 的 CSS 变量（带兜底值），保持与主界面主题一致。
 */
const CSS = `
.da-root{--da-border:var(--dsw-alias-border-l3,#e3e6e8);--da-text:var(--dsw-alias-label-primary,#1f2328);--da-text-dim:var(--dsw-alias-label-secondary,#59636e);--da-accent:#2f6fed;--da-bg:var(--dsw-alias-fill-canvas,#f6f8fa);--da-card:var(--dsw-alias-fill-surface,#ffffff);--da-hover:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05));--da-holiday:#c62828;--da-work:#1565c0;--da-ok:#2e7d32;
display:flex;flex-direction:column;height:100%;min-height:0;background:var(--da-bg);color:var(--da-text);font-size:14px;line-height:1.5;overflow:hidden;box-sizing:border-box;}
.da-root *{box-sizing:border-box;}
.da-header{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--da-border);background:var(--da-card);flex:none;}
.da-header h1{font-size:16px;font-weight:600;margin:0;}
.da-nav{display:flex;gap:4px;flex:1;justify-content:center;}
.da-nav button{border:0;background:transparent;color:var(--da-text-dim);padding:6px 14px;border-radius:8px;cursor:pointer;font-size:13px;}
.da-nav button:hover{background:var(--da-hover);}
.da-nav button.da-active{background:var(--da-hover);color:var(--da-text);font-weight:600;}
.da-main{flex:1;min-height:0;overflow:auto;padding:16px;}
.da-card{background:var(--da-card);border:1px solid var(--da-border);border-radius:12px;padding:14px;}
.da-btn{border:1px solid var(--da-border);background:var(--da-card);color:var(--da-text);padding:5px 12px;border-radius:8px;cursor:pointer;font-size:13px;}
.da-btn:hover{background:var(--da-hover);}
.da-btn.da-primary{background:var(--da-accent);border-color:var(--da-accent);color:#fff;}
.da-btn.da-danger{color:#c62828;border-color:rgba(198,40,40,.4);}
.da-btn:disabled{opacity:.5;cursor:default;}
.da-input,.da-select,.da-textarea{border:1px solid var(--da-border);border-radius:8px;padding:6px 10px;font-size:13px;background:var(--da-card);color:var(--da-text);}
.da-input:focus,.da-select:focus,.da-textarea:focus{outline:2px solid rgba(47,111,237,.35);outline-offset:-1px;}
.da-textarea{resize:vertical;min-height:64px;font-family:inherit;}
.da-dim{color:var(--da-text-dim);font-size:12px;}
.da-row{display:flex;align-items:center;gap:8px;}
.da-grow{flex:1;min-width:0;}
.da-divider{height:1px;background:var(--da-border);margin:10px 0;}
.da-list{display:flex;flex-direction:column;gap:6px;}
.da-empty{color:var(--da-text-dim);text-align:center;padding:24px 8px;font-size:13px;}
.da-badge{display:inline-flex;align-items:center;border-radius:6px;padding:0 6px;font-size:11px;line-height:18px;flex:none;}
.da-badge.da-holiday{background:rgba(198,40,40,.12);color:var(--da-holiday);}
.da-badge.da-work{background:rgba(21,101,192,.12);color:var(--da-work);}
.da-badge.da-weekend{background:rgba(0,0,0,.06);color:var(--da-text-dim);}
.da-badge.da-cat{background:rgba(47,111,237,.1);color:var(--da-accent);}
.da-badge.da-ok{background:rgba(46,125,50,.12);color:var(--da-ok);}
.da-badge.da-festival{background:rgba(255,152,0,.16);color:#b26a00;}
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
.da-check{width:16px;height:16px;border:1.5px solid var(--da-text-dim);border-radius:50%;flex:none;margin-top:2px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;color:#fff;}
.da-check.da-checked{background:var(--da-ok);border-color:var(--da-ok);}
.da-calendar{border:1px solid var(--da-border);border-radius:12px;background:var(--da-card);overflow:hidden;}
.da-cal-header{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--da-border);}
.da-cal-title{font-weight:600;font-size:14px;flex:1;text-align:center;}
.da-grid{display:grid;grid-template-columns:repeat(7,1fr);}
.da-grid-head{display:grid;grid-template-columns:repeat(7,1fr);border-bottom:1px solid var(--da-border);}
.da-grid-head div{text-align:center;padding:6px 0;font-size:12px;color:var(--da-text-dim);}
.da-day{min-height:96px;border-right:1px solid var(--da-border);border-bottom:1px solid var(--da-border);padding:6px;cursor:pointer;position:relative;display:flex;flex-direction:column;gap:2px;overflow:hidden;}
.da-day:nth-child(7n){border-right:0;}
.da-day:hover{background:var(--da-hover);}
.da-day.da-other{color:var(--da-text-dim);opacity:.55;}
.da-day.da-today{box-shadow:inset 0 0 0 2px var(--da-accent);border-radius:8px;}
.da-day-top{display:flex;align-items:center;gap:4px;justify-content:space-between;}
.da-day-num{font-weight:500;}
.da-day-lunar{font-size:11px;color:var(--da-text-dim);}
.da-day-badges{display:flex;gap:2px;}
.da-ev{font-size:11px;padding:1px 5px;border-radius:5px;background:rgba(47,111,237,.1);color:var(--da-accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:16px;}
.da-ev.da-allday{background:rgba(47,111,237,.18);}
.da-ev.da-more{background:transparent;color:var(--da-text-dim);}
.da-week{display:grid;grid-template-columns:56px repeat(7,1fr);grid-template-rows:auto auto 720px;border:1px solid var(--da-border);border-radius:12px;background:var(--da-card);overflow:hidden;}
.da-week .da-whead{display:contents;}
.da-week .da-whead>div{display:flex;flex-direction:column;align-items:center;padding:6px 0;border-left:1px solid var(--da-border);font-size:12px;}
.da-week .da-whead>div:first-child{border-left:0;}
.da-week .da-whead .da-dow{color:var(--da-text-dim);}
.da-week .da-whead .da-dom{font-weight:600;}
.da-gutter-hours{grid-column:1;grid-row:3;position:relative;border-top:1px solid var(--da-border);}
.da-week .da-wcol{position:relative;grid-row:3;border-left:1px solid var(--da-border);}
.da-hour{position:absolute;left:0;right:0;border-top:1px solid rgba(0,0,0,.05);font-size:10px;color:var(--da-text-dim);padding-left:2px;transform:translateY(-50%);cursor:pointer;}
.da-wev{position:absolute;left:4px;right:4px;border-radius:6px;background:rgba(47,111,237,.12);color:var(--da-accent);font-size:11px;padding:2px 6px;overflow:hidden;cursor:pointer;line-height:1.35;}
.da-wev:hover{background:rgba(47,111,237,.2);}
.da-modal{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:1000;padding:24px;}
.da-modal-card{background:var(--da-card);border-radius:14px;padding:18px;width:520px;max-width:100%;max-height:90vh;overflow:auto;box-shadow:0 12px 40px rgba(0,0,0,.2);}
.da-modal-card h2{margin:0 0 14px;font-size:15px;}
.da-form{display:flex;flex-direction:column;gap:10px;}
.da-form .da-field{display:flex;flex-direction:column;gap:4px;}
.da-form label{font-size:12px;color:var(--da-text-dim);}
.da-form .da-inline{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.da-stats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;}
.da-stat-card{background:var(--da-card);border:1px solid var(--da-border);border-radius:12px;padding:12px;}
.da-stat-num{font-size:22px;font-weight:700;}
.da-stat-label{font-size:12px;color:var(--da-text-dim);}
.da-bar{height:8px;border-radius:4px;background:rgba(0,0,0,.06);overflow:hidden;flex:1;min-width:60px;}
.da-bar>i{display:block;height:100%;background:var(--da-accent);border-radius:4px;}
.da-cat-row{display:flex;align-items:center;gap:8px;font-size:13px;padding:4px 0;}
.da-cat-row .da-cat-name{min-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.da-search-box{display:flex;gap:8px;margin-bottom:14px;}
.da-search-box input{flex:1;}
.da-section-title{font-size:13px;font-weight:600;color:var(--da-text-dim);margin:14px 0 8px;}
.da-tabs{display:flex;gap:8px;margin-bottom:12px;}
.da-tabs button{border:0;background:var(--da-card);color:var(--da-text-dim);border:1px solid var(--da-border);padding:4px 12px;border-radius:8px;cursor:pointer;font-size:12px;}
.da-tabs button.da-active{color:var(--da-text);font-weight:600;border-color:var(--da-accent);}
.da-date-head{display:flex;align-items:baseline;gap:10px;margin-bottom:12px;}
.da-date-head .da-big{font-size:20px;font-weight:700;}
.da-date-head .da-sub{color:var(--da-text-dim);font-size:13px;}
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
