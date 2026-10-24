window.__ModuleLoader__.load({
	id: "dsh-agenda",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/shared/types.ts
		/** 日期正则：YYYY-MM-DD。 */
		const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
		/** 把 `YYYY-MM-DD` 解析为 UTC 零点的 Date；非法返回 null。 */
		function parseDate(date) {
			if (!DATE_RE.test(date)) return null;
			const [y, m, d] = date.split("-").map(Number);
			const utc = new Date(Date.UTC(y, m - 1, d));
			if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== m - 1 || utc.getUTCDate() !== d) return null;
			return utc;
		}
		/** Date → `YYYY-MM-DD`（UTC 基准）。 */
		function formatDate(date) {
			return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
		}
		/** 基准日 + n 天 → `YYYY-MM-DD`。 */
		function addDays(date, days) {
			const base = parseDate(date);
			if (base === null) return date;
			return formatDate(new Date(base.getTime() + days * 864e5));
		}
		/** 事件占用的日期闭区间（跨天事件展开为逐日）。
		* 定时事件结束于次日 00:00 时视为只占用开始日（20:00-24:00 不占第二天）。 */
		function eventDates(event) {
			const startDay = event.start.slice(0, 10);
			let endDay = event.end.slice(0, 10);
			if (!event.allDay && event.end.length >= 16 && event.end.endsWith("T00:00") && endDay > startDay) endDay = addDays(endDay, -1);
			if (endDay < startDay) endDay = startDay;
			const days = [];
			let cursor = startDay;
			let guard = 0;
			while (cursor <= endDay && guard < 370) {
				days.push(cursor);
				cursor = addDays(cursor, 1);
				guard += 1;
			}
			return days;
		}
		/** 今天（本地时区）的 `YYYY-MM-DD`。 */
		function todayISO(now = /* @__PURE__ */ new Date()) {
			return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
		}
		//#endregion
		//#region src/client/agenda-context.tsx
		/**
		* dsh-agenda — 客户端共享上下文：快照状态、今天的日历信息与公共工具。
		*/
		const AgendaContext = (0, react.createContext)(null);
		/** 视图内取上下文；必须在 AgendaProvider 内。 */
		function useAgenda() {
			const value = (0, react.useContext)(AgendaContext);
			if (value === null) throw new Error("useAgenda 必须在 <AgendaProvider> 内使用。");
			return value;
		}
		/** 应用根 Provider：实例化客户端并订阅快照。 */
		function AgendaProvider({ client, children }) {
			const [connected, setConnected] = (0, react.useState)(client.connected);
			const [snapshot, setSnapshot] = (0, react.useState)(client.snapshot);
			const [error, setError] = (0, react.useState)(client.error);
			const [todayInfo, setTodayInfo] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				const sync = () => {
					setConnected(client.connected);
					setSnapshot(client.snapshot);
					setError(client.error);
				};
				sync();
				return client.subscribe(sync);
			}, [client]);
			(0, react.useEffect)(() => {
				if (!connected) return;
				let stopped = false;
				client.rangeInfo(todayISO(), todayISO()).then((days) => {
					if (!stopped && days.length === 1) setTodayInfo(days[0] ?? null);
				}).catch(() => void 0);
				return () => {
					stopped = true;
				};
			}, [
				client,
				connected,
				snapshot?.dataVersion
			]);
			const value = {
				client,
				connected,
				error,
				snapshot,
				todayInfo
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AgendaContext.Provider, {
				value,
				children
			});
		}
		const WEEKDAY_CN = [
			"周一",
			"周二",
			"周三",
			"周四",
			"周五",
			"周六",
			"周日"
		];
		/** 1=周一 … 7=周日 → 中文。 */
		function weekdayCn(weekday) {
			return WEEKDAY_CN[(weekday - 1 + 7) % 7] ?? "";
		}
		/** `YYYY-MM-DD` → `M月D日`。 */
		function cnDate(date) {
			const [, m, d] = date.split("-");
			return `${Number(m)}月${Number(d)}日`;
		}
		/** `YYYY-MM-DDTHH:mm` → `HH:mm`；date-only 返回 ''。 */
		function timeOf$1(datetime) {
			return datetime.length >= 16 ? datetime.slice(11, 16) : "";
		}
		/** 事件在视图中的时间段文本。 */
		function eventTimeText(event) {
			if (event.allDay) return "全天";
			const start = timeOf$1(event.start);
			const end = timeOf$1(event.end);
			const startDay = event.start.slice(0, 10);
			const endDay = event.end.slice(0, 10);
			if (startDay === endDay) return `${start} – ${end}`;
			return `${startDay} ${start} → ${endDay} ${end}`;
		}
		//#endregion
		//#region src/client/persistent-state.ts
		/** 插件实例内的页面状态；切主面板不丢草稿，卸载即释放。 */
		function usePersistentState(key, initial) {
			const { client } = useAgenda();
			const [value, setValue] = (0, react.useState)(() => {
				if (!client.uiState.has(key)) client.uiState.set(key, typeof initial === "function" ? initial() : initial);
				return client.uiState.get(key);
			});
			return [value, (next) => setValue((previous) => {
				const value = typeof next === "function" ? next(previous) : next;
				client.uiState.set(key, value);
				return value;
			})];
		}
		//#endregion
		//#region src/client/primitives.ts
		const { Button, SegmentedTabs } = require("@deepseek-ai/dsh-client-ui-primitives");
		//#endregion
		//#region src/client/holiday-notice.tsx
		function HolidayNotice({ years }) {
			const { snapshot } = useAgenda();
			if (!snapshot) return null;
			const data = snapshot.holidayData;
			const absent = [...new Set(years)].filter((year) => !data.supportedYears.includes(year) && !data.localOverrideYears.includes(year));
			return absent.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				className: "da-dim",
				children: [
					"放假安排未载入（",
					absent.join("、"),
					" 年），仅按普通工作日与周末显示。"
				]
			}) : null;
		}
		//#endregion
		//#region src/client/views/today-view.tsx
		/**
		* dsh-agenda — Today 当日视图（需求 §4，高频入口）。
		*
		* 展示：当前日期 / 星期 / 农历 / 今日日程（全天在前、按时间序）/ 今日待办
		* （未完成在前，可勾选完成）。右上角支持快速新建日程 / 待办。
		*/
		const RECURRENCE_LABEL$2 = {
			daily: "每天",
			weekly: "每周",
			monthly: "每月",
			yearly: "每年"
		};
		function TodayView({ onEditEvent, onNewEvent, onEditTodo, onNewTodo }) {
			const { snapshot, todayInfo, client, connected } = useAgenda();
			const [quickTodo, setQuickTodo] = usePersistentState("today.quickTodo", "");
			const [dayInstances, setDayInstances] = (0, react.useState)([]);
			const today = todayISO();
			(0, react.useEffect)(() => {
				if (!connected) return;
				let stopped = false;
				client.listTodoInstances({
					from: today,
					to: today
				}).then((list) => {
					if (!stopped) setDayInstances(list);
				}).catch(() => void 0);
				return () => {
					stopped = true;
				};
			}, [
				client,
				connected,
				snapshot?.dataVersion,
				today
			]);
			const templates = (0, react.useMemo)(() => {
				const map = /* @__PURE__ */ new Map();
				for (const todo of snapshot?.todos ?? []) map.set(todo.id, todo);
				return map;
			}, [snapshot]);
			const dayEvents = (0, react.useMemo)(() => {
				return (snapshot?.events ?? []).filter((event) => eventDates(event).includes(today)).sort((a, b) => {
					if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
					return a.start.localeCompare(b.start);
				});
			}, [snapshot, today]);
			const dayTodos = (0, react.useMemo)(() => {
				return [...dayInstances].sort((a, b) => a.status === b.status ? a.templateId.localeCompare(b.templateId) : a.status === "pending" ? -1 : 1);
			}, [dayInstances]);
			const pendingCount = dayTodos.filter((todo) => todo.status === "pending").length;
			const completedCount = dayTodos.length - pendingCount;
			const holiday = todayInfo?.holidayName !== void 0 ? todayInfo.holidayName : todayInfo?.festival;
			const addQuickTodo = async () => {
				const title = quickTodo.trim();
				if (title === "") return;
				await client.createTodo({
					title,
					date: today
				}).then(() => setQuickTodo((current) => current.trim() === title ? "" : current)).catch(() => void 0);
			};
			const toggleTodo = async (instance, completed) => {
				await client.updateTodo(instance.templateId, {
					status: completed ? "pending" : "completed",
					statusDate: instance.date
				}).catch(() => void 0);
			};
			const openEditTodo = (instance) => {
				const template = templates.get(instance.templateId);
				if (template !== void 0) onEditTodo({
					kind: "edit",
					todo: template
				});
			};
			const renderEvent = (event) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `da-event-item ${event.allDay ? "da-allday" : ""}`,
				onClick: () => onEditEvent({
					kind: "edit",
					event
				}),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "da-time",
					children: eventTimeText(event)
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "da-grow",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "da-title",
						children: event.title
					}), (event.category !== void 0 || event.location !== void 0) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "da-row",
						style: {
							gap: 4,
							marginTop: 2
						},
						children: [event.category !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "da-badge da-cat",
							children: event.category
						}), event.location !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "da-dim",
							children: event.location
						})]
					})]
				})]
			}, event.id);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(HolidayNotice, { years: [Number(today.slice(0, 4))] }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "da-date-head",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "da-big",
							children: cnDate(today)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: `da-sub ${todayInfo?.dayType === "weekend" || todayInfo?.dayType === "holiday" ? "da-nonwork" : ""}`,
							children: weekdayCn(todayInfo?.weekday ?? 1)
						}),
						todayInfo !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "da-sub",
							children: [
								"农历",
								todayInfo.lunarText,
								todayInfo.lunarLeap ? "（闰）" : ""
							]
						}),
						holiday !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "da-badge da-festival",
							children: holiday
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "da-grow" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "da-btn da-primary",
							onClick: () => onNewEvent(today),
							children: "＋ 日程"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "da-btn",
							onClick: () => onNewTodo(today),
							children: "＋ 待办"
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "da-card",
					style: { marginBottom: 14 },
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "da-section-title",
						style: { marginTop: 0 },
						children: [
							"今日日程（",
							dayEvents.length,
							"）"
						]
					}), dayEvents.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "da-empty",
						children: "今天没有日程安排"
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "da-list",
						children: dayEvents.map(renderEvent)
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "da-card",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "da-section-title",
							style: { marginTop: 0 },
							children: [
								"今日待办（",
								pendingCount,
								" 未完成 / ",
								completedCount,
								" 已完成）"
							]
						}),
						dayTodos.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "da-empty",
							children: "今天没有待办"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "da-list",
							children: dayTodos.map((instance) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: `da-todo-item ${instance.status === "completed" ? "da-done" : ""}`,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: `da-check ${instance.status === "completed" ? "da-checked" : ""}`,
										onClick: () => void toggleTodo(instance, instance.status === "completed"),
										children: instance.status === "completed" ? "✓" : ""
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "da-grow da-todo-title",
										onClick: () => openEditTodo(instance),
										children: instance.title
									}),
									instance.recurrence !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "da-badge da-weekend",
										title: "重复待办",
										children: ["🔁 ", RECURRENCE_LABEL$2[instance.recurrence]]
									}),
									instance.category !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "da-badge da-cat",
										children: instance.category
									})
								]
							}, `${instance.templateId}-${instance.date}`))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "da-row",
							style: { marginTop: 10 },
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "da-input da-grow",
								placeholder: "快速添加待办，回车保存",
								value: quickTodo,
								onChange: (e) => setQuickTodo(e.target.value),
								onKeyDown: (e) => {
									if (e.key === "Enter") addQuickTodo();
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "da-btn",
								onClick: () => void addQuickTodo(),
								children: "添加"
							})]
						})
					]
				})
			] });
		}
		//#endregion
		//#region src/client/day-cell.ts
		/** 日期格底色类名；普通工作日返回空串。 */
		function cellBgClass(day) {
			if (day.dayType === "weekend") return "da-weekend-cell";
			if (day.dayType === "holiday") return "da-holiday-cell";
			if (day.dayType === "adjusted-workday") return "da-adjusted-cell";
			return "";
		}
		/** 农历位高亮文本；当天无节日时返回 null（视图回退显示 lunarText）。 */
		function lunarAccentOf(day) {
			if (day.holidayName !== void 0 && day.holidayName !== "") return {
				text: day.holidayName,
				cls: "da-lunar-holiday"
			};
			if (day.festival !== void 0 && day.festival !== "") return {
				text: day.festival,
				cls: "da-lunar-festival"
			};
			return null;
		}
		//#endregion
		//#region src/client/dialog.ts
		/** 可访问弹窗：键盘焦点闭环与焦点返回；回调始终读取最新草稿。 */
		function useDialog(close) {
			const ref = (0, react.useRef)(null);
			const latest = (0, react.useRef)(close);
			latest.current = close;
			(0, react.useEffect)(() => {
				const root = ref.current, previous = document.activeElement;
				if (!root) return;
				const focusable = () => Array.from(root.querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex=\"0\"]")).filter((x) => x.getClientRects().length > 0);
				(focusable()[0] ?? root).focus();
				const key = (event) => {
					if (event.isComposing) return;
					if (event.key === "Escape") {
						event.preventDefault();
						latest.current();
						return;
					}
					if (event.key !== "Tab") return;
					const items = focusable(), first = items[0], last = items.at(-1);
					if (!first) {
						event.preventDefault();
						root.focus();
					} else if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) {
						event.preventDefault();
						last?.focus();
					} else if (!event.shiftKey && document.activeElement === last) {
						event.preventDefault();
						first.focus();
					}
				};
				root.addEventListener("keydown", key);
				return () => {
					root.removeEventListener("keydown", key);
					if (previous?.isConnected) previous.focus();
					else document.querySelector(".da-root button")?.focus();
				};
			}, []);
			return ref;
		}
		//#endregion
		//#region src/client/components/day-detail.tsx
		/**
		* dsh-agenda — 单日详情（月视图点击日期弹出）。
		*
		* 展示当天日程（全天在前、定时按时间序）与待办实例（重复待办当天到期即显示），
		* 并提供新建日程 / 新建待办入口。日程来自共享快照，待办实例按日拉取。
		*/
		const RECURRENCE_LABEL$1 = {
			daily: "每天",
			weekly: "每周",
			monthly: "每月",
			yearly: "每年"
		};
		function DayDetail({ date, dayInfo, onClose, onEditEvent, onEditTodo, onNewEvent, onNewTodo }) {
			const dialogRef = useDialog(onClose);
			const { snapshot, client, connected } = useAgenda();
			const [todos, setTodos] = (0, react.useState)([]);
			(0, react.useEffect)(() => {
				if (!connected) return;
				let stopped = false;
				client.listTodoInstances({
					from: date,
					to: date
				}).then((list) => {
					if (!stopped) setTodos(list);
				}).catch(() => void 0);
				return () => {
					stopped = true;
				};
			}, [
				client,
				date,
				connected,
				snapshot?.dataVersion
			]);
			const templates = /* @__PURE__ */ new Map();
			for (const todo of snapshot?.todos ?? []) templates.set(todo.id, todo);
			const events = (snapshot?.events ?? []).filter((event) => eventDates(event).includes(date));
			const allDayEvents = events.filter((event) => event.allDay);
			const timedEvents = events.filter((event) => !event.allDay).sort((a, b) => a.start.localeCompare(b.start));
			const toggleTodo = async (instance, completed) => {
				await client.updateTodo(instance.templateId, {
					status: completed ? "pending" : "completed",
					statusDate: instance.date
				}).catch(() => void 0);
			};
			const openEditTodo = (instance) => {
				const template = templates.get(instance.templateId);
				if (template !== void 0) onEditTodo({
					kind: "edit",
					todo: template
				});
			};
			const renderEvent = (event) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `da-event-item ${event.allDay ? "da-allday" : ""}`,
				onClick: () => onEditEvent({
					kind: "edit",
					event
				}),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "da-time",
					children: eventTimeText(event)
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "da-grow",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "da-title",
							children: event.title
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "da-row",
							style: {
								gap: 4,
								marginTop: 2
							},
							children: [
								event.calendarType === "lunar" && event.lunarMonth !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "da-badge da-festival",
									children: [
										"农历",
										event.lunarLeap ? "闰" : "",
										event.lunarMonth,
										"月",
										event.lunarDay,
										"日"
									]
								}),
								event.category !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "da-badge da-cat",
									children: event.category
								}),
								event.location !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "da-dim",
									children: event.location
								})
							]
						}),
						event.description !== void 0 && event.description !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "da-dim",
							children: event.description
						})
					]
				})]
			}, event.id);
			const holiday = dayInfo?.holidayName !== void 0 ? dayInfo.holidayName : dayInfo?.festival !== void 0 ? dayInfo.festival : void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "da-modal",
				onMouseDown: (e) => {
					if (e.target === e.currentTarget) onClose();
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "da-modal-card",
					ref: dialogRef,
					role: "dialog",
					"aria-modal": "true",
					"aria-label": "日期详情",
					tabIndex: -1,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h2", {
							style: {
								display: "flex",
								alignItems: "baseline",
								gap: 8,
								flexWrap: "wrap"
							},
							children: [
								cnDate(date),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "da-dim",
									children: weekdayCn(dayInfo?.weekday ?? 1)
								}),
								dayInfo !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "da-dim",
									children: [dayInfo.lunarText, dayInfo.lunarLeap ? "（闰）" : ""]
								}),
								holiday !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "da-badge da-festival",
									children: holiday
								}),
								date === todayISO() && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "da-badge da-ok",
									children: "今天"
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "da-row",
							style: {
								gap: 8,
								marginBottom: 10
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "da-btn da-primary",
								onClick: () => {
									onClose();
									onNewEvent(date);
								},
								children: "＋ 新建日程"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "da-btn",
								onClick: () => {
									onClose();
									onNewTodo(date);
								},
								children: "＋ 新建待办"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "da-section-title",
							children: [
								"日程（",
								events.length,
								"）"
							]
						}),
						events.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "da-empty",
							children: "当天没有日程"
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "da-list",
							children: [allDayEvents.map(renderEvent), timedEvents.map(renderEvent)]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "da-section-title",
							children: [
								"待办（",
								todos.length,
								"）"
							]
						}),
						todos.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "da-empty",
							children: "当天没有待办"
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "da-list",
							children: todos.map((instance) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: `da-todo-item ${instance.status === "completed" ? "da-done" : ""}`,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: `da-check ${instance.status === "completed" ? "da-checked" : ""}`,
										onClick: () => void toggleTodo(instance, instance.status === "completed"),
										children: instance.status === "completed" ? "✓" : ""
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "da-grow da-todo-title",
										onClick: () => openEditTodo(instance),
										children: instance.title
									}),
									instance.recurrence !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "da-badge da-weekend",
										title: "重复待办",
										children: ["🔁 ", RECURRENCE_LABEL$1[instance.recurrence]]
									}),
									instance.category !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "da-badge da-cat",
										children: instance.category
									})
								]
							}, `${instance.templateId}-${instance.date}`))
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/views/month-view.tsx
		/**
		* dsh-agenda — 月视图（需求 §3 Calendar 月视图）。
		*
		* 7 列网格（按设置 weekStart），底色区分工作日/周末/法定节假日/调休（MIUI 式三色底），
		* 展示农历标注（节日名优先替换农历位并着色）、法定节假日/调休角标
		* 与当日日程条目（最多 3 条 + 溢出计数）。点击日期弹单日详情。
		*/
		const MAX_CHIPS = 3;
		function MonthView({ initialMonth, onEditEvent, onNewEvent, onEditTodo, onNewTodo }) {
			const { snapshot, client, connected } = useAgenda();
			const [year, setYear] = usePersistentState("month.year", () => Number(initialMonth.slice(0, 4)));
			const [month, setMonth] = usePersistentState("month.month", () => Number(initialMonth.slice(5, 7)));
			const [days, setDays] = (0, react.useState)([]);
			const [detailDate, setDetailDate] = usePersistentState("month.detailDate", null);
			const weekStart = snapshot?.settings.weekStart ?? "monday";
			(0, react.useEffect)(() => {
				if (!connected) return;
				let stopped = false;
				client.monthInfo(year, month).then((info) => {
					if (!stopped) setDays(info);
				}).catch(() => void 0);
				return () => {
					stopped = true;
				};
			}, [
				client,
				connected,
				year,
				month,
				snapshot?.dataVersion
			]);
			const eventsByDate = (0, react.useMemo)(() => {
				const map = /* @__PURE__ */ new Map();
				for (const event of snapshot?.events ?? []) for (const date of eventDates(event)) {
					const list = map.get(date) ?? [];
					list.push(event);
					map.set(date, list);
				}
				for (const list of map.values()) list.sort((a, b) => a.allDay !== b.allDay ? a.allDay ? -1 : 1 : a.start.localeCompare(b.start));
				return map;
			}, [snapshot]);
			const grid = (0, react.useMemo)(() => {
				if (days.length === 0) return [];
				const firstWeekday = days[0].weekday;
				const offset = weekStart === "monday" ? firstWeekday - 1 : firstWeekday % 7;
				const leading = [];
				for (let i = offset; i > 0; i -= 1) leading.push({
					date: "",
					weekday: 0,
					lunarText: "",
					lunarYear: 0,
					lunarLeap: false,
					dayType: "workday",
					isToday: false
				});
				return [...leading, ...days];
			}, [days, weekStart]);
			const detailInfo = detailDate !== null ? days.find((day) => day.date === detailDate) ?? null : null;
			const shift = (delta) => {
				let y = year;
				let m = month + delta;
				if (m < 1) {
					m = 12;
					y -= 1;
				}
				if (m > 12) {
					m = 1;
					y += 1;
				}
				setYear(y);
				setMonth(m);
			};
			const badgeOf = (day) => {
				if (day.dayType === "holiday") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "da-badge da-holiday",
					children: "休"
				});
				if (day.dayType === "adjusted-workday") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "da-badge da-work",
					children: "班"
				});
				return null;
			};
			/** 单日格：底色按 dayType（day-cell.ts 共享规则），今天叠加 da-today-cell。 */
			const renderDay = (day, index) => {
				if (day.date === "") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "da-day da-other" }, `gap-${index}`);
				const events = eventsByDate.get(day.date) ?? [];
				const visible = events.slice(0, MAX_CHIPS);
				const hidden = events.length - visible.length;
				const isNonWork = day.dayType === "weekend" || day.dayType === "holiday";
				const lunarAccent = lunarAccentOf(day);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: `da-day ${cellBgClass(day)} ${day.isToday ? "da-today-cell" : ""} ${isNonWork ? "da-nonwork" : ""}`,
					onClick: () => setDetailDate(day.date),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "da-day-top",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "da-day-num",
									children: Number(day.date.slice(8, 10))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: `da-day-lunar ${lunarAccent?.cls ?? ""}`,
									children: lunarAccent !== null ? lunarAccent.text : day.lunarText
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "da-day-badges",
									children: badgeOf(day)
								})
							]
						}),
						visible.map((event) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: `da-ev ${event.allDay ? "da-allday" : ""}`,
							title: event.title,
							onClick: (e) => {
								e.stopPropagation();
								onEditEvent({
									kind: "edit",
									event
								});
							},
							children: [event.allDay ? "" : `${timeOf(event.start)} `, event.title]
						}, event.id)),
						hidden > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "da-ev da-more",
							children: [
								"+",
								hidden,
								" 项"
							]
						})
					]
				}, day.date);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				snapshot && !snapshot.holidayData.supportedYears.includes(year) && !snapshot.holidayData.localOverrideYears.includes(year) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
					className: "da-dim",
					children: [
						"放假安排未载入（",
						year,
						" 年），仅按普通工作日与周末显示。"
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "da-cal",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "da-cal-header",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "da-btn",
									onClick: () => shift(-1),
									children: "‹"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "da-cal-title",
									children: [
										year,
										" 年 ",
										month,
										" 月"
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "da-btn",
									onClick: () => shift(1),
									children: "›"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "da-btn",
									onClick: () => {
										const now = /* @__PURE__ */ new Date();
										setYear(now.getUTCFullYear());
										setMonth(now.getUTCMonth() + 1);
									},
									children: "本月"
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "da-grid-head",
							children: Array.from({ length: 7 }, (_, i) => {
								const weekday = weekStart === "monday" ? i + 1 : (i + 6) % 7 + 1;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: weekday === 6 || weekday === 7 ? "da-head-nonwork" : "",
									children: weekdayCn(weekday)
								}, weekday);
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "da-grid",
							children: grid.map((day, index) => renderDay(day, index))
						})
					]
				}),
				detailDate !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DayDetail, {
					date: detailDate,
					dayInfo: detailInfo,
					onClose: () => setDetailDate(null),
					onEditEvent,
					onEditTodo,
					onNewEvent,
					onNewTodo
				})
			] });
		}
		function timeOf(datetime) {
			return datetime.length >= 16 ? datetime.slice(11, 16) : "";
		}
		//#endregion
		//#region src/client/views/week-view.tsx
		/**
		* dsh-agenda — 周视图（需求 §3 Calendar 周视图）。
		*
		* 左侧时间轴 + 7 天列；定时事件按时间绝对定位（顶对齐），全天事件在列顶
		* 单独呈现。列头底色按 dayType 区分（day-cell.ts 共享规则，与月视图一致），
		* 节日名优先替换农历位并着色。点击空白格 = 在该时间新建日程；点击事件 = 编辑。
		*/
		const HOURS = Array.from({ length: 24 }, (_, i) => i);
		const PX_PER_HOUR = 60;
		function toMinutes(datetime) {
			if (datetime.length < 16) return 0;
			return Number(datetime.slice(11, 13)) * 60 + Number(datetime.slice(14, 16));
		}
		function WeekView({ initialDate, onEditEvent, onNewEvent }) {
			const { snapshot, client, connected } = useAgenda();
			const [anchor, setAnchor] = usePersistentState("week.anchor", initialDate);
			const [info, setInfo] = (0, react.useState)([]);
			const weekStart = snapshot?.settings.weekStart ?? "monday";
			const days = (0, react.useMemo)(() => {
				const base = /* @__PURE__ */ new Date(`${anchor}T00:00:00Z`);
				const weekday = (base.getUTCDay() + 6) % 7 + 1;
				const offset = weekStart === "monday" ? weekday - 1 : weekday % 7;
				const monday = /* @__PURE__ */ new Date(base.getTime() - offset * 864e5);
				return Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * 864e5).toISOString().slice(0, 10));
			}, [anchor, weekStart]);
			(0, react.useEffect)(() => {
				if (!connected) return;
				let stopped = false;
				client.rangeInfo(days[0], days[6]).then((list) => {
					if (!stopped) setInfo(list);
				}).catch(() => void 0);
				return () => {
					stopped = true;
				};
			}, [
				client,
				days[0],
				days[6],
				snapshot?.dataVersion
			]);
			const infoByDate = (0, react.useMemo)(() => {
				const map = /* @__PURE__ */ new Map();
				for (const day of info) map.set(day.date, day);
				return map;
			}, [info]);
			const eventsByDate = (0, react.useMemo)(() => {
				const map = /* @__PURE__ */ new Map();
				for (const event of snapshot?.events ?? []) for (const date of eventDates(event)) {
					const list = map.get(date) ?? [];
					list.push(event);
					map.set(date, list);
				}
				return map;
			}, [snapshot]);
			const shiftWeek = (delta) => {
				const base = /* @__PURE__ */ new Date(`${days[0]}T00:00:00Z`);
				base.setUTCDate(base.getUTCDate() + delta * 7);
				setAnchor(base.toISOString().slice(0, 10));
			};
			const title = (() => {
				const a = Number(days[0].slice(8, 10));
				const b = Number(days[6].slice(8, 10));
				const year = days[0].slice(0, 4);
				const monthA = Number(days[0].slice(5, 7));
				const monthB = Number(days[6].slice(5, 7));
				if (monthA === monthB) return `${year} 年 ${monthA} 月 ${a}–${b} 日`;
				return `${year} 年 ${monthA} 月 ${a} 日 – ${monthB} 月 ${b} 日`;
			})();
			const renderEvent = (event) => {
				if (event.allDay) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "da-ev da-allday",
					style: {
						marginBottom: 2,
						cursor: "pointer"
					},
					title: event.title,
					onClick: (e) => {
						e.stopPropagation();
						onEditEvent({
							kind: "edit",
							event
						});
					},
					children: event.title
				}, event.id);
				const startMin = toMinutes(event.start);
				const endRaw = toMinutes(event.end);
				const endMin = endRaw > startMin ? endRaw : startMin + 60;
				const top = startMin / 60 * PX_PER_HOUR;
				const height = Math.max((endMin - startMin) / 60 * PX_PER_HOUR - 2, 18);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "da-wev",
					style: {
						top,
						height
					},
					title: `${event.title}（${event.start.slice(11, 16)}–${event.end.slice(11, 16)}）`,
					onClick: (e) => {
						e.stopPropagation();
						onEditEvent({
							kind: "edit",
							event
						});
					},
					children: [
						event.start.slice(11, 16),
						" ",
						event.title
					]
				}, event.id);
			};
			const handleSlotClick = (day, hour) => {
				onNewEvent(day, `${String(hour).padStart(2, "0")}:00`);
			};
			const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(HolidayNotice, { years: days.map((day) => Number(day.slice(0, 4))) }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "da-cal-header",
					style: {
						border: 0,
						padding: "0 0 12px"
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "da-btn",
							onClick: () => shiftWeek(-1),
							children: "‹"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "da-cal-title",
							children: title
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "da-btn",
							onClick: () => shiftWeek(1),
							children: "›"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "da-btn",
							onClick: () => setAnchor(todayStr),
							children: "本周"
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "da-week",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "da-whead",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									display: "flex",
									justifyContent: "flex-end",
									paddingRight: 8,
									fontSize: 11,
									color: "var(--da-text-dim)",
									alignSelf: "center"
								},
								children: "时间"
							}), days.map((day) => {
								const dayInfo = infoByDate.get(day);
								const isNonWork = dayInfo?.dayType === "weekend" || dayInfo?.dayType === "holiday";
								const lunarAccent = dayInfo !== void 0 ? lunarAccentOf(dayInfo) : null;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: `${isNonWork ? "da-nonwork" : ""} ${dayInfo !== void 0 ? cellBgClass(dayInfo) : ""} ${day === todayStr ? "da-today-cell" : ""}`,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "da-dow",
											children: weekdayCn(dayInfo?.weekday ?? 1)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "da-dom",
											style: day === todayStr ? { color: "var(--da-accent)" } : void 0,
											children: Number(day.slice(8, 10))
										}),
										lunarAccent !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: `da-dim ${lunarAccent.cls}`,
											style: { fontSize: 10 },
											children: lunarAccent.text
										}) : dayInfo?.lunarText !== void 0 && dayInfo.lunarText !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "da-dim",
											style: { fontSize: 10 },
											children: dayInfo.lunarText
										}),
										dayInfo?.dayType === "holiday" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "da-badge da-holiday",
											children: "休"
										}),
										dayInfo?.dayType === "adjusted-workday" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "da-badge da-work",
											children: "班"
										})
									]
								}, day);
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "da-whead",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {}), days.map((day) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									borderTop: "1px solid var(--da-border)",
									minHeight: 24,
									display: "flex",
									flexDirection: "column"
								},
								children: (eventsByDate.get(day) ?? []).filter((event) => event.allDay).map((event) => renderEvent(event))
							}, day))]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "da-gutter-hours",
							children: HOURS.map((hour) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "da-hour",
								style: { top: hour * PX_PER_HOUR },
								title: `${String(hour).padStart(2, "0")}:00`,
								children: `${String(hour).padStart(2, "0")}:00`
							}, hour))
						}),
						days.map((day) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "da-wcol",
							children: [HOURS.map((hour) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "da-hour",
								style: { top: hour * PX_PER_HOUR },
								title: `${Number(day.slice(8, 10))}日 ${String(hour).padStart(2, "0")}:00 新建日程`,
								onClick: () => handleSlotClick(day, hour)
							}, hour)), (eventsByDate.get(day) ?? []).filter((event) => !event.allDay).map((event) => renderEvent(event))]
						}, day))
					]
				})
			] });
		}
		//#endregion
		//#region src/client/views/todo-view.tsx
		/**
		* dsh-agenda — 待办视图（需求 §4 Todo 全量管理 + V0.2 重复待办）。
		*
		* 数据源为 host 展开的实例列表（重复待办在每个到期日出现一条），
		* 状态过滤（全部/未完成/已完成）+ 按日期分组 + 快速新建 + 勾选实例完成。
		*/
		const RECURRENCE_LABEL = {
			daily: "每天",
			weekly: "每周",
			monthly: "每月",
			yearly: "每年"
		};
		function TodoView({ onEditTodo, onNewTodo }) {
			const { snapshot, client, connected } = useAgenda();
			const [filter, setFilter] = usePersistentState("todo.filter", "pending");
			const [quickTitle, setQuickTitle] = usePersistentState("todo.quickTitle", "");
			const [quickDate, setQuickDate] = usePersistentState("todo.quickDate", () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10));
			const [instances, setInstances] = (0, react.useState)([]);
			(0, react.useEffect)(() => {
				if (!connected) return;
				let stopped = false;
				client.listTodoInstances().then((list) => {
					if (!stopped) setInstances(list);
				}).catch(() => void 0);
				return () => {
					stopped = true;
				};
			}, [
				client,
				connected,
				snapshot?.dataVersion
			]);
			const templates = (0, react.useMemo)(() => {
				const map = /* @__PURE__ */ new Map();
				for (const todo of snapshot?.todos ?? []) map.set(todo.id, todo);
				return map;
			}, [snapshot]);
			const todos = (0, react.useMemo)(() => {
				const list = instances.filter((instance) => {
					if (filter === "pending") return instance.status === "pending";
					if (filter === "completed") return instance.status === "completed";
					return true;
				});
				list.sort((a, b) => a.status !== b.status ? a.status === "pending" ? -1 : 1 : a.date.localeCompare(b.date));
				return list;
			}, [instances, filter]);
			const groups = (0, react.useMemo)(() => {
				const map = /* @__PURE__ */ new Map();
				for (const todo of todos) {
					const list = map.get(todo.date) ?? [];
					list.push(todo);
					map.set(todo.date, list);
				}
				return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
			}, [todos]);
			const counts = (0, react.useMemo)(() => {
				const all = instances.length;
				const pending = instances.filter((instance) => instance.status === "pending").length;
				return {
					all,
					pending,
					completed: all - pending
				};
			}, [instances]);
			const addQuick = async () => {
				const title = quickTitle.trim();
				if (title === "") return;
				await client.createTodo({
					title,
					date: quickDate
				}).then(() => setQuickTitle((current) => current.trim() === title ? "" : current)).catch(() => void 0);
			};
			const toggle = async (instance) => {
				await client.updateTodo(instance.templateId, {
					status: instance.status === "completed" ? "pending" : "completed",
					statusDate: instance.date
				}).catch(() => void 0);
			};
			const openEdit = (instance) => {
				const template = templates.get(instance.templateId);
				if (template !== void 0) onEditTodo({
					kind: "edit",
					todo: template
				});
			};
			const weekdayOf = (date) => {
				return ((/* @__PURE__ */ new Date(`${date}T00:00:00Z`)).getUTCDay() + 6) % 7 + 1;
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "da-row",
					style: { marginBottom: 12 },
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "da-tabs",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: filter === "pending" ? "da-active" : "",
									onClick: () => setFilter("pending"),
									children: ["未完成 ", counts.pending]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: filter === "completed" ? "da-active" : "",
									onClick: () => setFilter("completed"),
									children: ["已完成 ", counts.completed]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: filter === "all" ? "da-active" : "",
									onClick: () => setFilter("all"),
									children: ["全部 ", counts.all]
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "da-grow" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "da-btn da-primary",
							onClick: () => onNewTodo(void 0),
							children: "＋ 新建待办"
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "da-card",
					style: { marginBottom: 14 },
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "da-row",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "da-input da-grow",
								placeholder: "快速添加待办标题",
								value: quickTitle,
								onChange: (e) => setQuickTitle(e.target.value),
								onKeyDown: (e) => {
									if (e.key === "Enter") addQuick();
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "da-input",
								type: "date",
								value: quickDate,
								onChange: (e) => setQuickDate(e.target.value)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "da-btn",
								onClick: () => void addQuick(),
								children: "添加"
							})
						]
					})
				}),
				groups.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "da-card",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "da-empty",
						children: "没有符合条件的待办"
					})
				}) : groups.map(([date, list]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "da-card",
					style: { marginBottom: 10 },
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "da-row",
						style: { marginBottom: 6 },
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: { fontWeight: 600 },
								children: cnDate(date)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "da-dim",
								children: weekdayCn(weekdayOf(date))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "da-grow" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "da-dim",
								children: [list.filter((todo) => todo.status === "pending").length, " 未完成"]
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "da-list",
						children: list.map((instance) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: `da-todo-item ${instance.status === "completed" ? "da-done" : ""}`,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: `da-check ${instance.status === "completed" ? "da-checked" : ""}`,
									onClick: () => void toggle(instance),
									children: instance.status === "completed" ? "✓" : ""
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "da-grow da-todo-title",
									onClick: () => openEdit(instance),
									children: instance.title
								}),
								instance.recurrence !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "da-badge da-weekend",
									title: "重复待办",
									children: ["🔁 ", RECURRENCE_LABEL[instance.recurrence]]
								}),
								instance.category !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "da-badge da-cat",
									children: instance.category
								})
							]
						}, `${instance.templateId}-${instance.date}`))
					})]
				}, date))
			] });
		}
		//#endregion
		//#region src/client/views/statistics-view.tsx
		/**
		* dsh-agenda — 统计视图（需求 §10）。
		*
		* 范围：本周 / 本月 / 自定义（from/to）。指标：日程数、全天日程、定时时长、
		* 待办完成情况、分类聚合（条数 + 时长条形图）。
		*/
		function monthRange() {
			const now = /* @__PURE__ */ new Date();
			const year = now.getUTCFullYear();
			const month = now.getUTCMonth() + 1;
			const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
			return {
				from: `${year}-${String(month).padStart(2, "0")}-01`,
				to: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
			};
		}
		function weekRangeOf() {
			const now = /* @__PURE__ */ new Date();
			now.toISOString().slice(0, 10);
			const weekday = (now.getUTCDay() + 6) % 7 + 1;
			return {
				from: (/* @__PURE__ */ new Date(now.getTime() - (weekday - 1) * 864e5)).toISOString().slice(0, 10),
				to: new Date(now.getTime() + (7 - weekday) * 864e5).toISOString().slice(0, 10)
			};
		}
		function StatisticsView() {
			const { client, snapshot, connected } = useAgenda();
			const [rangeKey, setRangeKey] = usePersistentState("statistics.rangeKey", "week");
			const [custom, setCustom] = usePersistentState("statistics.custom", {
				from: "",
				to: ""
			});
			const [stats, setStats] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)("");
			const [loading, setLoading] = (0, react.useState)(false);
			const resolveRange = (0, react.useCallback)(() => {
				if (rangeKey === "week") return weekRangeOf();
				if (rangeKey === "month") return monthRange();
				return {
					from: custom.from || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
					to: custom.to || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)
				};
			}, [rangeKey, custom]);
			const load = (0, react.useCallback)(async () => {
				setLoading(true);
				setError("");
				try {
					const range = resolveRange();
					const result = await client.op("statistics", {
						from: range.from,
						to: range.to
					});
					setStats(result);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setLoading(false);
				}
			}, [client, resolveRange]);
			(0, react.useEffect)(() => {
				if (connected) load();
			}, [
				load,
				connected,
				snapshot?.dataVersion
			]);
			const maxTotal = Math.max(1, ...stats?.byCategory.map((row) => row.eventCount + row.todoCount) ?? [1]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "da-row",
					style: { marginBottom: 12 },
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "da-tabs",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: rangeKey === "week" ? "da-active" : "",
									onClick: () => setRangeKey("week"),
									children: "本周"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: rangeKey === "month" ? "da-active" : "",
									onClick: () => setRangeKey("month"),
									children: "本月"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: rangeKey === "custom" ? "da-active" : "",
									onClick: () => setRangeKey("custom"),
									children: "自定义"
								})
							]
						}),
						rangeKey === "custom" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "da-input",
								type: "date",
								value: custom.from,
								onChange: (e) => setCustom((prev) => ({
									...prev,
									from: e.target.value
								}))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "da-dim",
								children: "至"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "da-input",
								type: "date",
								value: custom.to,
								onChange: (e) => setCustom((prev) => ({
									...prev,
									to: e.target.value
								}))
							})
						] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "da-grow" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "da-btn",
							onClick: () => void load(),
							disabled: loading,
							children: loading ? "统计中…" : "重新统计"
						})
					]
				}),
				error !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "da-card",
					style: {
						color: "#c62828",
						marginBottom: 12
					},
					children: error
				}),
				stats !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "da-stats-grid",
					style: { marginBottom: 14 },
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "da-stat-card",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "da-stat-num",
								children: stats.eventCount
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "da-stat-label",
								children: "日程总数"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "da-stat-card",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "da-stat-num",
								children: stats.allDayEventCount
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "da-stat-label",
								children: "全天日程"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "da-stat-card",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "da-stat-num",
								children: [stats.eventHours, "h"]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "da-stat-label",
								children: "定时日程时长"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "da-stat-card",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "da-stat-num",
								children: stats.todoCount
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "da-stat-label",
								children: "待办总数"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "da-stat-card",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "da-stat-num",
								children: stats.todoCompleted
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "da-stat-label",
								children: "已完成"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "da-stat-card",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "da-stat-num",
								children: [Math.round(stats.todoCompletionRate * 100), "%"]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "da-stat-label",
								children: "完成率"
							})]
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "da-card",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "da-section-title",
							style: { marginTop: 0 },
							children: "按分类"
						}),
						stats.byCategory.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "da-empty",
							children: "该范围没有数据"
						}),
						stats.byCategory.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "da-cat-row",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "da-cat-name",
									children: row.category
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "da-bar",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { style: { width: `${Math.round((row.eventCount + row.todoCount) / maxTotal * 100)}%` } })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "da-dim",
									style: {
										minWidth: 130,
										textAlign: "right"
									},
									children: [
										"日程 ",
										row.eventCount,
										" · 待办 ",
										row.todoCount,
										" · ",
										row.eventHours,
										"h"
									]
								})
							]
						}, row.category))
					]
				})] })
			] });
		}
		//#endregion
		//#region src/client/views/search-view.tsx
		/**
		* dsh-agenda — 搜索视图（需求 §11）。
		*
		* 联合搜索日程与待办（标题 / 备注 / 分类），可选日期范围过滤。
		*/
		function SearchView({ onEditEvent, onEditTodo }) {
			const { client, snapshot, connected } = useAgenda();
			const [query, setQuery] = usePersistentState("search.query", "");
			const [eventsFrom, setEventsFrom] = usePersistentState("search.eventsFrom", "");
			const [eventsTo, setEventsTo] = usePersistentState("search.eventsTo", "");
			const [todosFrom, setTodosFrom] = usePersistentState("search.todosFrom", "");
			const [todosTo, setTodosTo] = usePersistentState("search.todosTo", "");
			const [result, setResult] = usePersistentState("search.result", null);
			const [error, setError] = (0, react.useState)("");
			const [loading, setLoading] = (0, react.useState)(false);
			const [submitted, setSubmitted] = usePersistentState("search.submitted", null);
			(0, react.useEffect)(() => {
				if (!submitted) return;
				if (!connected) return;
				let stopped = false;
				setLoading(true);
				setError("");
				client.op("search", submitted).then((found) => {
					if (!stopped) setResult(found);
				}).catch((err) => {
					if (!stopped) setError(String(err.message));
				}).finally(() => {
					if (!stopped) setLoading(false);
				});
				return () => {
					stopped = true;
				};
			}, [
				client,
				connected,
				submitted,
				snapshot?.dataVersion
			]);
			const search = async () => {
				const q = query.trim();
				if (q === "") {
					setError("请输入搜索词。");
					return;
				}
				setSubmitted({
					query: q,
					eventsFrom: eventsFrom || void 0,
					eventsTo: eventsTo || void 0,
					todosFrom: todosFrom || void 0,
					todosTo: todosTo || void 0
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "da-card",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "da-search-box",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: "da-input",
							placeholder: "搜索日程 / 待办（标题、备注、分类）",
							value: query,
							onChange: (e) => setQuery(e.target.value),
							onKeyDown: (e) => {
								if (e.key === "Enter") search();
							},
							autoFocus: true
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "da-btn da-primary",
							onClick: () => void search(),
							disabled: loading,
							children: loading ? "搜索中…" : "搜索"
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "da-row",
						style: {
							gap: 8,
							flexWrap: "wrap"
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "da-dim",
								children: "日程范围"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "da-input",
								type: "date",
								value: eventsFrom,
								onChange: (e) => setEventsFrom(e.target.value)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "da-dim",
								children: "至"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "da-input",
								type: "date",
								value: eventsTo,
								onChange: (e) => setEventsTo(e.target.value)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "da-dim",
								style: { marginLeft: 8 },
								children: "待办范围"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "da-input",
								type: "date",
								value: todosFrom,
								onChange: (e) => setTodosFrom(e.target.value)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "da-dim",
								children: "至"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "da-input",
								type: "date",
								value: todosTo,
								onChange: (e) => setTodosTo(e.target.value)
							})
						]
					})]
				}),
				error !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "da-card",
					style: {
						color: "#c62828",
						marginTop: 12
					},
					children: error
				}),
				result !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "da-section-title",
						children: [
							"日程（",
							result.eventTotal,
							" 条",
							result.truncated ? "，已截断" : "",
							"）"
						]
					}),
					result.events.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "da-card",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "da-empty",
							children: "未找到匹配的日程"
						})
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "da-card da-list",
						children: result.events.map((event) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: `da-event-item ${event.allDay ? "da-allday" : ""}`,
							onClick: () => onEditEvent({
								kind: "edit",
								event
							}),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "da-time",
								children: eventTimeText(event)
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "da-grow",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "da-title",
									children: event.title
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "da-row",
									style: {
										gap: 4,
										marginTop: 2
									},
									children: [event.category !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "da-badge da-cat",
										children: event.category
									}), event.description !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "da-dim",
										children: event.description
									})]
								})]
							})]
						}, event.id))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "da-section-title",
						children: [
							"待办（",
							result.todoTotal,
							" 条",
							result.truncated ? "，已截断" : "",
							"）"
						]
					}),
					result.todos.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "da-card",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "da-empty",
							children: "未找到匹配的待办"
						})
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "da-card da-list",
						children: result.todos.map((todo) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: `da-todo-item ${todo.status === "completed" ? "da-done" : ""}`,
							onClick: () => onEditTodo({
								kind: "edit",
								todo
							}),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "da-grow da-todo-title",
									children: todo.title
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "da-dim",
									children: todo.date
								}),
								todo.category !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "da-badge da-cat",
									children: todo.category
								})
							]
						}, todo.id))
					})
				] })
			] });
		}
		//#endregion
		//#region src/client/components/event-editor.tsx
		/**
		* dsh-agenda — Event 编辑器（新建 / 编辑 / 删除）。
		*
		* 支持公历 / 农历两条路径（需求 §5/§7），农历事件保留原始农历字段；
		* 分类为路径式多级选择 + 自由输入（首次引用自动登记）。
		*/
		function EventEditor({ mode, onClose }) {
			const { client, snapshot, todayInfo } = useAgenda();
			const editing = mode.kind === "edit" ? mode.event : null;
			const createMode = mode.kind === "create" ? mode : null;
			const [title, setTitle] = usePersistentState("eventEditor.title", editing?.title ?? "");
			const [calendarType, setCalendarType] = usePersistentState("eventEditor.calendarType", editing?.calendarType ?? "solar");
			const [allDay, setAllDay] = usePersistentState("eventEditor.allDay", editing?.allDay ?? false);
			const [startDate, setStartDate] = usePersistentState("eventEditor.startDate", editing?.start.slice(0, 10) ?? createMode?.date ?? todayISO());
			const [startTime, setStartTime] = usePersistentState("eventEditor.startTime", () => editing !== null && !editing.allDay ? editing.start.slice(11, 16) : createMode?.hour ?? "09:00");
			const [endDate, setEndDate] = usePersistentState("eventEditor.endDate", editing?.end.slice(0, 10) ?? createMode?.date ?? todayISO());
			const [endTime, setEndTime] = usePersistentState("eventEditor.endTime", () => editing !== null && !editing.allDay ? editing.end.slice(11, 16) : "10:00");
			const [lunarYear, setLunarYear] = usePersistentState("eventEditor.lunarYear", () => editing?.lunarYear ?? todayInfo?.lunarYear ?? Number(todayISO().slice(0, 4)));
			const [lunarMonth, setLunarMonth] = usePersistentState("eventEditor.lunarMonth", () => editing?.lunarMonth ?? 1);
			const [lunarDay, setLunarDay] = usePersistentState("eventEditor.lunarDay", () => editing?.lunarDay ?? 1);
			const [lunarLeap, setLunarLeap] = usePersistentState("eventEditor.lunarLeap", () => editing?.lunarLeap ?? false);
			const [lunarStartTime, setLunarStartTime] = usePersistentState("eventEditor.lunarStartTime", () => editing?.lunarMonth !== void 0 && !editing.allDay ? editing.start.slice(11, 16) : "09:00");
			const [lunarEndTime, setLunarEndTime] = usePersistentState("eventEditor.lunarEndTime", () => editing?.lunarMonth !== void 0 && !editing.allDay ? editing.end.slice(11, 16) : "10:00");
			const [category, setCategory] = usePersistentState("eventEditor.category", editing?.category ?? "");
			const [location, setLocation] = usePersistentState("eventEditor.location", editing?.location ?? "");
			const [description, setDescription] = usePersistentState("eventEditor.description", editing?.description ?? "");
			const [error, setError] = (0, react.useState)("");
			const [saving, setSaving] = (0, react.useState)(false);
			const draft = JSON.stringify([
				title,
				calendarType,
				allDay,
				startDate,
				startTime,
				endDate,
				endTime,
				lunarYear,
				lunarMonth,
				lunarDay,
				lunarLeap,
				lunarStartTime,
				lunarEndTime,
				category,
				location,
				description
			]);
			const [baseline] = usePersistentState("eventEditor.baseline", draft);
			const requestClose = () => {
				if (!saving && (draft === baseline || window.confirm("放弃未保存的修改吗？"))) onClose();
			};
			const dialogRef = useDialog(requestClose);
			const categories = snapshot?.categories ?? [];
			const buildInput = () => {
				const base = {
					title,
					calendarType,
					allDay,
					category: category.trim() === "" ? void 0 : category.trim(),
					location: location.trim() === "" ? void 0 : location.trim(),
					description: description.trim() === "" ? void 0 : description.trim()
				};
				if (calendarType === "lunar") {
					base.lunarYear = Number(lunarYear);
					base.lunarMonth = Number(lunarMonth);
					base.lunarDay = Number(lunarDay);
					base.lunarLeap = lunarLeap;
					if (!allDay) {
						base.startTime = lunarStartTime;
						base.endTime = lunarEndTime;
					}
					return base;
				}
				base.start = allDay ? startDate : `${startDate}T${startTime || "09:00"}`;
				base.end = allDay ? endDate : `${endDate}T${endTime || "10:00"}`;
				return base;
			};
			const save = async () => {
				if (title.trim() === "") {
					setError("标题不能为空。");
					return;
				}
				setSaving(true);
				setError("");
				try {
					const input = buildInput();
					if (editing !== null) await client.updateEvent(editing.id, { ...input });
					else await client.createEvent(input);
					onClose();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setSaving(false);
				}
			};
			const remove = async () => {
				if (editing === null) return;
				if (!window.confirm(`确定删除日程「${editing.title}」吗？`)) return;
				setSaving(true);
				try {
					await client.deleteEvent(editing.id);
					onClose();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
					setSaving(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "da-modal",
				onMouseDown: (e) => {
					if (e.target === e.currentTarget) requestClose();
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "da-modal-card",
					ref: dialogRef,
					role: "dialog",
					"aria-modal": "true",
					"aria-label": "日程编辑",
					tabIndex: -1,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: editing !== null ? "编辑日程" : "新建日程" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "da-form",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "da-field",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: "标题 *" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: "da-input",
									value: title,
									onChange: (e) => setTitle(e.target.value),
									placeholder: "例如：算法评审"
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "da-inline",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "da-tabs",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: calendarType === "solar" ? "da-active" : "",
										onClick: () => setCalendarType("solar"),
										children: "公历"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: calendarType === "lunar" ? "da-active" : "",
										onClick: () => setCalendarType("lunar"),
										children: "农历"
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "da-row",
									style: { gap: 6 },
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: allDay,
										onChange: (e) => setAllDay(e.target.checked)
									}), "全天"]
								})]
							}),
							calendarType === "solar" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "da-field",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: "开始" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "da-inline",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "da-input",
										type: "date",
										value: startDate,
										onChange: (e) => setStartDate(e.target.value)
									}), !allDay && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "da-input",
										type: "time",
										value: startTime,
										onChange: (e) => setStartTime(e.target.value)
									})]
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "da-field",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: "结束" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "da-inline",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "da-input",
										type: "date",
										value: endDate,
										onChange: (e) => setEndDate(e.target.value)
									}), !allDay && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "da-input",
										type: "time",
										value: endTime,
										onChange: (e) => setEndTime(e.target.value)
									})]
								})]
							})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "da-field",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: "农历日期" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "da-inline",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												className: "da-input",
												type: "number",
												min: 1900,
												max: 2099,
												style: { width: 90 },
												value: lunarYear,
												onChange: (e) => setLunarYear(Number(e.target.value))
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "da-dim",
												children: "年"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												className: "da-input",
												type: "number",
												min: 1,
												max: 12,
												style: { width: 70 },
												value: lunarMonth,
												onChange: (e) => setLunarMonth(Number(e.target.value))
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "da-dim",
												children: "月"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												className: "da-input",
												type: "number",
												min: 1,
												max: 30,
												style: { width: 70 },
												value: lunarDay,
												onChange: (e) => setLunarDay(Number(e.target.value))
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "da-dim",
												children: "日"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: "da-row",
												style: {
													gap: 6,
													marginLeft: 8
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "checkbox",
													checked: lunarLeap,
													onChange: (e) => setLunarLeap(e.target.checked)
												}), "闰月"]
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "da-dim",
										children: "农历事件会保留原始农历信息，并换算为公历显示。"
									})
								]
							}), !allDay && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "da-field",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: "时间（农历事件按当日换算）" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "da-inline",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: "da-input",
											type: "time",
											value: lunarStartTime,
											onChange: (e) => setLunarStartTime(e.target.value)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "da-dim",
											children: "至"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: "da-input",
											type: "time",
											value: lunarEndTime,
											onChange: (e) => setLunarEndTime(e.target.value)
										})
									]
								})]
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "da-field",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: "分类（路径式，如 工作/防干烧/算法）" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "da-input",
										list: "da-category-options",
										value: category,
										onChange: (e) => setCategory(e.target.value),
										placeholder: "选择或输入新分类"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("datalist", {
										id: "da-category-options",
										children: categories.map((path) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { value: path }, path))
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "da-field",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: "地点" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: "da-input",
									value: location,
									onChange: (e) => setLocation(e.target.value)
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "da-field",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: "备注" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
									className: "da-textarea",
									value: description,
									onChange: (e) => setDescription(e.target.value)
								})]
							}),
							error !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "da-dim",
								style: { color: "#c62828" },
								children: error
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "da-row",
								style: {
									justifyContent: "flex-end",
									marginTop: 4
								},
								children: [
									editing !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "da-btn da-danger",
										onClick: () => void remove(),
										disabled: saving,
										children: "删除"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "da-btn",
										onClick: requestClose,
										disabled: saving,
										children: "取消"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "da-btn da-primary",
										onClick: () => void save(),
										disabled: saving,
										children: saving ? "保存中…" : "保存"
									})
								]
							})
						]
					})]
				})
			});
		}
		//#endregion
		//#region src/client/components/todo-editor.tsx
		/**
		* dsh-agenda — Todo 编辑器（新建 / 编辑 / 删除）。
		*
		* 支持重复（每天/每周/每月/每年）；「每年」重复可切换农历基准（如每年农历生日），
		* 农历基准保留原始农历字段并自动换算公历日期。
		*/
		const RECURRENCE_OPTIONS = [
			{
				value: "none",
				label: "不重复"
			},
			{
				value: "daily",
				label: "每天"
			},
			{
				value: "weekly",
				label: "每周"
			},
			{
				value: "monthly",
				label: "每月"
			},
			{
				value: "yearly",
				label: "每年"
			}
		];
		function TodoEditor({ mode, onClose }) {
			const { client, snapshot, todayInfo } = useAgenda();
			const editing = mode.kind === "edit" ? mode.todo : null;
			const createMode = mode.kind === "create" ? mode : null;
			const [title, setTitle] = usePersistentState("todoEditor.title", editing?.title ?? "");
			const [date, setDate] = usePersistentState("todoEditor.date", editing?.date ?? createMode?.date ?? todayISO());
			const [category, setCategory] = usePersistentState("todoEditor.category", editing?.category ?? "");
			const [description, setDescription] = usePersistentState("todoEditor.description", editing?.description ?? "");
			const [recurrence, setRecurrence] = usePersistentState("todoEditor.recurrence", editing?.recurrence ?? "none");
			const [isLunar, setIsLunar] = usePersistentState("todoEditor.isLunar", editing?.calendarType === "lunar");
			const [lunarYear, setLunarYear] = usePersistentState("todoEditor.lunarYear", editing?.lunarYear ?? todayInfo?.lunarYear ?? Number(todayISO().slice(0, 4)));
			const [lunarMonth, setLunarMonth] = usePersistentState("todoEditor.lunarMonth", editing?.lunarMonth ?? 1);
			const [lunarDay, setLunarDay] = usePersistentState("todoEditor.lunarDay", editing?.lunarDay ?? 1);
			const [lunarLeap, setLunarLeap] = usePersistentState("todoEditor.lunarLeap", editing?.lunarLeap ?? false);
			const [error, setError] = (0, react.useState)("");
			const [saving, setSaving] = (0, react.useState)(false);
			const draft = JSON.stringify([
				title,
				date,
				category,
				description,
				recurrence,
				isLunar,
				lunarYear,
				lunarMonth,
				lunarDay,
				lunarLeap
			]);
			const [baseline] = usePersistentState("todoEditor.baseline", draft);
			const requestClose = () => {
				if (!saving && (draft === baseline || window.confirm("放弃未保存的修改吗？"))) onClose();
			};
			const dialogRef = useDialog(requestClose);
			const categories = snapshot?.categories ?? [];
			const buildInput = () => {
				const input = {
					title,
					date,
					...category.trim() !== "" ? { category: category.trim() } : {},
					...description.trim() !== "" ? { description: description.trim() } : {},
					...recurrence !== "none" ? { recurrence } : {}
				};
				if (recurrence === "yearly" && isLunar) {
					input.calendarType = "lunar";
					input.lunarYear = Number(lunarYear);
					input.lunarMonth = Number(lunarMonth);
					input.lunarDay = Number(lunarDay);
					input.lunarLeap = lunarLeap;
				}
				return input;
			};
			const save = async () => {
				if (title.trim() === "") {
					setError("标题不能为空。");
					return;
				}
				setSaving(true);
				setError("");
				try {
					const input = buildInput();
					if (editing !== null) await client.updateTodo(editing.id, input);
					else await client.createTodo(input);
					onClose();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setSaving(false);
				}
			};
			const remove = async () => {
				if (editing === null) return;
				if (!window.confirm(`确定删除待办「${editing.title}」吗？`)) return;
				setSaving(true);
				try {
					await client.deleteTodo(editing.id);
					onClose();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
					setSaving(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "da-modal",
				onMouseDown: (e) => {
					if (e.target === e.currentTarget) requestClose();
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "da-modal-card",
					ref: dialogRef,
					role: "dialog",
					"aria-modal": "true",
					"aria-label": "待办编辑",
					tabIndex: -1,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: editing !== null ? "编辑待办" : "新建待办" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "da-form",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "da-field",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: "标题 *" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: "da-input",
									value: title,
									onChange: (e) => setTitle(e.target.value)
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "da-field",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: "重复" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "da-inline",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
										className: "da-select",
										value: recurrence,
										onChange: (e) => setRecurrence(e.target.value),
										children: RECURRENCE_OPTIONS.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: option.value,
											children: option.label
										}, option.value))
									}), recurrence === "yearly" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: "da-row",
										style: { gap: 6 },
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: isLunar,
											onChange: (e) => setIsLunar(e.target.checked)
										}), "农历基准（如每年农历生日）"]
									})]
								})]
							}),
							recurrence === "yearly" && isLunar ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "da-field",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: "农历日期（每年按农历重复，自动换算公历）" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "da-inline",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: "da-input",
											type: "number",
											min: 1900,
											max: 2099,
											style: { width: 90 },
											value: lunarYear,
											onChange: (e) => setLunarYear(Number(e.target.value))
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "da-dim",
											children: "年"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: "da-input",
											type: "number",
											min: 1,
											max: 12,
											style: { width: 70 },
											value: lunarMonth,
											onChange: (e) => setLunarMonth(Number(e.target.value))
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "da-dim",
											children: "月"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: "da-input",
											type: "number",
											min: 1,
											max: 30,
											style: { width: 70 },
											value: lunarDay,
											onChange: (e) => setLunarDay(Number(e.target.value))
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "da-dim",
											children: "日"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: "da-row",
											style: {
												gap: 6,
												marginLeft: 8
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "checkbox",
												checked: lunarLeap,
												onChange: (e) => setLunarLeap(e.target.checked)
											}), "闰月"]
										})
									]
								})]
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "da-field",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: "日期" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: "da-input",
									type: "date",
									value: date,
									onChange: (e) => setDate(e.target.value)
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "da-field",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: "分类" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "da-input",
										list: "da-todo-categories",
										value: category,
										onChange: (e) => setCategory(e.target.value)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("datalist", {
										id: "da-todo-categories",
										children: categories.map((path) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { value: path }, path))
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "da-field",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: "备注" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
									className: "da-textarea",
									value: description,
									onChange: (e) => setDescription(e.target.value)
								})]
							}),
							error !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "da-dim",
								style: { color: "var(--da-holiday)" },
								children: error
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "da-row",
								style: {
									justifyContent: "flex-end",
									marginTop: 4
								},
								children: [
									editing !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "da-btn da-danger",
										onClick: () => void remove(),
										disabled: saving,
										children: "删除"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "da-btn",
										onClick: requestClose,
										disabled: saving,
										children: "取消"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "da-btn da-primary",
										onClick: () => void save(),
										disabled: saving,
										children: saving ? "保存中…" : "保存"
									})
								]
							})
						]
					})]
				})
			});
		}
		//#endregion
		//#region src/client/agenda-app.tsx
		/**
		* dsh-agenda — 应用壳：主导航 + 视图切换 + 全局编辑器状态。
		*/
		function AgendaAppInner() {
			const { client, connected, error } = useAgenda();
			const [view, setView] = usePersistentState("app.view", "today");
			const [editor, setEditor] = usePersistentState("app.editor", null);
			const [todoEditor, setTodoEditor] = usePersistentState("app.todoEditor", null);
			const closeEditor = (prefix) => {
				for (const key of client.uiState.keys()) if (key.startsWith(prefix + ".")) client.uiState.delete(key);
				if (prefix === "eventEditor") setEditor(null);
				else setTodoEditor(null);
			};
			const today = todayISO();
			const openNewEvent = (date, hour) => {
				setEditor({
					kind: "create",
					date,
					hour
				});
			};
			const openNewTodo = (date) => {
				setTodoEditor({
					kind: "create",
					date
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "da-root",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "da-header",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", { children: "日程" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SegmentedTabs, {
								className: "da-nav",
								label: "日程视图",
								value: view,
								onChange: (value) => setView(value),
								items: [
									{
										value: "today",
										label: "今天"
									},
									{
										value: "month",
										label: "月历"
									},
									{
										value: "week",
										label: "周历"
									},
									{
										value: "todo",
										label: "待办"
									},
									{
										value: "stats",
										label: "统计"
									},
									{
										value: "search",
										label: "搜索"
									}
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
								disabled: !connected,
								onClick: () => openNewEvent(),
								children: "＋ 新建日程"
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "da-main",
						children: [
							!connected && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "da-card",
								style: {
									marginBottom: 12,
									color: "var(--da-text-dim)"
								},
								children: ["日程服务尚未连接；暂时无法提交操作。", error !== null ? `（${error}）` : ""]
							}),
							connected && error && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "da-card",
								role: "alert",
								children: [
									error,
									" ",
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "da-btn",
										onClick: () => void client.refresh().catch(() => void 0),
										children: "刷新核对"
									})
								]
							}),
							view === "today" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TodayView, {
								onEditEvent: setEditor,
								onNewEvent: openNewEvent,
								onEditTodo: setTodoEditor,
								onNewTodo: openNewTodo
							}),
							view === "month" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MonthView, {
								initialMonth: today.slice(0, 7),
								onEditEvent: setEditor,
								onNewEvent: openNewEvent,
								onEditTodo: setTodoEditor,
								onNewTodo: openNewTodo
							}, `month-${today}`),
							view === "week" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WeekView, {
								initialDate: today,
								onEditEvent: setEditor,
								onNewEvent: openNewEvent
							}, `week-${today}`),
							view === "todo" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TodoView, {
								onEditTodo: setTodoEditor,
								onNewTodo: openNewTodo
							}),
							view === "stats" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatisticsView, {}),
							view === "search" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SearchView, {
								onEditEvent: setEditor,
								onEditTodo: setTodoEditor
							})
						]
					}),
					editor !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EventEditor, {
						mode: editor,
						onClose: () => closeEditor("eventEditor")
					}),
					todoEditor !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TodoEditor, {
						mode: todoEditor,
						onClose: () => closeEditor("todoEditor")
					})
				]
			});
		}
		/** 面板根（供 slots.register 渲染）。 */
		function AgendaApp({ client }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AgendaProvider, {
				client,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AgendaAppInner, {})
			});
		}
		//#endregion
		//#region src/client/native.ts
		/** 公开 Desktop 传输地址；HTTP 页才可回退页面来源。 */
		function agendaSocketUrl(location, transport) {
			let url;
			if (transport?.streamBaseUrl) url = new URL("agenda/ws", transport.streamBaseUrl.replace(/\/+$/, "") + "/");
			else if (location.protocol === "http:" || location.protocol === "https:") url = new URL("/agenda/ws", location.href);
			else throw Error("Desktop 未提供有效的日程服务地址。");
			if (url.protocol !== "http:" && url.protocol !== "https:") throw Error("日程服务地址协议无效。");
			if (location.protocol === "dsh-app:" && ![
				"localhost",
				"127.0.0.1",
				"[::1]"
			].includes(url.hostname)) throw Error("Desktop 日程服务须为回环地址。");
			url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
			return url.toString();
		}
		//#endregion
		//#region src/client/api.ts
		/** 原生／HTTP 共用 WS 客户端；只读重连，不重放写操作。 */
		const mutationOps = /* @__PURE__ */ new Set([
			"create-event",
			"update-event",
			"delete-event",
			"create-todo",
			"update-todo",
			"delete-todo",
			"create-category",
			"delete-category",
			"update-settings"
		]);
		var AgendaClient = class {
			wsUrl;
			ws = null;
			pending = /* @__PURE__ */ new Map();
			listeners = /* @__PURE__ */ new Set();
			reconnectTimer;
			failures = 0;
			manualClose = false;
			baselineReady = false;
			generation = 0;
			calendarCache = /* @__PURE__ */ new Map();
			uiState = /* @__PURE__ */ new Map();
			connected = false;
			snapshot = null;
			error = null;
			operationError = null;
			constructor(wsUrl, unavailable) {
				this.wsUrl = wsUrl;
				this.error = unavailable ?? null;
				if (wsUrl) this.connect();
			}
			subscribe(listener) {
				this.listeners.add(listener);
				return () => this.listeners.delete(listener);
			}
			notify() {
				for (const listener of this.listeners) listener();
			}
			acceptSnapshot(snapshot) {
				if (!snapshot || !Number.isSafeInteger(snapshot.dataVersion) || !Array.isArray(snapshot.events) || !Array.isArray(snapshot.todos) || !snapshot.settings || !snapshot.holidayData) return;
				if (this.baselineReady && this.snapshot && snapshot.dataVersion < this.snapshot.dataVersion) return;
				this.baselineReady = true;
				this.connected = true;
				this.snapshot = snapshot;
				this.calendarCache.clear();
				this.error = this.operationError;
				this.notify();
			}
			connect() {
				if (this.manualClose || !this.wsUrl) return;
				this.baselineReady = false;
				this.generation += 1;
				const generation = this.generation;
				const ws = new WebSocket(this.wsUrl);
				this.ws = ws;
				ws.onopen = () => {
					if (this.ws !== ws || this.manualClose) return;
					this.failures = 0;
					ws.send(JSON.stringify({ type: "hello" }));
					this.refresh(false).catch((error) => {
						if (this.ws === ws) {
							this.error = String(error.message);
							this.notify();
						}
					});
				};
				ws.onmessage = (event) => {
					if (this.ws !== ws || this.manualClose) return;
					let message;
					try {
						message = JSON.parse(String(event.data));
					} catch {
						return;
					}
					if (!message || typeof message !== "object") return;
					if (message.type === "snapshot") this.acceptSnapshot(message.snapshot);
					else if (message.type === "op-result") {
						const pending = this.pending.get(message.id);
						if (!pending) return;
						this.pending.delete(message.id);
						window.clearTimeout(pending.timer);
						if (message.ok) pending.resolve(message.result);
						else pending.reject(Object.assign(new Error(message.message), { code: message.result?.code }));
					} else if (message.type === "error") {
						this.error = message.message;
						this.notify();
					}
				};
				ws.onclose = () => {
					if (this.ws !== ws) return;
					this.ws = null;
					this.connected = false;
					this.baselineReady = false;
					this.calendarCache.clear();
					for (const p of this.pending.values()) {
						window.clearTimeout(p.timer);
						p.reject(/* @__PURE__ */ new Error(p.mutating ? "连接断开，操作结果未确认，请刷新核对。" : "连接已断开，请重试。"));
					}
					this.pending.clear();
					this.notify();
					if (!this.manualClose && generation === this.generation) {
						this.failures += 1;
						this.reconnectTimer = window.setTimeout(() => this.connect(), Math.min(1e4, 800 * 2 ** this.failures));
					}
				};
				ws.onerror = () => {
					if (this.ws === ws) ws.close();
				};
			}
			async refresh(clearWarning = true) {
				const generation = this.generation;
				const snapshot = await this.op("get-snapshot");
				if (generation === this.generation && !this.manualClose) {
					if (clearWarning) this.operationError = null;
					this.acceptSnapshot(snapshot);
				}
			}
			op(op, args = {}, timeoutMs = 15e3) {
				const mutating = mutationOps.has(op);
				if (!this.ws || this.ws.readyState !== WebSocket.OPEN || mutating && !this.baselineReady) return Promise.reject(/* @__PURE__ */ new Error("日程服务尚未连接，操作未发送。"));
				const id = "op_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
				return new Promise((resolve, reject) => {
					const timer = window.setTimeout(() => {
						if (this.pending.delete(id)) reject(/* @__PURE__ */ new Error(mutating ? "操作超时，结果未确认，请刷新核对。" : "查询超时，请重试。"));
					}, timeoutMs);
					this.pending.set(id, {
						resolve: (value) => resolve(value),
						reject,
						timer,
						mutating
					});
					try {
						this.ws.send(JSON.stringify({
							type: "op",
							id,
							op,
							args
						}));
					} catch {
						window.clearTimeout(timer);
						this.pending.delete(id);
						reject(/* @__PURE__ */ new Error(mutating ? "发送失败，结果未确认，请刷新核对。" : "发送失败，请重试。"));
					}
				}).catch((error) => {
					if (mutating) this.operationError = error.message;
					this.error = error.message;
					this.notify();
					throw error;
				});
			}
			async updateSettings(patch, expectedRevision) {
				const snapshot = await this.op("update-settings", {
					patch,
					expectedRevision
				});
				this.acceptSnapshot(snapshot);
				return snapshot;
			}
			createEvent(input) {
				return this.op("create-event", { input });
			}
			updateEvent(id, patch) {
				return this.op("update-event", {
					id,
					patch
				});
			}
			deleteEvent(id) {
				return this.op("delete-event", { id });
			}
			createTodo(input) {
				return this.op("create-todo", { input });
			}
			updateTodo(id, patch) {
				return this.op("update-todo", {
					id,
					patch
				});
			}
			deleteTodo(id) {
				return this.op("delete-todo", { id });
			}
			/** 待办实例列表（重复待办按日期展开；range/status 可选）。 */
			listTodoInstances(range, status) {
				return this.op("todo-instances", {
					...range !== void 0 ? {
						from: range.from,
						to: range.to
					} : {},
					...status !== void 0 ? { status } : {}
				});
			}
			/** 完成重复待办的指定日期实例（date 缺省 = 完成下一次）。 */
			completeTodoInstance(id, date) {
				return this.updateTodo(id, {
					status: "completed",
					statusDate: date
				});
			}
			createCategory(path) {
				return this.op("create-category", { path });
			}
			deleteCategory(path) {
				return this.op("delete-category", { path });
			}
			/** 某月的 DayInfo（带缓存）。 */
			async monthInfo(year, month) {
				const key = `${year}-${String(month).padStart(2, "0")}`;
				const cached = this.calendarCache.get(key);
				if (cached !== void 0) return cached;
				const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
				const from = `${year}-${String(month).padStart(2, "0")}-01`;
				const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
				const generation = this.generation, version = this.snapshot?.dataVersion;
				const days = await this.op("calendar-info", {
					from,
					to
				});
				if (generation === this.generation && version === this.snapshot?.dataVersion) this.calendarCache.set(key, days);
				return days;
			}
			/** 指定日期区间的 DayInfo（尽量用缓存拼接）。 */
			async rangeInfo(from, to) {
				const byDate = /* @__PURE__ */ new Map();
				let cursor = from;
				let guard = 0;
				while (cursor <= to && guard < 61) {
					const year = Number(cursor.slice(0, 4));
					const month = Number(cursor.slice(5, 7));
					const monthDays = await this.monthInfo(year, month);
					for (const day of monthDays) byDate.set(day.date, day);
					cursor = this.shiftMonth(cursor);
					guard += 1;
				}
				const result = [];
				let current = from;
				while (current <= to) {
					const info = byDate.get(current);
					if (info === void 0) break;
					result.push(info);
					current = this.shiftDay(current);
				}
				if (result.length > 0) return result;
				return this.op("calendar-info", {
					from,
					to
				});
			}
			shiftDay(date) {
				const d = /* @__PURE__ */ new Date(`${date}T00:00:00Z`);
				d.setUTCDate(d.getUTCDate() + 1);
				return d.toISOString().slice(0, 10);
			}
			shiftMonth(date) {
				const y = Number(date.slice(0, 4));
				const m = Number(date.slice(5, 7));
				const next = m === 12 ? 1 : m + 1;
				return `${m === 12 ? y + 1 : y}-${String(next).padStart(2, "0")}-01`;
			}
			dispose() {
				this.manualClose = true;
				this.generation += 1;
				window.clearTimeout(this.reconnectTimer);
				const socket = this.ws;
				this.ws = null;
				socket?.close();
				for (const p of this.pending.values()) {
					window.clearTimeout(p.timer);
					p.reject(/* @__PURE__ */ new Error(p.mutating ? "日程插件已卸载，操作结果未确认。" : "日程插件已卸载。"));
				}
				this.pending.clear();
				this.connected = false;
				this.notify();
				this.listeners.clear();
				this.uiState.clear();
				this.calendarCache.clear();
			}
		};
		let sharedClient = null;
		function getAgendaClient() {
			if (!sharedClient) try {
				sharedClient = new AgendaClient(agendaSocketUrl(window.location, globalThis.__DSH_TRANSPORT__));
			} catch (error) {
				sharedClient = new AgendaClient(null, error.message);
			}
			return sharedClient;
		}
		function disposeAgendaClient() {
			sharedClient?.dispose();
			sharedClient = null;
		}
		//#endregion
		//#region src/client/settings-card.tsx
		function SettingsContent() {
			const { client, snapshot, connected } = useAgenda();
			const [draft, setDraft] = usePersistentState("settings.draft", {
				weekStart: snapshot?.settings.weekStart ?? "monday",
				revision: snapshot?.settingsRevision ?? "",
				dirty: false
			});
			const [saving, setSaving] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			(0, react.useEffect)(() => {
				if (snapshot && !draft.dirty) setDraft({
					weekStart: snapshot.settings.weekStart,
					revision: snapshot.settingsRevision,
					dirty: false
				});
			}, [snapshot?.settingsRevision]);
			const save = async () => {
				setSaving(true);
				setError("");
				try {
					const result = await client.updateSettings({ weekStart: draft.weekStart }, draft.revision);
					setDraft({
						weekStart: result.settings.weekStart,
						revision: result.settingsRevision,
						dirty: false
					});
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setSaving(false);
				}
			};
			const reload = async () => {
				if (draft.dirty && !window.confirm("放弃未保存的周起始日修改并读取最新设置吗？")) return;
				try {
					await client.refresh();
					const latest = client.snapshot;
					setDraft({
						weekStart: latest.settings.weekStart,
						revision: latest.settingsRevision,
						dirty: false
					});
					setError("");
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			};
			const data = snapshot?.holidayData;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "da-root da-settings",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: "Irving · 日程与待办" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "周起始日默认为周一，保存后立即更新月历和周历。" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SegmentedTabs, {
						label: "周起始日",
						items: [{
							value: "monday",
							label: "周一"
						}, {
							value: "sunday",
							label: "周日"
						}],
						value: draft.weekStart,
						onChange: (value) => {
							if (!saving) setDraft({
								...draft,
								weekStart: value,
								dirty: true
							});
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "da-row",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							disabled: !connected || saving || !draft.dirty,
							onClick: () => void save(),
							children: saving ? "保存中…" : "保存设置"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
							disabled: !connected || saving,
							onClick: () => void reload(),
							children: "重新读取"
						})]
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						children: error
					}),
					!connected && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "日程服务尚未连接，草稿已保留。" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "节假日资料" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: ["离线节假日库：chinese-days ", data?.packageVersion ?? "载入中"] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: ["已收录年份：", data?.supportedYears.join("、") || "暂无"] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: ["本地覆盖年份：", data?.localOverrideYears.join("、") || "无"] }),
					!!data?.legacyFullYears.length && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: ["整年本地资料优先：", data.legacyFullYears.join("、")] }),
					data?.warnings.map((warning) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						children: warning
					}, warning)),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "da-dim",
						children: "年度资料随插件更新。未收录年份不预测调休；手工修改的年度资料继续保留。"
					})
				]
			});
		}
		function AgendaSettingsCard({ client, view }) {
			if (view === "summary") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "周起始日与离线节假日资料" });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AgendaProvider, {
				client,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingsContent, {})
			});
		}
		//#endregion
		//#region src/client/style.ts
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
.da-nav{flex:1;min-width:0;}
.da-main{flex:1;min-height:0;overflow:auto;padding:16px;}
.da-card{background:var(--da-card);border:1px solid var(--da-border);border-radius:10px;padding:14px;}
.da-btn{border:1px solid var(--da-border);background:var(--da-card);color:var(--da-text);padding:4px 12px;border-radius:6px;cursor:pointer;font-size:13px;}
.da-btn:hover{background:var(--da-hover);}
.da-btn.da-primary{background:var(--da-accent);border-color:var(--da-accent);color:var(--dsw-alias-label-primary-inverted,#fff);}
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
.da-day.da-today-cell .da-day-num{width:24px;height:24px;border-radius:50%;background:var(--da-accent);color:var(--dsw-alias-label-primary-inverted,#fff);display:inline-flex;align-items:center;justify-content:center;font-weight:600;}
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
.da-hour{position:absolute;left:0;right:0;border-top:1px solid var(--da-border);font-size:10px;color:var(--da-text-dim);padding-left:2px;transform:translateY(-50%);cursor:pointer;}
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

.da-settings{height:auto;padding:16px;overflow-wrap:anywhere;}
.da-settings h2{margin-top:0;}
.da-settings .da-row{margin-top:12px;}
.da-grow,.da-day,.da-week .da-whead>div{min-width:0;}
.da-title,.da-todo-title{overflow-wrap:anywhere;}
.da-grid,.da-grid-head{grid-template-columns:repeat(7,minmax(0,1fr));}
.da-week{overflow:auto;}
.da-whead,.da-wcol{min-width:0;}
.da-modal-card{box-sizing:border-box;max-width:calc(100vw - 24px);}
.da-root :focus-visible{outline:2px solid var(--da-accent);outline-offset:2px;}
@media(max-width:800px){.da-header,.da-date-head,.da-row{flex-wrap:wrap;}.da-nav{order:3;flex-basis:100%;box-sizing:border-box;}.da-main{padding:12px;}.da-day{padding:4px;min-height:90px;}.da-day-top{flex-wrap:wrap;}.da-week{min-width:540px;}.da-main:has(.da-week){overflow-x:auto;}}
@media(max-width:500px){.da-day-lunar{font-size:10px;}.da-ev{font-size:10px;}.da-header h1{font-size:18px;}.da-cat-row .da-cat-name{min-width:0;}.da-inline{flex-wrap:wrap;}.da-modal-card{padding:14px;}.da-grid-head{font-size:11px;}}
`;
		let injected = false;
		/** 注入一次样式；幂等。 */
		function injectStyle() {
			if (injected) return;
			const style = document.createElement("style");
			style.setAttribute("data-dsh-agenda-style", "");
			style.textContent = CSS;
			document.head.appendChild(style);
			injected = true;
		}
		/** 测试/卸载用（可逆）。 */
		function removeStyle() {
			document.head.querySelectorAll("[data-dsh-agenda-style]").forEach((node) => node.remove());
			injected = false;
		}
		//#endregion
		//#region src/client/index.tsx
		/** client 侧需要的服务。 */
		const inject = ["slots"];
		/** 侧栏图标（Calendar 线框）。 */
		function AgendaGlyph({ size = 18, active }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: active ? "var(--dsw-alias-brand-primary, #2f6fed)" : "currentColor",
				strokeWidth: 1.7,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-label": "日程",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "3",
						y: "4.5",
						width: "18",
						height: "17",
						rx: "2.5"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 9.5h18" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 2.5v4M16 2.5v4" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M7.5 13.5h3M13.5 13.5h3M7.5 17h3M13.5 17h3" })
				]
			});
		}
		/** client 入口。 */
		function apply(ctx) {
			injectStyle();
			const client = getAgendaClient();
			ctx.slots.inject("main", () => ctx.slots.register({
				name: "main",
				key: "agenda",
				order: 50
			}, () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AgendaApp, { client })));
			ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
				name: "plugins.bundle.config",
				key: "dsh-agenda",
				label: () => "日程设置"
			}, (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AgendaSettingsCard, {
				client,
				view: props.view
			})));
			ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
				name: "sidebar.panellist",
				id: "agenda",
				order: 60,
				label: () => "日程"
			}, (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AgendaGlyph, {
				size: props.size,
				active: props.active
			})));
			ctx.effect(() => () => {
				disposeAgendaClient();
				removeStyle();
			}, "dsh-agenda: client dispose");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
