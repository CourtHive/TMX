/**
 * Draw Renderer for PDF Generation
 * Renders draw structures to PNG for embedding in PDFs
 */
import { compositions, renderContainer, renderStructure } from 'courthive-components';
import { tournamentEngine } from 'tods-competition-factory';
import html2canvas from 'html2canvas';

interface RenderDrawOptions {
  drawId: string;
  structureId?: string;
  width?: number;
  height?: number;
}

/**
 * Render a draw structure to PNG data URI for PDF embedding
 * @param options - Draw rendering options
 * @returns Promise resolving to PNG data URI
 */
export async function renderDrawToPNG(options: RenderDrawOptions): Promise<string> {
  const { drawId, structureId, width = 2000 } = options;

  // Get matchUps for the draw
  const matchUpsResult = tournamentEngine.allDrawMatchUps({
    drawId,
    inContext: true,
    matchUpFilters: structureId ? { structureIds: [structureId] } : undefined,
  });

  const displayMatchUps = matchUpsResult?.matchUps || [];

  if (displayMatchUps.length === 0) {
    throw new Error('No matchUps found for draw');
  }

  // Use default composition - try different composition types
  const composition = compositions?.tableView || compositions?.gridView || compositions?.[Object.keys(compositions || {})[0]];

  // Create off-screen container - let it size naturally
  const offscreenContainer = document.createElement('div');
  offscreenContainer.style.position = 'absolute';
  offscreenContainer.style.top = '-99999px'; // Off-screen
  offscreenContainer.style.left = '-99999px';
  offscreenContainer.style.width = `${width}px`; // Set width but not height
  offscreenContainer.style.backgroundColor = 'white';
  document.body.appendChild(offscreenContainer);

  try {
    // Create event handlers for PDF rendering - omit scoreClick to prevent Score buttons from rendering
    const eventHandlers = {
      roundClick: () => {},
      scheduleClick: () => {},
      venueClick: () => {},
      participantClick: () => {},
      matchUpClick: () => {},
      // scoreClick intentionally omitted - no scoring in PDF printouts
    };



    // Check if composition is available
    if (!composition) {
      throw new Error('No composition available. compositions object may not be loaded.');
    }

    // Render the draw structure
    const content = renderContainer({
      content: renderStructure({
        context: { drawId, structureId },
        matchUps: displayMatchUps,
        composition,
        searchActive: false,
        eventHandlers,
        selectedMatchUpId: undefined,
        structureId,
        finalColumn: undefined,
        minWidth: undefined,
      }),
      theme: composition.theme,
    });

    offscreenContainer.appendChild(content);

    // Wait a moment for initial render
    await new Promise(resolve => setTimeout(resolve, 100));

    // Find the actual draw structure element and force it to expand fully
    const drawStructure = offscreenContainer.querySelector('.c-iZKoSQ, [class*="c-"]');
    if (drawStructure) {
      (drawStructure as HTMLElement).style.overflow = 'visible !important';
      (drawStructure as HTMLElement).style.height = 'auto !important';
      (drawStructure as HTMLElement).style.maxHeight = 'none !important';
    }

    // Remove any overflow/height constraints from all nested elements
    const allElements = offscreenContainer.querySelectorAll('*');
    allElements.forEach((el: any) => {
      const computedStyle = window.getComputedStyle(el);
      if (computedStyle.overflow !== 'visible') {
        el.style.overflow = 'visible';
      }
      if (computedStyle.maxHeight !== 'none') {
        el.style.maxHeight = 'none';
      }
    });

    // Wait for re-layout after removing constraints
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get the actual rendered dimensions from the FIRST CHILD (the draw container)
    const drawContainer = offscreenContainer.firstElementChild as HTMLElement;
    const actualHeight = drawContainer ? drawContainer.scrollHeight : offscreenContainer.scrollHeight;
    const actualWidth = drawContainer ? drawContainer.offsetWidth : offscreenContainer.offsetWidth;

    // Use html2canvas to convert the HTML draw to an image
    const canvas = await html2canvas(offscreenContainer, {
      backgroundColor: '#ffffff',
      scale: 2, // Higher quality
      logging: false,
      useCORS: true,
      allowTaint: true,
      width: actualWidth,
      height: actualHeight,
      windowWidth: actualWidth,
      windowHeight: actualHeight,
    });

    const dataURI = canvas.toDataURL('image/png');
    return dataURI;
  } finally {
    // Clean up off-screen container
    document.body.removeChild(offscreenContainer);
  }
}

/**
 * Check if a draw can be rendered (has matchUps)
 * @param drawId - Draw ID to check
 * @param structureId - Optional structure ID
 * @returns True if draw has matchUps and can be rendered
 */
export function canRenderDraw(drawId: string, structureId?: string): boolean {
  try {
    const matchUpsResult = tournamentEngine.allDrawMatchUps({
      drawId,
      matchUpFilters: structureId ? { structureIds: [structureId] } : undefined,
    });

    return (matchUpsResult?.matchUps?.length || 0) > 0;
  } catch {
    return false;
  }
}
