import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { API_BASE_URL, submitOrchestratorQuery } from "./lib/api";
import { QUICK_HINTS, QUERY_PRESETS } from "./lib/presets";
import {
	formatDateTime,
	formatNumber,
	formatPercent,
	readableMetricLabel,
	truncateText,
} from "./lib/format";
import type { ChartPoint, HistoryEntry, OrchestratorResponse } from "./lib/types";

const HISTORY_STORAGE_KEY = "ksp-dashboard-history";

function safeUUID(): string {
	return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadHistory(): HistoryEntry[] {
	if (typeof window === "undefined") {
		return [];
	}

	try {
		const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
		if (!raw) {
			return [];
		}

		const parsed = JSON.parse(raw) as HistoryEntry[];
		return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
	} catch {
		return [];
	}
}

function persistHistory(entries: HistoryEntry[]): void {
	if (typeof window === "undefined") {
		return;
	}

	try {
		window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(0, 6)));
	} catch {
		// Ignore restricted storage environments.
	}
}

async function readFileAsBase64(file: File): Promise<{ base64: string; mimeType: string }> {
	const result = await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result ?? ""));
		reader.onerror = () => reject(new Error("Unable to read the selected audio file."));
		reader.readAsDataURL(file);
	});

	const commaIndex = result.indexOf(",");
	return {
		base64: commaIndex >= 0 ? result.slice(commaIndex + 1) : result,
		mimeType: file.type || "audio/wav",
	};
}

