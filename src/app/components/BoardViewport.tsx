import { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface Size {
	readonly width: number;
	readonly height: number;
}

interface View {
	readonly scale: number;
	readonly x: number;
	readonly y: number;
}

const MAX_SCALE = 3;
/** Touch movement below this is a tap, not a pan. */
const PAN_THRESHOLD = 8;

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/** The smallest useful scale: the whole board visible, capped at 1. */
function fitScale(viewport: Size, content: Size): number {
	if (content.width === 0 || content.height === 0) return 1;
	return Math.min(
		1,
		viewport.width / content.width,
		viewport.height / content.height,
	);
}

/**
 * Keeps the board reachable: no panning past an edge, and an axis that
 * fits entirely stays centered.
 */
function clampView(view: View, viewport: Size, content: Size): View {
	const width = content.width * view.scale;
	const height = content.height * view.scale;
	return {
		scale: view.scale,
		x:
			width <= viewport.width
				? (viewport.width - width) / 2
				: clamp(view.x, viewport.width - width, 0),
		y:
			height <= viewport.height
				? (viewport.height - height) / 2
				: clamp(view.y, viewport.height - height, 0),
	};
}

/**
 * A pannable, zoomable window onto the board. The board renders at its
 * natural size and is moved with a transform, so panning reaches every
 * edge no matter how narrow the window (flex centering used to clip the
 * left side of wide boards). Gestures: pinch or ctrl+wheel to zoom,
 * wheel / touch-drag / middle-drag to pan; taps and clicks fall through
 * to the cells. The floating controls are position:fixed — always on
 * screen and unaffected by board zoom.
 */
export default function BoardViewport({
	showControls,
	extraControls,
	children,
}: {
	showControls: boolean;
	/** Extra floating buttons (e.g. the reveal/flag mode toggle). */
	extraControls?: React.ReactNode;
	children: React.ReactNode;
}) {
	const viewportRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLDivElement>(null);

	const [content, setContent] = useState<Size>({ width: 0, height: 0 });
	const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
	const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });

	// Refs mirror layout state for native/gesture handlers.
	const sizes = useRef({ viewport, content });
	sizes.current = { viewport, content };

	const applyView = (update: (view: View) => View) =>
		setView((current) =>
			clampView(
				update(current),
				sizes.current.viewport,
				sizes.current.content,
			),
		);

	/** Rescale around a point given in viewport coordinates. */
	const zoomAt = (point: { x: number; y: number }, factor: number) =>
		applyView((current) => {
			const scale = clamp(
				current.scale * factor,
				fitScale(sizes.current.viewport, sizes.current.content),
				MAX_SCALE,
			);
			const k = scale / current.scale;
			return {
				scale,
				x: point.x - (point.x - current.x) * k,
				y: point.y - (point.y - current.y) * k,
			};
		});

	const zoomBy = (factor: number) =>
		zoomAt(
			{
				x: sizes.current.viewport.width / 2,
				y: sizes.current.viewport.height / 2,
			},
			factor,
		);

	const fit = () =>
		applyView((current) => ({
			...current,
			scale: fitScale(sizes.current.viewport, sizes.current.content),
		}));

	// Track the natural board size and the viewport's clamped box.
	useLayoutEffect(() => {
		const equal = (a: Size, b: Size) =>
			a.width === b.width && a.height === b.height;
		const measure = () => {
			const canvas = canvasRef.current;
			const port = viewportRef.current;
			if (!canvas || !port) return;
			const nextContent = {
				width: canvas.offsetWidth,
				height: canvas.offsetHeight,
			};
			const nextViewport = {
				width: port.clientWidth,
				height: port.clientHeight,
			};
			setContent((c) => (equal(c, nextContent) ? c : nextContent));
			setViewport((v) => (equal(v, nextViewport) ? v : nextViewport));
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(canvasRef.current!);
		observer.observe(viewportRef.current!);
		return () => observer.disconnect();
	}, []);

	// A new board size (difficulty change) starts back at fit-to-view;
	// a mere viewport resize only re-clamps what the player set up.
	// Zero sizes are pre-measurement noise and must not stick as scale 0.
	const fittedFor = useRef('');
	useLayoutEffect(() => {
		if (!viewport.height || !content.height) return;
		const key = `${content.width}x${content.height}`;
		const reset = fittedFor.current !== key;
		fittedFor.current = key;
		setView((current) => {
			const fit = fitScale(viewport, content);
			const scale = reset
				? fit
				: clamp(current.scale, fit, MAX_SCALE);
			return clampView({ ...current, scale }, viewport, content);
		});
	}, [viewport, content]);

	const viewRef = useRef(view);
	viewRef.current = view;

	// Wheel must be a native non-passive listener to preventDefault.
	useEffect(() => {
		const port = viewportRef.current;
		if (!port) return;
		const onWheel = (event: WheelEvent) => {
			const rect = port.getBoundingClientRect();
			if (event.ctrlKey) {
				// ctrl+wheel and trackpad pinch zoom at the cursor
				event.preventDefault();
				zoomAt(
					{
						x: event.clientX - rect.left,
						y: event.clientY - rect.top,
					},
					Math.exp(-event.deltaY * 0.002),
				);
				return;
			}
			const { viewport, content } = sizes.current;
			const { scale } = viewRef.current;
			const pannable =
				content.width * scale > viewport.width ||
				content.height * scale > viewport.height;
			if (!pannable) return; // let the page scroll
			event.preventDefault();
			const sideways = event.shiftKey && event.deltaX === 0;
			applyView((current) => ({
				...current,
				x: current.x - (sideways ? event.deltaY : event.deltaX),
				y: current.y - (sideways ? 0 : event.deltaY),
			}));
		};
		port.addEventListener('wheel', onWheel, { passive: false });
		return () => port.removeEventListener('wheel', onWheel);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Gestures: one touch (or middle mouse, or mouse on the letterbox)
	// pans; two touches pinch-zoom. A pan suppresses the click so cells
	// don't fire after a drag.
	const pointers = useRef(new Map<number, { x: number; y: number }>());
	const pinch = useRef<{
		dist: number;
		mid: { x: number; y: number };
	} | null>(null);
	const pan = useRef<{
		id: number;
		last: { x: number; y: number };
		moved: number;
		active: boolean;
	} | null>(null);
	const suppressClick = useRef(false);

	const onPointerDown = (event: React.PointerEvent) => {
		pointers.current.set(event.pointerId, {
			x: event.clientX,
			y: event.clientY,
		});
		if (event.pointerType === 'touch' && pointers.current.size === 2) {
			pan.current = null;
			pinch.current = null; // re-measured on the next move
			return;
		}
		const onBackground = !(event.target as Element).closest('.cell');
		const startPan =
			event.button === 1 ||
			event.pointerType === 'touch' ||
			(event.button === 0 && onBackground);
		if (startPan && pointers.current.size === 1) {
			pan.current = {
				id: event.pointerId,
				last: { x: event.clientX, y: event.clientY },
				moved: 0,
				active: event.button === 1, // middle drag pans instantly
			};
		}
	};

	const onPointerMove = (event: React.PointerEvent) => {
		if (!pointers.current.has(event.pointerId)) return;
		pointers.current.set(event.pointerId, {
			x: event.clientX,
			y: event.clientY,
		});

		if (pointers.current.size === 2) {
			const [a, b] = [...pointers.current.values()];
			const rect = viewportRef.current!.getBoundingClientRect();
			const dist = Math.hypot(a.x - b.x, a.y - b.y);
			const mid = {
				x: (a.x + b.x) / 2 - rect.left,
				y: (a.y + b.y) / 2 - rect.top,
			};
			if (pinch.current) {
				const { dist: lastDist, mid: lastMid } = pinch.current;
				applyView((current) => {
					const scale = clamp(
						(current.scale * dist) / lastDist,
						fitScale(
							sizes.current.viewport,
							sizes.current.content,
						),
						MAX_SCALE,
					);
					const k = scale / current.scale;
					return {
						scale,
						x: mid.x - (lastMid.x - current.x) * k,
						y: mid.y - (lastMid.y - current.y) * k,
					};
				});
				suppressClick.current = true;
			}
			pinch.current = { dist, mid };
			return;
		}

		const drag = pan.current;
		if (!drag || drag.id !== event.pointerId) return;
		const dx = event.clientX - drag.last.x;
		const dy = event.clientY - drag.last.y;
		drag.moved += Math.abs(dx) + Math.abs(dy);
		drag.last = { x: event.clientX, y: event.clientY };
		if (!drag.active && drag.moved > PAN_THRESHOLD) {
			drag.active = true;
			viewportRef.current?.setPointerCapture(event.pointerId);
		}
		if (drag.active) {
			applyView((current) => ({
				...current,
				x: current.x + dx,
				y: current.y + dy,
			}));
			suppressClick.current = true;
		}
	};

	const onPointerEnd = (event: React.PointerEvent) => {
		pointers.current.delete(event.pointerId);
		if (pointers.current.size < 2) pinch.current = null;
		if (pan.current?.id === event.pointerId) pan.current = null;
	};

	const onClickCapture = (event: React.MouseEvent) => {
		if (!suppressClick.current) return;
		suppressClick.current = false;
		event.preventDefault();
		event.stopPropagation();
	};

	return (
		<>
			<div
				ref={viewportRef}
				className="board-viewport"
				style={
					content.width > 0
						? {
								width: content.width,
								// A board zoomed below 1 doesn't need its
								// natural height — no letterboxing above it.
								height: Math.min(
									content.height,
									Math.ceil(content.height * view.scale),
								),
							}
						: undefined
				}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerEnd}
				onPointerCancel={onPointerEnd}
				onClickCapture={onClickCapture}
			>
				<div
					ref={canvasRef}
					className="board-canvas"
					style={{
						transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
					}}
				>
					{children}
				</div>
			</div>
			{showControls && (
				<div className="board-fabs">
					{extraControls}
					<button
						type="button"
						className="fab"
						title="Zoom in"
						onClick={() => zoomBy(1.25)}
					>
						＋
					</button>
					<button
						type="button"
						className="fab"
						title="Zoom out"
						onClick={() => zoomBy(0.8)}
					>
						－
					</button>
					<button
						type="button"
						className="fab"
						title="Fit board to view"
						onClick={fit}
					>
						⤢
					</button>
				</div>
			)}
		</>
	);
}
