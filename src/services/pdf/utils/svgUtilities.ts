/**
 * SVG to PNG conversion utilities
 * Ported from TMX-Suite-Legacy
 * 
 * Converts SVG elements to PNG data URIs for embedding in PDFs
 */

interface ImageObject {
  src: string;
  x?: number;
  y?: number;
}

interface SVGtoDataURLOptions {
  svg_string: string;
  images?: ImageObject[];
  min_height?: number;
}

/**
 * Convert an SVG element to a PNG data URI
 * @param selector - SVG element or container element with SVG
 * @param images - Optional images to overlay on the canvas
 * @param min_height - Minimum height for the output canvas
 * @returns Promise resolving to PNG data URI
 */
export function SVGasURI(
  selector: HTMLElement, 
  images: ImageObject[] = [], 
  min_height?: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const svgnode = selector.tagName.toLowerCase() === 'svg' 
      ? selector 
      : selector.querySelector('svg');
    
    if (!svgnode) {
      return reject(new Error('No SVG element found'));
    }
    
    const svg_string = getSVGString(svgnode as SVGElement);
    svgString2DataURL({ svg_string, images, min_height }).then(resolve, reject);
  });
}

/**
 * Save an SVG element as a PNG file
 * @param selector - SVG element or container
 * @param filename - Output filename
 * @param images - Optional images to overlay
 */
export function saveSVGasPNG({ 
  selector, 
  filename = 'svg.png', 
  images 
}: {
  selector: HTMLElement;
  filename?: string;
  images?: ImageObject[];
}): void {
  const svgnode = selector.tagName.toLowerCase() === 'svg' 
    ? selector 
    : selector.querySelector('svg');
  
  if (!svgnode) {
    console.error('No SVG element found');
    return;
  }
  
  const svg_string = getSVGString(svgnode as SVGElement);
  const saveImage = (image: string) => downloadURI(image, filename);

  svgString2DataURL({ svg_string, images }).then(saveImage);
}

/**
 * Serialize an SVG element to a string with embedded styles
 * @param svgNode - SVG element to serialize
 * @returns Serialized SVG string
 */
function getSVGString(svgNode: SVGElement): string {
  svgNode.setAttribute('xlink', 'http://www.w3.org/1999/xlink');
  const cssStyleText = getCSSStyles(svgNode);
  appendCSS(cssStyleText, svgNode);

  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(svgNode);
  svgString = svgString.replace(/(\w+)?:?xlink=/g, 'xmlns:xlink='); // Fix root xlink without namespace
  svgString = svgString.replace(/NS\d+:href/g, 'xlink:href'); // Safari NS namespace fix

  return svgString;
}

/**
 * Extract CSS styles relevant to SVG element and its children
 * @param parentElement - Parent SVG element
 * @returns CSS text string
 */
function getCSSStyles(parentElement: SVGElement): string {
  const selectorTextArr: string[] = [];

  // Add Parent element Id and Classes to the list
  if (parentElement.id) {
    selectorTextArr.push('#' + parentElement.id);
  }
  
  for (let c = 0; c < parentElement.classList.length; c++) {
    if (!contains('.' + parentElement.classList[c], selectorTextArr)) {
      selectorTextArr.push('.' + parentElement.classList[c]);
    }
  }

  // Add Children element Ids and Classes to the list
  const nodes = parentElement.getElementsByTagName('*');
  for (let i = 0; i < nodes.length; i++) {
    const id = (nodes[i] as HTMLElement).id;
    if (id && !contains('#' + id, selectorTextArr)) {
      selectorTextArr.push('#' + id);
    }

    const classes = (nodes[i] as HTMLElement).classList;
    for (let c = 0; c < classes.length; c++) {
      if (!contains('.' + classes[c], selectorTextArr)) {
        selectorTextArr.push('.' + classes[c]);
      }
    }
  }

  // Extract CSS Rules
  let extractedCSSText = '';
  for (let i = 0; i < document.styleSheets.length; i++) {
    const s = document.styleSheets[i];

    try {
      if (!s.cssRules) continue;
    } catch (e) {
      if ((e as Error).name !== 'SecurityError') throw e; // for Firefox
      continue;
    }

    const cssRules = s.cssRules;
    for (let r = 0; r < cssRules.length; r++) {
      const rule = cssRules[r] as CSSStyleRule;
      if (rule.selectorText && contains(rule.selectorText, selectorTextArr)) {
        extractedCSSText += rule.cssText;
      }
    }
  }

  return extractedCSSText;
}

/**
 * Check if array contains string
 */
function contains(str: string, arr: string[]): boolean {
  return arr.indexOf(str) !== -1;
}

/**
 * Append CSS styles to SVG element
 * @param cssText - CSS text to append
 * @param element - SVG element
 */
function appendCSS(cssText: string, element: SVGElement): void {
  const styleElement = document.createElement('style');
  styleElement.setAttribute('type', 'text/css');
  styleElement.innerHTML = cssText;
  const refNode = element.hasChildNodes() ? element.children[0] : null;
  element.insertBefore(styleElement, refNode);
}

/**
 * Convert SVG string to PNG data URL
 * @param options - SVG string and optional images/min_height
 * @returns Promise resolving to PNG data URL
 */
function svgString2DataURL(options: SVGtoDataURLOptions): Promise<string> {
  const { svg_string, images = [], min_height } = options;
  
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const imgsrc = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg_string)));

    const image = new Image();
    image.onload = () => {
      canvas.width = image.naturalWidth;
      canvas.height = min_height ? Math.max(image.naturalHeight, min_height) : image.naturalHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        return reject(new Error('Failed to get canvas context'));
      }
      
      ctx.drawImage(image, 0, 0);

      if (images.length) {
        Promise.all(images.map(imageObj => add2canvas(canvas, imageObj)))
          .then(() => resolve(canvas.toDataURL('image/png')))
          .catch(reject);
      } else {
        resolve(canvas.toDataURL('image/png'));
      }
    };

    image.onerror = () => reject(new Error('Failed to load SVG image'));
    image.src = imgsrc;
  });
}

/**
 * Download a data URI as a file
 * @param uri - Data URI
 * @param name - Filename
 */
function downloadURI(uri: string, name: string): void {
  const link = document.createElement('a');
  link.download = name;
  link.href = uri;

  const elem = document.body.appendChild(link);
  elem.click();
  elem.remove();
}

/**
 * Add an image to canvas
 * @param canvas - Target canvas
 * @param imageObj - Image object with src and position
 * @returns Promise resolving when image is drawn
 */
function add2canvas(canvas: HTMLCanvasElement, imageObj: ImageObject): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!imageObj || typeof imageObj !== 'object') {
      return reject(new Error('Invalid image object'));
    }
    
    const x = imageObj.x && canvas.width 
      ? (imageObj.x >= 0 ? imageObj.x : canvas.width + imageObj.x) 
      : 0;
    const y = imageObj.y && canvas.height 
      ? (imageObj.y >= 0 ? imageObj.y : canvas.height + imageObj.y) 
      : 0;
      
    const image = new Image();
    image.onload = () => {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(image, x, y);
        resolve();
      } else {
        reject(new Error('Failed to get canvas context'));
      }
    };

    image.onerror = () => reject(new Error('Failed to load overlay image'));
    image.src = imageObj.src;
  });
}