function App() {
	const [query, setQuery] = useState(QUERY_PRESETS[0].query);
	const [selectedPreset, setSelectedPreset] = useState(QUERY_PRESETS[0].title);
	const [audioFile, setAudioFile] = useState<File | null>(null);
	const [audioName, setAudioName] = useState<string>("");
	const [response, setResponse] = useState<OrchestratorResponse | null>(null);
	const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		persistHistory(history);
	}, [history]);

	async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		setLoading(true);
		setError(null);

		try {
			let audioPayload: { base64: string; mimeType: string } | undefined;
			if (audioFile) {
				audioPayload = await readFileAsBase64(audioFile);
			}

			const payload = {
				text: query.trim() || undefined,
				audio_base64: audioPayload?.base64,
				audio_mime_type: audioPayload?.mimeType,
				user_id: "frontend-user",
				role: "investigator",
			};

			const result = await submitOrchestratorQuery(payload);
			setResponse(result);
			setHistory((current) => [
				{
					id: safeUUID(),
					query: result.query_text || query || audioName || "Audio query",
					answer: result.answer,
					chart_type: result.chart_type,
					cached: result.cached,
					timestamp: new Date().toISOString(),
				},
				...current,
			]);
		} catch (submitError) {
			setError(submitError instanceof Error ? submitError.message : "Unable to reach the backend.");
		} finally {
			setLoading(false);
		}
	}

	function handlePreset(presetTitle: string): void {
		const preset = QUERY_PRESETS.find((entry) => entry.title === presetTitle);
		if (!preset) {
			return;
		}

		setSelectedPreset(preset.title);
		setQuery(preset.query);
	}

	function handleAudioChange(event: ChangeEvent<HTMLInputElement>): void {
		const file = event.target.files?.[0] ?? null;
		setAudioFile(file);
		setAudioName(file?.name ?? "");
	}

	function clearAudio(): void {
		setAudioFile(null);
		setAudioName("");
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	}

	const chart = response ? renderVisualization(response) : null;

	return (
		<div className="app-shell">
			<header className="hero">
				<section className="card hero-copy panel-enter">
					<div className="eyebrow-row">
						<span className="eyebrow">KSP Intelligence Console</span>
						<span className="status-pill">Backend target: {truncateText(API_BASE_URL, 24)}</span>
					</div>
					<h1>Ask in plain language. Get evidence-backed crime intelligence.</h1>
					<p className="hero-text">
						This interface talks directly to the Catalyst orchestrator, which routes each question
						into the right analytical function and returns a structured response with text,
						visualizations, and follow-up suggestions.
					</p>

					<div className="hero-metrics">
						<div>
							<strong>7</strong>
							<span>specialized tools wired in</span>
						</div>
						<div>
							<strong>1</strong>
							<span>query endpoint used by the UI</span>
						</div>
						<div>
							<strong>3</strong>
							<span>query modes: text, audio, mixed</span>
						</div>
					</div>
				</section>

				<aside className="card hero-side panel-enter delay-1">
					<h2>Quick Start</h2>
					<ul className="step-list">
						<li>Type a natural-language query or attach an audio file.</li>
						<li>Use one of the presets to jump into FIR search, trends, or hotspots.</li>
						<li>Review the answer, chart, and follow-up suggestions produced by the orchestrator.</li>
					</ul>

					<div className="hint-stack">
						{QUICK_HINTS.map((hint) => (
							<div key={hint.title} className="hint-card">
								<span>{hint.title}</span>
								<p>{hint.detail}</p>
							</div>
						))}
					</div>
				</aside>
			</header>

			<section className="workspace-grid">
				<form className="card composer panel-enter delay-2" onSubmit={handleSubmit}>
					<div className="card-heading">
						<div>
							<span className="section-label">Query Composer</span>
							<h2>Compose a text or voice request</h2>
						</div>
						<span className="badge">POST /api/query</span>
					</div>

					<label className="input-group">
						<span>Investigation prompt</span>
						<textarea
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Example: Show the top crime hotspots in Bengaluru Urban over the last 90 days."
							rows={7}
							spellCheck={false}
						/>
					</label>

					<div className="composer-footer">
						<label className="audio-upload">
							<input ref={fileInputRef} type="file" accept="audio/*" onChange={handleAudioChange} />
							<span>Attach audio evidence</span>
							<small>{audioName || "Optional WAV, MP3, or M4A file"}</small>
						</label>

						<div className="composer-actions">
							<button type="button" className="secondary-btn" onClick={clearAudio} disabled={loading && !audioFile}>
								Clear audio
							</button>
							<button type="submit" className="primary-btn" disabled={loading || (!query.trim() && !audioFile)}>
								{loading ? "Analyzing..." : "Run query"}
							</button>
						</div>
					</div>

					<div className="preset-grid" role="list" aria-label="Sample queries">
						{QUERY_PRESETS.map((preset) => (
							<button
								key={preset.title}
								type="button"
								className={`preset-card ${selectedPreset === preset.title ? "active" : ""}`}
								onClick={() => handlePreset(preset.title)}
							>
								<span>{preset.tag}</span>
								<strong>{preset.title}</strong>
								<p>{preset.hint}</p>
							</button>
						))}
					</div>
				</form>

				<aside className="card insight panel-enter delay-3">
					<div className="card-heading compact">
						<div>
							<span className="section-label">Insights</span>
							<h2>Latest response state</h2>
						</div>
						<span className={`badge ${response?.cached ? "badge-soft" : ""}`}>
							{response ? (response.cached ? "cached" : "fresh") : "waiting"}
						</span>
					</div>

					{response ? (
						<>
							<div className="insight-stack">
								<div>
									<span className="muted-label">Question</span>
									<p>{response.query_text}</p>
								</div>
								<div>
									<span className="muted-label">Data range</span>
									<p>{response.data_range || "Range not specified by the backend"}</p>
								</div>
								<div>
									<span className="muted-label">Answer</span>
									<p>{response.answer}</p>
								</div>
							</div>

							{response.follow_up_suggestions.length > 0 ? (
								<div className="follow-up-stack">
									<span className="muted-label">Suggested follow-ups</span>
									<div className="chip-row">
										{response.follow_up_suggestions.map((suggestion) => (
											<span key={suggestion} className="chip">
												{suggestion}
											</span>
										))}
									</div>
								</div>
							) : null}
						</>
					) : (
						<div className="empty-state">
							<p>No query has been sent yet.</p>
							<span>The first response will appear here with its data range and cached status.</span>
						</div>
					)}

					{error ? <div className="error-banner">{error}</div> : null}
				</aside>
			</section>

			<section className="metrics-grid panel-enter delay-4">
				{response?.kpis?.length ? (
					response.kpis.map((kpi) => (
						<article key={kpi.label} className="card metric-card">
							<span className="muted-label">{kpi.label}</span>
							<strong>{kpi.value}</strong>
							{kpi.change ? <small>{kpi.change}</small> : <small>Live from orchestrator response</small>}
						</article>
					))
				) : (
					<>
						{QUERY_PRESETS.slice(0, 4).map((preset) => (
							<article key={preset.title} className="card metric-card muted">
								<span className="muted-label">{preset.tag}</span>
								<strong>{preset.title}</strong>
								<small>{preset.hint}</small>
							</article>
						))}
					</>
				)}
			</section>

			<section className="visual-grid panel-enter delay-5">
				<article className="card viz-card">
					<div className="card-heading compact">
						<div>
							<span className="section-label">Visualization</span>
							<h2>{response ? readableMetricLabel(response.chart_type) : "Awaiting query"}</h2>
						</div>
						<span className="badge">{response ? response.chart_type.toUpperCase() : "NONE"}</span>
					</div>
					{chart ?? <EmptyChartState />}
				</article>

				<article className="card summary-card">
					<div className="card-heading compact">
						<div>
							<span className="section-label">Execution trail</span>
							<h2>Recent queries</h2>
						</div>
						<span className="badge badge-soft">local only</span>
					</div>

					<div className="history-list">
						{history.length > 0 ? (
							history.map((entry) => (
								<article key={entry.id} className="history-item">
									<div className="history-topline">
										<span>{truncateText(entry.query, 52)}</span>
										<small>{formatDateTime(entry.timestamp)}</small>
									</div>
									<p>{truncateText(entry.answer, 118)}</p>
									<div className="history-footer">
										<span className="tag">{entry.chart_type}</span>
										<span className="tag">{entry.cached ? "cached" : "fresh"}</span>
									</div>
								</article>
							))
						) : (
							<div className="empty-state small">
								<p>Nothing stored locally yet.</p>
								<span>Send a query and it will be added here for quick reuse.</span>
							</div>
						)}
					</div>
				</article>
			</section>
		</div>
	);
}

