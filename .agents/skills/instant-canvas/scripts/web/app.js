/* InstantCanvas app shell — ported from prototype/index.html (the locked UI contract).
 * Talks to the per-workspace kernel; token kept in memory only. */
(() => {
'use strict'

// ---------------------------------------------------------------- kernel client

const TOKEN = new URLSearchParams(location.search).get('token') || ''

async function api(path, opts = {}) {
	const res = await fetch(path, {
		...opts,
		headers: {
			'X-IC-Token': TOKEN,
			...(opts.body ? { 'Content-Type': 'application/json' } : {}),
			...(opts.headers || {}),
		},
	})
	let json = null
	try { json = await res.json() } catch { /* non-JSON */ }
	return { status: res.status, json }
}

// ---------------------------------------------------------------- state + utils

const $ = (id) => document.getElementById(id)
const state = {
	tree: null,
	activeId: null,
	activePage: 0,
	collapsed: new Set(),
	charts: [], // live ECharts instances of the current view
	observers: [],
	canvasDoc: null,
	session: null, // {id, expiresAt} for the active interactive canvas
	wsAlive: false,
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

function fmtValue(v, format, currency) {
	if (v === null || v === undefined || v === '') return ''
	if (format === 'currency') {
		try {
			return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD', maximumFractionDigits: Number(v) % 1 ? 2 : 0 }).format(Number(v))
		} catch {
			return '$' + Number(v).toLocaleString()
		}
	}
	if (format === 'percent') return (Number(v) * 100).toLocaleString(undefined, { maximumFractionDigits: 1 }) + '%'
	if (format === 'number') return Number(v).toLocaleString()
	return String(v)
}

function toast(msg) {
	const t = document.createElement('div')
	t.className = 'toast'
	t.textContent = msg
	document.body.appendChild(t)
	setTimeout(() => t.remove(), 2600)
}

function deepMerge(target, src) {
	for (const key of Object.keys(src)) {
		const s = src[key], t = target[key]
		if (s && t && typeof s === 'object' && typeof t === 'object' && !Array.isArray(s) && !Array.isArray(t))
			deepMerge(t, s)
		else
			target[key] = s
	}
	return target
}

const md = window.markdownit({ html: false, linkify: true })

// ---------------------------------------------------------------- theming

// ECharts cannot read CSS var() — two concrete themes matching the prototype palette.
const LIGHT = {
	color: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'],
	text: '#1a1d24', muted: '#6b7280', border: '#e6e8ec', panel: '#ffffff',
}
const DARK = {
	color: ['#818cf8', '#34d399', '#fbbf24', '#f472b6', '#22d3ee'],
	text: '#e7e9ee', muted: '#98a0ad', border: '#242a35', panel: '#161922',
}

function echartsTheme(p) {
	return {
		color: p.color,
		backgroundColor: 'transparent',
		textStyle: { color: p.text },
		legend: { textStyle: { color: p.muted }, inactiveColor: p.border, icon: 'roundRect', itemWidth: 12, itemHeight: 8 },
		categoryAxis: {
			axisLine: { lineStyle: { color: p.border } },
			axisTick: { show: false },
			axisLabel: { color: p.muted },
			splitLine: { show: false },
		},
		valueAxis: {
			axisLine: { show: false },
			axisLabel: { color: p.muted },
			splitLine: { lineStyle: { color: p.border } },
		},
		tooltip: {
			backgroundColor: p.panel,
			borderColor: p.border,
			textStyle: { color: p.text },
		},
	}
}
window.echarts.registerTheme('ic-light', echartsTheme(LIGHT))
window.echarts.registerTheme('ic-dark', echartsTheme(DARK))

function currentTheme() {
	const forced = document.documentElement.getAttribute('data-theme')
	if (forced) return forced
	return matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'
}

$('themeBtn').addEventListener('click', () => {
	const next = currentTheme() === 'dark' ? 'light' : 'dark'
	document.documentElement.setAttribute('data-theme', next)
	renderCanvas() // charts dispose + re-init on the other theme
})

// ---------------------------------------------------------------- sidebar

function findCanvas(id) {
	if (!state.tree) return null
	for (const g of state.tree.collections) {
		const hit = g.canvases.find((c) => c.id === id)
		if (hit) return hit
	}
	return null
}

function renderTree() {
	const tree = $('tree')
	if (!state.tree) { tree.innerHTML = '' ; return }
	tree.innerHTML = state.tree.collections.map((g) => {
		const isC = state.collapsed.has(g.name)
		const items = g.canvases.map((c) => `
			<div class="item ${c.id === state.activeId ? 'active' : ''}" data-canvas="${esc(c.id)}">
				<span class="dot"></span>${esc(c.title)}
			</div>`).join('')
		return `<div class="group ${isC ? 'collapsed' : ''}">
			<div class="group-row" data-group="${esc(g.name)}">
				<span class="caret">▾</span>📁 ${esc(g.name)}
			</div>
			<div class="items">${items}</div>
		</div>`
	}).join('') || '<div style="padding:16px;color:var(--muted)">(no canvases yet)</div>'

	$('wsStats').textContent = `${state.tree.count} canvases · ${state.tree.collections.length} groups`
	$('rootpath').textContent = state.tree.root
	$('watchPath').textContent = state.tree.root
}

$('tree').addEventListener('click', (e) => {
	const g = e.target.closest('[data-group]')
	if (g) {
		const name = g.dataset.group
		state.collapsed.has(name) ? state.collapsed.delete(name) : state.collapsed.add(name)
		renderTree()
		return
	}
	const it = e.target.closest('[data-canvas]')
	if (it) location.hash = '#/c/' + encodeURIComponent(it.dataset.canvas)
})

// ---------------------------------------------------------------- display block renderers

function renderMarkdown(block) {
	return `<div class="block md">${md.render(block.text || '')}</div>`
}

function renderKpi(block) {
	const cards = (block.cards || []).map((c) => {
		let deltaHtml = ''
		const d = c.delta
		if (d && typeof d.value === 'number') {
			const flat = Math.abs(d.value) < 1e-4
			const sign = d.value > 0 ? '▲' : d.value < 0 ? '▼' : '–'
			const positiveIs = d.positiveIs || 'up'
			const good = (d.value > 0 && positiveIs === 'up') || (d.value < 0 && positiveIs === 'down')
			const cls = flat ? 'flat' : good ? 'up' : 'down'
			const pct = Math.abs(d.value * 100)
			const pctText = pct.toLocaleString(undefined, { maximumFractionDigits: 1 })
			deltaHtml = `<div class="delta ${cls}">${flat ? '–' : sign} ${pctText}% ${esc(d.label || '')}</div>`
		}
		return `<div class="kpi">
			<div class="label">${esc(c.label)}</div>
			<div class="value">${esc(fmtValue(c.value, c.format || 'number', c.currency))}</div>
			${deltaHtml}
		</div>`
	}).join('')
	return `<div class="block kpis">${cards}</div>`
}

function renderTable(block) {
	const numeric = (col) => ['number', 'currency', 'percent'].includes(col.format)
	const alignClass = (col) => (col.align ? (col.align === 'right' ? 'num' : '') : numeric(col) ? 'num' : '')
	const head = (block.columns || []).map((c) => `<th class="${alignClass(c)}">${esc(c.label)}</th>`).join('')
	const body = (block.rows || []).map((r) => `<tr>${block.columns.map((c) => {
		const v = r[c.key]
		const shown = numeric(c) ? fmtValue(v, c.format, c.currency) : (v === undefined || v === null ? '' : String(v))
		return `<td class="${alignClass(c)}">${esc(shown)}</td>`
	}).join('')}</tr>`).join('')
	const title = block.title ? `<div class="chart-title" style="margin-bottom:8px">${esc(block.title)}</div>` : ''
	return `<div class="block card">${title}<table class="tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`
}

function chartOption(block) {
	const fmt = block.format || {}
	const yFmt = (v) => fmtValue(v, fmt.y || 'number', fmt.currency)
	let option
	if (block.kind === 'pie') {
		const data = (block.data || []).map((r) => ({ name: r[block.encoding.category], value: r[block.encoding.value] }))
		option = {
			tooltip: { trigger: 'item', formatter: (p) => `${esc(p.name)}: ${yFmt(p.value)} (${p.percent}%)` },
			legend: { bottom: 0, type: 'scroll' },
			series: [{
				type: 'pie',
				radius: block.donut ? ['45%', '70%'] : '70%',
				center: ['50%', '46%'],
				data,
				label: { show: false },
				emphasis: { label: { show: true, formatter: '{b}' } },
				itemStyle: { borderRadius: 4, borderWidth: 2, borderColor: 'transparent' },
			}],
		}
	} else {
		const ys = Array.isArray(block.encoding.y) ? block.encoding.y : [block.encoding.y]
		const categories = (block.data || []).map((r) => r[block.encoding.x])
		const multi = ys.length > 1
		option = {
			tooltip: { trigger: 'axis', valueFormatter: yFmt },
			legend: multi ? { bottom: 0, type: 'scroll' } : { show: false },
			grid: { left: 8, right: 16, top: 18, bottom: multi ? 42 : 16, containLabel: true },
			xAxis: { type: 'category', data: categories, boundaryGap: block.kind === 'bar' },
			yAxis: { type: 'value', axisLabel: { formatter: yFmt } },
			series: ys.map((key) => ({
				name: key,
				type: block.kind,
				data: (block.data || []).map((r) => r[key]),
				...(block.kind === 'line' ? { symbolSize: 7, lineStyle: { width: 2.5 } } : { barMaxWidth: 46, itemStyle: { borderRadius: [3, 3, 0, 0] } }),
			})),
		}
	}
	if (block.options && typeof block.options === 'object')
		deepMerge(option, block.options) // escape hatch merges LAST
	return option
}

function renderChartShell(block, idx) {
	const title = block.title ? `<div class="chart-title">${esc(block.title)}</div>` : ''
	const desc = block.description ? `<div class="chart-desc">${esc(block.description)}</div>` : ''
	return `<div class="block card">${title}${desc}<div class="chart-box" data-chart="${idx}"></div></div>`
}

function mountCharts(blocks) {
	const theme = currentTheme() === 'dark' ? 'ic-dark' : 'ic-light'
	document.querySelectorAll('[data-chart]').forEach((box) => {
		const block = blocks[Number(box.dataset.chart)]
		const chart = window.echarts.init(box, theme)
		chart.setOption(chartOption(block))
		state.charts.push(chart)
		const ro = new ResizeObserver(() => chart.resize())
		ro.observe(box)
		state.observers.push(ro)
	})
}

function disposeCharts() {
	state.charts.forEach((c) => c.dispose())
	state.observers.forEach((o) => o.disconnect())
	state.charts = []
	state.observers = []
}

// ---------------------------------------------------------------- canvas view

function renderErrors(id, errors) {
	const lines = (errors || []).map((e) => `<div class="errline">
		<span class="code">${esc(e.code)}</span> <span class="path">${esc(e.path || '(top level)')}</span><br>
		${esc(e.message)}${e.hint ? ` <span class="hint">${esc(e.hint)}</span>` : ''}
	</div>`).join('')
	return `<div class="errcard">
		<div class="errhead">✗ ${esc(id)} failed validation</div>
		<div class="errbody">${lines}</div>
	</div>`
}

function renderEmpty() {
	const root = state.tree ? state.tree.root : ''
	return `<div class="empty"><div class="big"></div><b>No canvas selected</b>
		<div>Pick a canvas from the sidebar, or drop a <code>.json</code> file into this folder — it appears automatically.</div>
		<div style="margin-top:6px">Watching <code>${esc(root)}</code></div></div>`
}

async function renderCanvas() {
	disposeCharts()
	const main = $('main')
	if (!state.activeId) {
		main.innerHTML = renderEmpty()
		return
	}
	const { status, json } = await api('/api/canvas?path=' + encodeURIComponent(state.activeId))
	if (status !== 200 || !json || !json.ok) {
		const errors = json && json.errors
		main.innerHTML = `<div class="canvas">
			<div class="canvas-head"><h1>${esc(state.activeId)}</h1><div class="sub">${esc(state.activeId)}</div></div>
			${errors ? renderErrors(state.activeId, errors) : `<div class="placeholder">Could not load this canvas (HTTP ${status}).</div>`}
		</div>`
		return
	}
	const canvas = json.canvas
	state.canvasDoc = canvas
	state.session = json.session || null

	const pages = Array.isArray(canvas.pages) ? canvas.pages : [{ name: '', blocks: canvas.blocks || [] }]
	if (state.activePage >= pages.length) state.activePage = 0
	const page = pages[state.activePage]
	const blocks = page.blocks || []

	const tabs = pages.length > 1 ? `<div class="tabs">${pages.map((p, i) =>
		`<button class="tab ${i === state.activePage ? 'active' : ''}" data-page="${i}">${esc(p.name)}</button>`).join('')}</div>` : ''

	const inner = blocks.map((b, i) => {
		if (!b || typeof b !== 'object') return ''
		if (b.type === 'markdown') return renderMarkdown(b)
		if (b.type === 'kpi') return renderKpi(b)
		if (b.type === 'table') return renderTable(b)
		if (b.type === 'chart') return renderChartShell(b, i)
		if (b.type === 'form') return window.icRenderForm ? window.icRenderForm(b) : interactivePlaceholder('form')
		if (b.type === 'confirm') return window.icRenderConfirm ? window.icRenderConfirm(b) : interactivePlaceholder('confirm')
		return ''
	}).join('')

	main.innerHTML = `<div class="canvas">
		<div class="canvas-head"><h1>${esc(canvas.title)}</h1><div class="sub">${esc(state.activeId)}</div></div>
		${tabs}${inner}
	</div>`
	mountCharts(blocks)
	if (window.icAfterCanvasRender)
		window.icAfterCanvasRender(blocks)
}

function interactivePlaceholder(kind) {
	return `<div class="block placeholder">Interactive ${esc(kind)} block — renderer lands in the next phase.</div>`
}

$('main').addEventListener('click', (e) => {
	const tab = e.target.closest('[data-page]')
	if (tab) {
		state.activePage = Number(tab.dataset.page)
		renderCanvas()
	}
})

// ---------------------------------------------------------------- routing

function route() {
	const m = /^#\/c\/(.+)$/.exec(location.hash)
	const id = m ? decodeURIComponent(m[1]) : null
	if (id !== state.activeId) {
		state.activeId = id
		state.activePage = 0
	}
	renderTree()
	renderCanvas()
}
window.addEventListener('hashchange', route)

// ---------------------------------------------------------------- hot reload (WebSocket)

let wsBackoff = 500
function connectWs() {
	const ws = new WebSocket(`ws://${location.host}/ws?token=${encodeURIComponent(TOKEN)}`)
	ws.onopen = () => {
		wsBackoff = 500
		state.wsAlive = true
		$('pulse').classList.remove('off')
		$('watchState').textContent = 'watching'
	}
	ws.onmessage = async (ev) => {
		let msg
		try { msg = JSON.parse(ev.data) } catch { return }
		if (msg.type === 'workspace') {
			const { json } = await api('/api/workspace')
			if (json && json.ok) {
				state.tree = json
				renderTree()
			}
		} else if (msg.type === 'canvas') {
			if (msg.path === state.activeId)
				renderCanvas() // full re-render; state loss accepted in MVP
		} else if (msg.type === 'navigate') {
			location.hash = '#/c/' + encodeURIComponent(msg.path)
			if (msg.path === state.activeId)
				renderCanvas() // re-open of the already-active canvas (fresh session)
		} else if (msg.type === 'session') {
			if (window.icOnSession)
				window.icOnSession(msg)
		}
	}
	ws.onclose = () => {
		state.wsAlive = false
		$('pulse').classList.add('off')
		$('watchState').textContent = 'reconnecting'
		setTimeout(connectWs, wsBackoff)
		wsBackoff = Math.min(wsBackoff * 2, 10000)
	}
	ws.onerror = () => ws.close()
}

// ---------------------------------------------------------------- folder browser

$('openFolder').addEventListener('click', () => openFolderModal())

async function openFolderModal() {
	const ov = document.createElement('div')
	ov.className = 'overlay'
	ov.innerHTML = `<div class="modal">
		<div class="modal-head">📂 Open workspace folder</div>
		<div class="modal-body">
			<div class="fb-crumb" id="fbCrumb"></div>
			<div class="fb-list" id="fbList"></div>
			<div style="color:var(--muted);font-size:12px">Folders that already contain canvases show a ✓ badge.</div>
		</div>
		<div class="modal-foot">
			<button class="btn ghost" data-close>Cancel</button>
			<button class="btn primary" id="fbOpen" disabled>Open →</button>
		</div>
	</div>`
	ov.addEventListener('click', (ev) => {
		if (ev.target === ov || ev.target.closest('[data-close]'))
			ov.remove()
	})
	document.body.appendChild(ov)

	let dir = state.tree ? state.tree.root : ''
	let parent = null
	let selected = null

	const openBtn = ov.querySelector('#fbOpen')
	openBtn.addEventListener('click', async () => {
		if (!selected) return
		openBtn.disabled = true
		openBtn.textContent = 'Opening…'
		const { json } = await api('/api/workspace/open', { method: 'POST', body: JSON.stringify({ path: selected }) })
		if (json && json.ok && json.url)
			window.location = json.url
		else {
			toast('Could not open that folder' + (json && json.error ? `: ${json.error.code}` : '.'))
			openBtn.disabled = false
			openBtn.textContent = 'Open →'
		}
	})

	async function draw() {
		const { json } = await api('/api/browse', { method: 'POST', body: JSON.stringify({ dir }) })
		if (!json || !json.ok) { toast('Cannot list that directory.'); return }
		dir = json.dir
		parent = json.parent
		ov.querySelector('#fbCrumb').textContent = '📁 ' + dir
		const up = parent ? '<div class="fb-row" data-up>⬑ ..</div>' : ''
		ov.querySelector('#fbList').innerHTML = up + json.entries.map((en) => `
			<div class="fb-row ${selected === en.path ? 'sel' : ''}" data-path="${esc(en.path)}" data-count="${en.canvasCount}">
				📁 ${esc(en.name)} ${en.canvasCount > 0 ? `<span class="fb-badge">✓ workspace (${en.canvasCount} canvases)</span>` : ''}
			</div>`).join('') || (up + '<div class="fb-row" style="cursor:default;color:var(--muted)">(no subfolders)</div>')
		ov.querySelectorAll('.fb-row[data-path]').forEach((row) => {
			row.addEventListener('click', () => {
				selected = row.dataset.path
				openBtn.disabled = false
				draw()
			})
			row.addEventListener('dblclick', () => {
				dir = row.dataset.path
				selected = null
				openBtn.disabled = true
				draw()
			})
		})
		const upRow = ov.querySelector('[data-up]')
		if (upRow)
			upRow.addEventListener('click', () => {
				dir = parent
				selected = null
				openBtn.disabled = true
				draw()
			})
	}
	draw()
}

// ---------------------------------------------------------------- stop kernel

$('stopBtn').addEventListener('click', async () => {
	if (!window.confirm('Stop the InstantCanvas kernel for this workspace?'))
		return
	await api('/api/shutdown', { method: 'POST', body: '{}' })
	document.body.innerHTML = '<div class="empty" style="height:100vh"><div class="big"></div><b>Kernel stopped</b><div>Run <code>instantcanvas open</code> again to restart it.</div></div>'
})

// ---------------------------------------------------------------- boot

async function boot() {
	const { status, json } = await api('/api/workspace')
	if (status !== 200 || !json || !json.ok) {
		$('main').innerHTML = '<div class="empty" style="height:100%"><b>Cannot reach the kernel</b><div>Missing or invalid token?</div></div>'
		return
	}
	state.tree = json
	connectWs()
	if (!location.hash) {
		const first = json.collections.find((g) => g.canvases.length)
		if (first)
			location.hash = '#/c/' + encodeURIComponent(first.canvases[0].id)
	}
	route()
}
boot()

// Exposed for the forms layer (Phase G) and debugging.
window.ic = { api, state, esc, fmtValue, toast, renderCanvas, TOKEN: () => TOKEN }
})()
