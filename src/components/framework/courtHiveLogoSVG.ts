import { create as d3Create, select as d3Select, easeCubicIn } from 'd3';

export interface CourtHiveLogoOptions {
  maxWidth?: string;
  color?: string;
  strokeWidth?: number;
  lineWidth?: number;
  fill?: string;
  className?: string;
  serviceLinePosition?: number;
  centerMarkLength?: number;
}

export function TMXlogoSVG(options: CourtHiveLogoOptions = {}): SVGSVGElement {
  const {
    maxWidth = '450px',
    color = '#000000',
    strokeWidth = 5,
    lineWidth = 5,
    fill = 'none',
    className = 'courthive-logo',
    serviceLinePosition = 0.3,
    centerMarkLength = 12,
  } = options;

  // Internal court markings are thinner than the hex outline
  const courtLine = lineWidth ?? strokeWidth;

  // Hexagon circumradius — defines unit geometry for the viewBox
  const R = 100;
  const sqrt3 = Math.sqrt(3);
  const RS3h = (R * sqrt3) / 2; // R * √3/2 ≈ 86.60
  const RS3 = R * sqrt3; //         R * √3  ≈ 173.21
  const Rh = R / 2; //              R / 2   = 50

  const pad = strokeWidth;

  // Open hex paths — 5 edges each, excluding the shared center edge
  // so the "net" can be drawn and faded independently.
  // Left hex: upper shared vertex → around the left side → lower shared vertex
  const leftHexPath =
    `M 0,${-Rh}` +
    ` L ${-RS3h},${-R}` +
    ` L ${-RS3},${-Rh}` +
    ` L ${-RS3},${Rh}` +
    ` L ${-RS3h},${R}` +
    ` L 0,${Rh}`;

  // Right hex: upper shared vertex → around the right side → lower shared vertex
  const rightHexPath =
    `M 0,${-Rh}` +
    ` L ${RS3h},${-R}` +
    ` L ${RS3},${-Rh}` +
    ` L ${RS3},${Rh}` +
    ` L ${RS3h},${R}` +
    ` L 0,${Rh}`;

  // Service lines: vertical lines offset from hex center toward flat edge
  const sLineOffset = serviceLinePosition * RS3h;
  const leftSLineX = -RS3h - sLineOffset;
  const rightSLineX = RS3h + sLineOffset;

  // Service line endpoints: intersect the hex's outer diagonal edges
  const sLineYTop = -R + sLineOffset / sqrt3;
  const sLineYBot = R - sLineOffset / sqrt3;

  const svg = d3Create('svg')
    .attr('viewBox', `${-RS3 - pad} ${-R - pad} ${2 * RS3 + 2 * pad} ${2 * R + 2 * pad}`)
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('class', className)
    .style('width', '100%')
    .style('max-width', maxWidth);

  const g = svg.append('g').attr('class', 'logo-group');

  // --- Hex outlines (open paths, thick boundary strokes) ---
  g.append('path')
    .attr('d', leftHexPath)
    .attr('fill', fill)
    .attr('stroke', color)
    .attr('stroke-width', strokeWidth)
    .attr('stroke-linejoin', 'miter')
    .attr('stroke-linecap', 'round');

  g.append('path')
    .attr('d', rightHexPath)
    .attr('fill', fill)
    .attr('stroke', color)
    .attr('stroke-width', strokeWidth)
    .attr('stroke-linejoin', 'miter')
    .attr('stroke-linecap', 'round');

  // --- Net line (shared center edge, fades with court markings) ---
  g.append('line')
    .attr('class', 'court-marking')
    .attr('x1', 0)
    .attr('y1', -Rh)
    .attr('x2', 0)
    .attr('y2', Rh)
    .attr('stroke', color)
    .attr('stroke-width', strokeWidth);

  // --- Court markings (thinner lines, classed for animation) ---

  // Left service line (vertical)
  g.append('line')
    .attr('class', 'court-marking')
    .attr('x1', leftSLineX)
    .attr('y1', sLineYTop)
    .attr('x2', leftSLineX)
    .attr('y2', sLineYBot)
    .attr('stroke', color)
    .attr('stroke-width', courtLine);

  // Right service line (vertical)
  g.append('line')
    .attr('class', 'court-marking')
    .attr('x1', rightSLineX)
    .attr('y1', sLineYTop)
    .attr('x2', rightSLineX)
    .attr('y2', sLineYBot)
    .attr('stroke', color)
    .attr('stroke-width', courtLine);

  // Center horizontal line between the two service lines
  g.append('line')
    .attr('class', 'court-marking')
    .attr('x1', leftSLineX)
    .attr('y1', 0)
    .attr('x2', rightSLineX)
    .attr('y2', 0)
    .attr('stroke', color)
    .attr('stroke-width', courtLine);

  // Center marks: short dashes on the inside of each flat edge
  g.append('line')
    .attr('class', 'court-marking')
    .attr('x1', -RS3)
    .attr('y1', 0)
    .attr('x2', -RS3 + centerMarkLength)
    .attr('y2', 0)
    .attr('stroke', color)
    .attr('stroke-width', courtLine);

  g.append('line')
    .attr('class', 'court-marking')
    .attr('x1', RS3 - centerMarkLength)
    .attr('y1', 0)
    .attr('x2', RS3)
    .attr('y2', 0)
    .attr('stroke', color)
    .attr('stroke-width', courtLine);

  return svg.node() as SVGSVGElement;
}