function EmptyChartState() {
	return (
		<div className="empty-chart">
			<div className="empty-radar" />
			<p>Charts, maps, and tables will render here once the orchestrator returns structured data.</p>
		</div>
	);
}

function renderVisualization(response: OrchestratorResponse) {
	const points = response.chart_data ?? [];

	switch (response.chart_type) {
		case "bar":
			return <BarChart points={points} />;
		case "line":
			return <LineChart points={points} />;
		case "pie":
			return <PieChart points={points} />;
		case "map":
			return <MapChart points={response.map_points ?? []} />;
		case "table":
			return <DataTable tableData={response.table_data} />;
		default:
			return <NarrativeAnswer response={response} />;
	}
}

function NarrativeAnswer({ response }: { response: OrchestratorResponse }) {
	return (
		<div className="narrative-answer">
			<p className="answer-copy">{response.answer}</p>
			{response.kpis?.length ? (
				<div className="answer-kpi-row">
					{response.kpis.slice(0, 3).map((kpi) => (
						<div key={kpi.label} className="mini-kpi">
							<span>{kpi.label}</span>
							<strong>{kpi.value}</strong>
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}

function BarChart({ points }: { points: ChartPoint[] }) {
	const max = Math.max(...points.map((point) => point.value), 1);

	return (
		<div className="chart chart-bar">
			{points.map((point) => {
				const height = Math.max(12, (point.value / max) * 100);
				return (
					<div key={point.label} className="bar-column">
						<div className="bar-meta">{formatNumber(point.value)}</div>
						<div className="bar-track">
							<div className="bar-fill" style={{ height: `${height}%` }} />
						</div>
						<span>{point.label}</span>
					</div>
				);
			})}
		</div>
	);
}

function LineChart({ points }: { points: ChartPoint[] }) {
	const width = 900;
	const height = 280;
	const padding = 28;
	const values = points.map((point) => point.value);
	const max = Math.max(...values, 1);
	const min = Math.min(...values, 0);
	const range = Math.max(max - min, 1);

	const plotted = points.map((point, index) => {
		const x = padding + (index * (width - padding * 2)) / Math.max(points.length - 1, 1);
		const y = height - padding - ((point.value - min) / range) * (height - padding * 2);
		return { ...point, x, y };
	});

	const linePath = plotted.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");

	return (
		<div className="chart chart-line">
			<svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend chart">
				<defs>
					<linearGradient id="trendStroke" x1="0%" x2="100%" y1="0%" y2="0%">
						<stop offset="0%" stopColor="#7ae5c3" />
						<stop offset="100%" stopColor="#76a7ff" />
					</linearGradient>
				</defs>
				<path d={`${linePath}`} fill="none" stroke="url(#trendStroke)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
				{plotted.map((point) => (
					<g key={point.label}>
						<circle cx={point.x} cy={point.y} r="6" />
						<text x={point.x} y={height - 8} textAnchor="middle">
							{point.label}
						</text>
					</g>
				))}
			</svg>

			<div className="chart-legend">
				{points.map((point) => (
					<div key={point.label} className="legend-item">
						<span>{point.label}</span>
						<strong>{formatNumber(point.value)}</strong>
					</div>
				))}
			</div>
		</div>
	);
}

function PieChart({ points }: { points: ChartPoint[] }) {
	const total = points.reduce((sum, point) => sum + point.value, 0) || 1;

	const gradientStops: string[] = [];
	let cursor = 0;
	const palette = ["#7ae5c3", "#76a7ff", "#ffc857", "#ff8a80", "#b39ddb", "#a5d6a7"];

	points.forEach((point, index) => {
		const share = (point.value / total) * 100;
		const color = palette[index % palette.length];
		gradientStops.push(`${color} ${cursor}% ${cursor + share}%`);
		cursor += share;
	});

	return (
		<div className="chart chart-pie">
			<div className="pie-surface" style={{ background: `conic-gradient(${gradientStops.join(", ")})` }}>
				<div>
					<strong>{formatPercent(100)}</strong>
					<span>Total</span>
				</div>
			</div>

			<div className="legend-grid">
				{points.map((point, index) => (
					<div key={point.label} className="legend-item">
						<span>
							<i style={{ background: palette[index % palette.length] }} />
							{point.label}
						</span>
						<strong>{formatNumber(point.value)}</strong>
					</div>
				))}
			</div>
		</div>
	);
}

function MapChart({ points }: { points: NonNullable<OrchestratorResponse["map_points"]> }) {
	if (!points.length) {
		return <EmptyChartState />;
	}

	const latitudes = points.map((point) => point.lat);
	const longitudes = points.map((point) => point.lng);
	const minLat = Math.min(...latitudes);
	const maxLat = Math.max(...latitudes);
	const minLng = Math.min(...longitudes);
	const maxLng = Math.max(...longitudes);
	const latRange = Math.max(maxLat - minLat, 0.01);
	const lngRange = Math.max(maxLng - minLng, 0.01);

	return (
		<div className="chart chart-map">
			<div className="map-surface">
				{points.map((point) => {
					const left = ((point.lng - minLng) / lngRange) * 100;
					const top = 100 - ((point.lat - minLat) / latRange) * 100;

					return (
						<div key={`${point.label}-${point.lat}-${point.lng}`} className={`map-pin intensity-${point.intensity}`} style={{ left: `${left}%`, top: `${top}%` }}>
							<span>{point.label}</span>
							<strong>{formatNumber(point.count)}</strong>
						</div>
					);
				})}
			</div>

			<div className="legend-grid map-legend">
				{points.slice(0, 6).map((point) => (
					<div key={point.label} className="legend-item">
						<span>{point.label}</span>
						<strong>{point.district || `${point.lat.toFixed(3)}, ${point.lng.toFixed(3)}`}</strong>
					</div>
				))}
			</div>
		</div>
	);
}

function DataTable({ tableData }: { tableData: OrchestratorResponse["table_data"] }) {
	if (!tableData) {
		return <EmptyChartState />;
	}

	return (
		<div className="chart table-chart">
			<div className="table-wrap">
				<table>
					<thead>
						<tr>
							{tableData.columns.map((column) => (
								<th key={column}>{column}</th>
							))}
						</tr>
					</thead>
					<tbody>
						{tableData.rows.map((row, index) => (
							<tr key={`${index}-${row.join("-")}`}>
								{row.map((value, cellIndex) => (
									<td key={`${index}-${cellIndex}`}>{value ?? "—"}</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

export default App;