export interface FlyThroughOptions {
  delay?: number;
  duration?: number;
  courtLineFade?: number;
  onComplete?: () => void;
}

export function animateLogoFlyThrough(svg: SVGSVGElement, options?: FlyThroughOptions): void {
  const { delay = 2000, duration = 1500, courtLineFade = 900, onComplete } = options ?? {};

  const sel = d3Select(svg);

  // Parse original viewBox
  const vb = (sel.attr('viewBox') ?? '').split(/\s+/).map(Number);
  const [, , vbW] = vb;
  const zoom = 300;
  const targetVB = vb.map((v) => v / zoom).join(' ');

  // After the static display period, go fullscreen and animate the viewBox zoom
  setTimeout(() => {
    // Snapshot current screen position before moving
    const rect = svg.getBoundingClientRect();
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    // The original SVG maps viewBox width → element width.
    // Compute the scale so we can build a wider viewBox for the fullscreen SVG
    // that keeps the logo at exactly the same screen size and position.
    const vbScale = rect.width / vbW;
    const logoCenterY = rect.top + rect.height / 2;

    const startVB = [
      -winW / (2 * vbScale), // x: logo center stays at horizontal midpoint
      -logoCenterY / vbScale, // y: logo center stays at its original vertical position
      winW / vbScale, // width:  covers full window at original logo scale
      winH / vbScale, // height: covers full window at original logo scale
    ].join(' ');

    // Move SVG to body and make it fullscreen immediately — no size transition
    // means no intermediate clipping boundary smaller than the window.
    document.body.appendChild(svg);
    sel
      .attr('viewBox', startVB)
      .style('position', 'fixed')
      .style('top', '0px')
      .style('left', '0px')
      .style('width', '100vw')
      .style('height', '100vh')
      .style('max-width', 'none')
      .style('z-index', '9999')
      .style('pointer-events', 'none');

    // Fade court markings + net line
    sel
      .selectAll('.court-marking')
      .transition()
      .duration(courtLineFade)
      .style('opacity', '0');

    // Animate only the viewBox zoom — hex edges fly off the real window edges
    sel
      .transition('flythrough')
      .duration(duration)
      .ease(easeCubicIn)
      .attr('viewBox', targetVB);

    // Fade to transparent at the tail end for a clean exit
    sel
      .transition('fade')
      .delay(duration * 0.75)
      .duration(duration * 0.25)
      .style('opacity', '0')
      .on('end', () => {
        svg.remove();
        onComplete?.();
      });
  }, delay);
}
