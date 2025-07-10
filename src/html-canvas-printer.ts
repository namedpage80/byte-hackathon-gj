import type { EpsonPrinter } from './interfaces/epson-printer';
import { TextAlignment, BarcodeType, TextStyle, BarcodeOptions, QRCodeOptions, ImageOptions } from './interfaces/epson-printer';

// Define element types for tracking
interface TextElementData {
  text: string;
  style?: TextStyle;
  alignment?: TextAlignment;
}

interface BarcodeElementData {
  data: string;
  type: BarcodeType;
  options?: BarcodeOptions;
}

interface QRCodeElementData {
  data: string;
  options?: QRCodeOptions;
}

interface ImageElementData {
  imageData: ImageData;
  options?: ImageOptions;
}

interface FeedLineElementData {
  lines: number;
}

interface CutElementData {
  // No additional data needed for cut elements
}

interface TextAlignElementData {
  alignment: TextAlignment;
}

interface TextSizeElementData {
  width: number;
  height: number;
}

interface TextStyleElementData {
  style: TextStyle;
}

interface LineSpaceElementData {
  space: number;
}

type ElementData = TextElementData | BarcodeElementData | QRCodeElementData | ImageElementData | FeedLineElementData | CutElementData | TextAlignElementData | TextSizeElementData | TextStyleElementData | LineSpaceElementData;

interface CanvasElement {
  id: string;
  type: 'text' | 'barcode' | 'qrcode' | 'image' | 'feedline' | 'cut' | 'textalign' | 'textsize' | 'textstyle' | 'linespace';
  x: number;
  y: number;
  width: number;
  height: number;
  data: ElementData;
  startY: number; // The Y position where this element starts
  endY: number;   // The Y position where this element ends
}

/**
 * HTML5 Canvas implementation of EpsonPrinter
 */

export class HTMLCanvasEpsonPrinter implements EpsonPrinter {
  /**
   * Clears the canvas and resets printer state to initial.
   */
  public clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.currentY = 0;
    this.currentTextAlign = 'left';
    this.currentTextStyle = {};
    this.currentTextSize = { width: 1, height: 1 };
    this.lineSpacing = 30;
    // Optionally, fill with white to mimic paper
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = 'black';
    this.ctx.font = `${this.baseFontSize}px ${this.baseFont}`;
    this.ctx.textBaseline = 'top';
    
    // Clear tracked elements
    this.elements = [];
    this.elementIdCounter = 0;
  }

  // Alignment constants
  readonly ALIGN_LEFT = 0;
  readonly ALIGN_CENTER = 1;
  readonly ALIGN_RIGHT = 2;

  // Font constants
  readonly FONT_A = 0;
  readonly FONT_B = 1;

  // Barcode type constants
  readonly BARCODE_UPC_A = 65;
  readonly BARCODE_CODE39 = 69;
  readonly BARCODE_CODE93 = 72;
  readonly BARCODE_CODE128 = 73;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  public currentY = 0;
  private currentTextAlign: TextAlignment = 'left';
  private currentTextStyle: TextStyle = {};
  private currentTextSize = { width: 1, height: 1 };
  private lineSpacing = 30; // Default line spacing in pixels
  private readonly baseFont = 'monospace';
  private readonly baseFontSize = 16; // Base font size for 80-column width
  private readonly paperWidth: number;
  
  // Element tracking
  private elements: CanvasElement[] = [];
  private elementIdCounter = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.paperWidth = canvas.width;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    this.ctx = ctx;
    // Set default styles
    this.ctx.font = `${this.baseFontSize}px ${this.baseFont}`;
    this.ctx.fillStyle = 'black';
    this.ctx.textBaseline = 'top';
  }

  // Get all elements for the overlay system
  public getElements(): CanvasElement[] {
    return [...this.elements];
  }

  // Get the receipt data structure for saving
  public getReceiptData(): CanvasElement[] {
    return [...this.elements];
  }

  // Load receipt data structure and redraw
  public loadReceiptData(elements: CanvasElement[]): void {
    this.elements = [...elements];
    this.elementIdCounter = Math.max(...elements.map(el => parseInt(el.id.split('_')[1]) || 0), 0);
    this.redrawCanvasFromElements();
  }

  // Remove an element by ID
  public removeElement(elementId: string): boolean {
    const index = this.elements.findIndex(el => el.id === elementId);
    if (index === -1) return false;
    
    this.elements.splice(index, 1);
    this.redrawCanvas();
    return true;
  }

  // Reorder elements by moving an element from one position to another
  public reorderElement(elementId: string, newIndex: number): boolean {
    console.log('reorderElement called:', { elementId, newIndex, elementsCount: this.elements.length });
    
    const currentIndex = this.elements.findIndex(el => el.id === elementId);
    console.log('Current index:', currentIndex);
    
    if (currentIndex === -1 || newIndex < 0 || newIndex >= this.elements.length) {
      console.log('Invalid indexes:', { currentIndex, newIndex, elementsLength: this.elements.length });
      return false;
    }
    
    // Remove element from current position and insert at new position
    const [element] = this.elements.splice(currentIndex, 1);
    this.elements.splice(newIndex, 0, element);
    
    console.log('Element reordered, redrawing canvas...');
    
    // Redraw canvas with new order
    this.redrawCanvasFromElements();
    return true;
  }

  // Redraw canvas from existing elements without recreating them
  private redrawCanvasFromElements(): void {
    // Clear the canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = 'black';
    
    // Reset printer state
    this.currentY = 0;
    this.currentTextAlign = 'left';
    this.currentTextStyle = {};
    this.currentTextSize = { width: 1, height: 1 };
    this.lineSpacing = 30;
    this.ctx.font = `${this.baseFontSize}px ${this.baseFont}`;
    this.ctx.textBaseline = 'top';
    
    // Redraw all elements in their new order, updating positions
    for (const element of this.elements) {
      this.redrawElementAtCurrentPosition(element);
    }
  }

  // Redraw a single element at the current position
  private redrawElementAtCurrentPosition(element: CanvasElement): void {
    switch (element.type) {
      case 'text':
        this.redrawTextElementAtPosition(element);
        break;
      case 'barcode':
        this.redrawBarcodeElementAtPosition(element);
        break;
      case 'qrcode':
        this.redrawQRCodeElementAtPosition(element);
        break;
      case 'image':
        this.redrawImageElementAtPosition(element);
        break;
      case 'feedline':
        this.redrawFeedLineElementAtPosition(element);
        break;
      case 'cut':
        this.redrawCutElementAtPosition(element);
        break;
      case 'textalign':
        this.redrawTextAlignElementAtPosition(element);
        break;
      case 'textsize':
        this.redrawTextSizeElementAtPosition(element);
        break;
      case 'textstyle':
        this.redrawTextStyleElementAtPosition(element);
        break;
      case 'linespace':
        this.redrawLineSpaceElementAtPosition(element);
        break;
    }
  }

  // Redraw text element at current position
  private redrawTextElementAtPosition(element: CanvasElement): void {
    if (element.type !== 'text') return;
    const { text } = element.data as TextElementData;
    // Use the current global style state (set by previous styling elements)
    const fontSize = this.baseFontSize * this.currentTextSize.height;
    this.ctx.font = `${this.currentTextStyle?.bold ? 'bold' : ''} ${fontSize}px ${this.currentTextStyle?.fontFamily || this.baseFont}`;
    this.ctx.fillStyle = 'black';
    const alignment = this.currentTextAlign;
    const style = this.currentTextStyle;
    const words = text.split(' ');
    let currentLine = words[0];
    const lines: string[] = [];
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = this.ctx.measureText(currentLine + ' ' + word).width;
      if (width < this.paperWidth - 20) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    const lineHeight = fontSize + this.lineSpacing;
    const startY = this.currentY;
    const totalHeight = this.currentY + lines.length * lineHeight;
    this.ensureCanvasHeight(totalHeight);
    lines.forEach((line, idx) => {
      let x = 0;
      let y = this.currentY + idx * lineHeight;
      switch (alignment) {
        case 'center':
          this.ctx.textAlign = 'center';
          x = this.paperWidth / 2;
          break;
        case 'right':
          this.ctx.textAlign = 'right';
          x = this.paperWidth - 10;
          break;
        default:
          this.ctx.textAlign = 'left';
          x = 10;
      }
      this.ctx.fillText(line, x, y);
      if (style?.underline) {
        const metrics = this.ctx.measureText(line);
        let underlineStart = x;
        let underlineEnd = x;
        switch (alignment) {
          case 'center':
            underlineStart = x - metrics.width / 2;
            underlineEnd = x + metrics.width / 2;
            break;
          case 'right':
            underlineStart = x - metrics.width;
            underlineEnd = x;
            break;
          default:
            underlineStart = x;
            underlineEnd = x + metrics.width;
        }
        this.ctx.beginPath();
        this.ctx.moveTo(underlineStart, y + fontSize + 2);
        this.ctx.lineTo(underlineEnd, y + fontSize + 2);
        this.ctx.stroke();
      }
    });
    // Update element position
    element.x = 10;
    element.y = startY;
    element.width = this.paperWidth - 20;
    element.height = totalHeight - startY;
    element.startY = startY;
    element.endY = totalHeight;
    this.currentY = totalHeight;
  }

  // Redraw barcode element at current position
  private redrawBarcodeElementAtPosition(element: CanvasElement): void {
    if (element.type !== 'barcode') return;
    const { data, type, options } = element.data as BarcodeElementData;
    
    const barcodeHeight = options?.height || 100;
    const startY = this.currentY;
    this.ensureCanvasHeight(this.currentY + barcodeHeight + 20);
    
    this.ctx.save();
    this.ctx.strokeStyle = 'black';
    this.ctx.strokeRect(10, this.currentY, this.paperWidth - 20, barcodeHeight);
    this.ctx.fillStyle = 'black';
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`Barcode: ${data}`, this.paperWidth / 2, this.currentY + barcodeHeight + 5);
    this.ctx.restore();
    
    // Update element position
    element.x = 10;
    element.y = startY;
    element.width = this.paperWidth - 20;
    element.height = barcodeHeight + 20;
    element.startY = startY;
    element.endY = this.currentY + barcodeHeight + 20;
    
    this.currentY += barcodeHeight + 20;
  }

  // Redraw QR code element at current position
  private redrawQRCodeElementAtPosition(element: CanvasElement): void {
    if (element.type !== 'qrcode') return;
    const { data, options } = element.data as QRCodeElementData;
    
    const qrSize = options?.size || 200;
    const startY = this.currentY;
    this.ensureCanvasHeight(this.currentY + qrSize + 20);
    
    this.ctx.save();
    this.ctx.strokeStyle = 'black';
    this.ctx.strokeRect(10, this.currentY, qrSize, qrSize);
    this.ctx.fillStyle = 'black';
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`QR Code: ${data}`, this.paperWidth / 2, this.currentY + qrSize + 5);
    this.ctx.restore();
    
    // Update element position
    element.x = 10;
    element.y = startY;
    element.width = qrSize;
    element.height = qrSize + 20;
    element.startY = startY;
    element.endY = this.currentY + qrSize + 20;
    
    this.currentY += qrSize + 20;
  }

  // Redraw image element at current position
  private redrawImageElementAtPosition(element: CanvasElement): void {
    if (element.type !== 'image') return;
    const { imageData, options } = element.data as ImageElementData;
    
    const startY = this.currentY;
    this.ensureCanvasHeight(this.currentY + imageData.height + 20);
    
    this.ctx.save();
    this.ctx.putImageData(imageData, 10, this.currentY);
    this.ctx.fillStyle = 'black';
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Image', this.paperWidth / 2, this.currentY + imageData.height + 5);
    this.ctx.restore();
    
    // Update element position
    element.x = 10;
    element.y = startY;
    element.width = imageData.width;
    element.height = imageData.height + 20;
    element.startY = startY;
    element.endY = this.currentY + imageData.height + 20;
    
    this.currentY += imageData.height + 20;
  }

  // Redraw feed line element at current position
  private redrawFeedLineElementAtPosition(element: CanvasElement): void {
    if (element.type !== 'feedline') return;
    const { lines } = element.data as FeedLineElementData;
    
    const startY = this.currentY;
    const feedHeight = lines * this.lineSpacing;
    this.ensureCanvasHeight(this.currentY + feedHeight);
    
    // Update element position
    element.x = 0;
    element.y = startY;
    element.width = this.paperWidth;
    element.height = feedHeight;
    element.startY = startY;
    element.endY = this.currentY + feedHeight;
    
    this.currentY += feedHeight;
  }

  // Redraw cut element at current position
  private redrawCutElementAtPosition(element: CanvasElement): void {
    if (element.type !== 'cut') return;
    
    const startY = this.currentY;
    this.ensureCanvasHeight(this.currentY + 20);
    
    this.ctx.save();
    this.ctx.strokeStyle = '#666';
    this.ctx.setLineDash([5, 5]);
    this.ctx.beginPath();
    this.ctx.moveTo(10, this.currentY + 10);
    this.ctx.lineTo(this.paperWidth - 10, this.currentY + 10);
    this.ctx.stroke();
    this.ctx.restore();
    
    // Update element position
    element.x = 10;
    element.y = startY;
    element.width = this.paperWidth - 20;
    element.height = 20;
    element.startY = startY;
    element.endY = this.currentY + 20;
    
    this.currentY += 20;
  }

  // Redraw text align element at current position
  private redrawTextAlignElementAtPosition(element: CanvasElement): void {
    if (element.type !== 'textalign') return;
    const { alignment } = element.data as TextAlignElementData;
    this.currentTextAlign = alignment;
    const startY = this.currentY;
    this.ensureCanvasHeight(this.currentY + 20);
    this.ctx.save();
    this.ctx.fillStyle = '#999';
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`Text Align: ${alignment}`, this.paperWidth / 2, this.currentY + 5);
    this.ctx.restore();
    // Update element position
    element.x = 0;
    element.y = startY;
    element.width = this.paperWidth;
    element.height = 20;
    element.startY = startY;
    element.endY = this.currentY + 20;
    this.currentY += 20;
  }

  // Redraw text size element at current position
  private redrawTextSizeElementAtPosition(element: CanvasElement): void {
    if (element.type !== 'textsize') return;
    const { width, height } = element.data as TextSizeElementData;
    this.currentTextSize = { width, height };
    const startY = this.currentY;
    this.ensureCanvasHeight(this.currentY + 20);
    this.ctx.save();
    this.ctx.fillStyle = '#999';
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`Text Size: ${width}x${height}`, this.paperWidth / 2, this.currentY + 5);
    this.ctx.restore();
    // Update element position
    element.x = 0;
    element.y = startY;
    element.width = this.paperWidth;
    element.height = 20;
    element.startY = startY;
    element.endY = this.currentY + 20;
    this.currentY += 20;
  }

  // Redraw text style element at current position
  private redrawTextStyleElementAtPosition(element: CanvasElement): void {
    if (element.type !== 'textstyle') return;
    const { style } = element.data as TextStyleElementData;
    this.currentTextStyle = style;
    const startY = this.currentY;
    this.ensureCanvasHeight(this.currentY + 20);
    this.ctx.save();
    this.ctx.fillStyle = '#999';
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'center';
    const styleText = `Text Style: ${style.bold ? 'Bold' : ''} ${style.underline ? 'Underline' : ''} ${style.fontFamily || 'Default'}`.trim();
    this.ctx.fillText(styleText, this.paperWidth / 2, this.currentY + 5);
    this.ctx.restore();
    // Update element position
    element.x = 0;
    element.y = startY;
    element.width = this.paperWidth;
    element.height = 20;
    element.startY = startY;
    element.endY = this.currentY + 20;
    this.currentY += 20;
  }

  // Redraw line space element at current position
  private redrawLineSpaceElementAtPosition(element: CanvasElement): void {
    if (element.type !== 'linespace') return;
    const { space } = element.data as LineSpaceElementData;
    this.lineSpacing = space;
    const startY = this.currentY;
    this.ensureCanvasHeight(this.currentY + 20);
    this.ctx.save();
    this.ctx.fillStyle = '#999';
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`Line Space: ${space}px`, this.paperWidth / 2, this.currentY + 5);
    this.ctx.restore();
    // Update element position
    element.x = 0;
    element.y = startY;
    element.width = this.paperWidth;
    element.height = 20;
    element.startY = startY;
    element.endY = this.currentY + 20;
    this.currentY += 20;
  }

  // Redraw the entire canvas after element removal
  private redrawCanvas(): void {
    // Clear the canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = 'black';
    
    // Reset printer state
    this.currentY = 0;
    this.currentTextAlign = 'left';
    this.currentTextStyle = {};
    this.currentTextSize = { width: 1, height: 1 };
    this.lineSpacing = 30;
    this.ctx.font = `${this.baseFontSize}px ${this.baseFont}`;
    this.ctx.textBaseline = 'top';
    
    // Clear elements array to prevent duplicates
    const elementsToRedraw = [...this.elements];
    this.elements = [];
    this.elementIdCounter = 0;
    
    // Redraw all remaining elements in order, recalculating positions and styles from scratch
    for (const element of elementsToRedraw) {
      switch (element.type) {
        case 'text':
          this.addText((element.data as any).text, (element.data as any).style);
          break;
        case 'barcode':
          this.addBarcode((element.data as any).data, (element.data as any).type, (element.data as any).options);
          break;
        case 'qrcode':
          this.addQRCode((element.data as any).data, (element.data as any).options);
          break;
        case 'image':
          this.addImage((element.data as any).imageData, (element.data as any).options);
          break;
        case 'feedline':
          this.addFeedLine((element.data as any).lines);
          break;
        case 'cut':
          this.cutPaper();
          break;
        case 'textalign':
          this.addTextAlign((element.data as any).alignment);
          break;
        case 'textsize':
          this.addTextSize((element.data as any).width, (element.data as any).height);
          break;
        case 'textstyle':
          this.addTextStyle((element.data as any).style);
          break;
        case 'linespace':
          this.addLineSpace((element.data as any).space);
          break;
      }
    }
  }

  private redrawTextElement(element: CanvasElement): void {
    if (element.type !== 'text') return;
    const { text, style, alignment } = element.data as TextElementData;
    this.currentTextStyle = style || {};
    this.currentTextAlign = alignment || 'left';
    
    // Redraw text without tracking (to avoid duplicate tracking)
    const fontSize = this.baseFontSize * this.currentTextSize.height;
    this.ctx.font = `${style?.bold ? 'bold' : ''} ${fontSize}px ${style?.fontFamily || this.baseFont}`;
    this.ctx.fillStyle = 'black';
    
    const words = text.split(' ');
    let currentLine = words[0];
    const lines: string[] = [];
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = this.ctx.measureText(currentLine + ' ' + word).width;
      if (width < this.paperWidth - 20) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    
    const lineHeight = fontSize + this.lineSpacing;
    const totalHeight = this.currentY + lines.length * lineHeight;
    this.ensureCanvasHeight(totalHeight);
    
    lines.forEach((line, idx) => {
      let x = 0;
      let y = this.currentY + idx * lineHeight;
      switch (this.currentTextAlign) {
        case 'center':
          this.ctx.textAlign = 'center';
          x = this.paperWidth / 2;
          break;
        case 'right':
          this.ctx.textAlign = 'right';
          x = this.paperWidth - 10;
          break;
        default:
          this.ctx.textAlign = 'left';
          x = 10;
      }
      this.ctx.fillText(line, x, y);
      if (style?.underline) {
        const metrics = this.ctx.measureText(line);
        let underlineStart = x;
        let underlineEnd = x;
        switch (this.currentTextAlign) {
          case 'center':
            underlineStart = x - metrics.width / 2;
            underlineEnd = x + metrics.width / 2;
            break;
          case 'right':
            underlineStart = x - metrics.width;
            underlineEnd = x;
            break;
          default:
            underlineStart = x;
            underlineEnd = x + metrics.width;
        }
        this.ctx.beginPath();
        this.ctx.moveTo(underlineStart, y + fontSize + 2);
        this.ctx.lineTo(underlineEnd, y + fontSize + 2);
        this.ctx.stroke();
      }
    });
    
    // Track the element
    const elementId = `text_${++this.elementIdCounter}`;
    this.elements.push({
      id: elementId,
      type: 'text',
      x: 10,
      y: element.startY,
      width: this.paperWidth - 20,
      height: totalHeight - element.startY,
      data: { text, style, alignment: this.currentTextAlign },
      startY: element.startY,
      endY: totalHeight
    });
    
    this.currentY = totalHeight;
  }

  private redrawBarcodeElement(element: CanvasElement): void {
    if (element.type !== 'barcode') return;
    const { data, type, options } = element.data as BarcodeElementData;
    
    const barcodeHeight = options?.height || 100;
    this.ensureCanvasHeight(this.currentY + barcodeHeight + 20);
    this.ctx.save();
    this.ctx.strokeStyle = 'black';
    this.ctx.strokeRect(10, this.currentY, this.paperWidth - 20, barcodeHeight);
    this.ctx.font = '12px monospace';
    this.ctx.fillStyle = 'black';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`[${type} Barcode: ${data}]`, this.paperWidth / 2, this.currentY + barcodeHeight / 2);
    this.ctx.restore();
    const endY = this.currentY + barcodeHeight + 20;
    
    // Track the element
    const elementId = `barcode_${++this.elementIdCounter}`;
    this.elements.push({
      id: elementId,
      type: 'barcode',
      x: 10,
      y: element.startY,
      width: this.paperWidth - 20,
      height: barcodeHeight + 20,
      data: { data, type, options },
      startY: element.startY,
      endY
    });
    
    this.currentY = endY;
  }

  private redrawQRCodeElement(element: CanvasElement): void {
    if (element.type !== 'qrcode') return;
    const { data, options } = element.data as QRCodeElementData;
    
    const size = options?.size || 200;
    this.ensureCanvasHeight(this.currentY + size + 20);
    this.ctx.save();
    this.ctx.strokeStyle = 'black';
    this.ctx.strokeRect(
      (this.paperWidth - size) / 2,
      this.currentY,
      size,
      size
    );
    this.ctx.font = '12px monospace';
    this.ctx.fillStyle = 'black';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('[QR Code]', this.paperWidth / 2, this.currentY + size / 2);
    this.ctx.restore();
    const endY = this.currentY + size + 20;
    
    // Track the element
    const elementId = `qrcode_${++this.elementIdCounter}`;
    this.elements.push({
      id: elementId,
      type: 'qrcode',
      x: (this.paperWidth - size) / 2,
      y: element.startY,
      width: size,
      height: size + 20,
      data: { data, options },
      startY: element.startY,
      endY
    });
    
    this.currentY = endY;
  }

  private redrawImageElement(element: CanvasElement): void {
    if (element.type !== 'image') return;
    const { imageData, options } = element.data as ImageElementData;
    
    const width = options?.width || imageData.width;
    const height = options?.height || (imageData.height * (width / imageData.width));
    this.ensureCanvasHeight(this.currentY + height + 20);
    let x = 0;
    switch (options?.alignment || 'left') {
      case 'center':
        x = (this.paperWidth - width) / 2;
        break;
      case 'right':
        x = this.paperWidth - width;
        break;
    }
    const imgCanvas = document.createElement('canvas');
    imgCanvas.width = imageData.width;
    imgCanvas.height = imageData.height;
    const imgCtx = imgCanvas.getContext('2d');
    if (!imgCtx) throw new Error('Could not get image canvas context');
    imgCtx.putImageData(imageData, 0, 0);
    this.ctx.drawImage(imgCanvas, x, this.currentY, width, height);
    const endY = this.currentY + height + 20;
    
    // Track the element
    const elementId = `image_${++this.elementIdCounter}`;
    this.elements.push({
      id: elementId,
      type: 'image',
      x,
      y: element.startY,
      width,
      height: height + 20,
      data: { imageData, options },
      startY: element.startY,
      endY
    });
    
    this.currentY = endY;
  }

  private redrawFeedLineElement(element: CanvasElement): void {
    if (element.type !== 'feedline') return;
    const lineHeight = this.baseFontSize * this.currentTextSize.height;
    const { lines } = element.data as FeedLineElementData;
    this.currentY += lines * (lineHeight + this.lineSpacing);
    this.ensureCanvasHeight(this.currentY);
    
    // Track the element
    const elementId = `feedline_${++this.elementIdCounter}`;
    this.elements.push({
      id: elementId,
      type: 'feedline',
      x: 0,
      y: element.startY,
      width: this.paperWidth,
      height: lines * (lineHeight + this.lineSpacing),
      data: { lines },
      startY: element.startY,
      endY: this.currentY
    });
  }

  private redrawCutElement(element: CanvasElement): void {
    
    this.ctx.save();
    this.ctx.setLineDash([10, 5]);
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.currentY);
    this.ctx.lineTo(this.paperWidth, this.currentY);
    this.ctx.strokeStyle = '#666';
    this.ctx.stroke();
    this.ctx.restore();
    this.currentY += 20;
    this.ensureCanvasHeight(this.currentY);
    
    // Track the element
    const elementId = `cut_${++this.elementIdCounter}`;
    this.elements.push({
      id: elementId,
      type: 'cut',
      x: 0,
      y: element.startY,
      width: this.paperWidth,
      height: 20,
      data: {},
      startY: element.startY,
      endY: this.currentY
    });
  }

  private redrawTextAlignElement(element: CanvasElement): void {
    if (element.type !== 'textalign') return;
    const { alignment } = element.data as TextAlignElementData;
    this.currentTextAlign = alignment;
    
    // Draw the styling element as grayed out text
    this.ctx.save();
    this.ctx.font = '12px monospace';
    this.ctx.fillStyle = '#999';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`[Text Alignment: ${alignment}]`, 10, this.currentY);
    this.ctx.restore();
    const endY = this.currentY + 20;
    
    // Track the element
    const elementId = `textalign_${++this.elementIdCounter}`;
    this.elements.push({
      id: elementId,
      type: 'textalign',
      x: 10,
      y: element.startY,
      width: this.paperWidth - 20,
      height: 20,
      data: { alignment },
      startY: element.startY,
      endY
    });
    
    this.currentY = endY;
  }

  private redrawTextSizeElement(element: CanvasElement): void {
    if (element.type !== 'textsize') return;
    const { width, height } = element.data as TextSizeElementData;
    this.currentTextSize = { width, height };
    
    // Draw the styling element as grayed out text
    this.ctx.save();
    this.ctx.font = '12px monospace';
    this.ctx.fillStyle = '#999';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`[Text Size: ${width}x${height}]`, 10, this.currentY);
    this.ctx.restore();
    const endY = this.currentY + 20;
    
    // Track the element
    const elementId = `textsize_${++this.elementIdCounter}`;
    this.elements.push({
      id: elementId,
      type: 'textsize',
      x: 10,
      y: element.startY,
      width: this.paperWidth - 20,
      height: 20,
      data: { width, height },
      startY: element.startY,
      endY
    });
    
    this.currentY = endY;
  }

  private redrawTextStyleElement(element: CanvasElement): void {
    if (element.type !== 'textstyle') return;
    const { style } = element.data as TextStyleElementData;
    this.currentTextStyle = style;
    
    // Draw the styling element as grayed out text
    this.ctx.save();
    this.ctx.font = '12px monospace';
    this.ctx.fillStyle = '#999';
    this.ctx.textAlign = 'left';
    const styleText = `[Text Style: ${style.bold ? 'bold ' : ''}${style.underline ? 'underline ' : ''}${style.fontFamily || 'default'}]`;
    this.ctx.fillText(styleText, 10, this.currentY);
    this.ctx.restore();
    const endY = this.currentY + 20;
    
    // Track the element
    const elementId = `textstyle_${++this.elementIdCounter}`;
    this.elements.push({
      id: elementId,
      type: 'textstyle',
      x: 10,
      y: element.startY,
      width: this.paperWidth - 20,
      height: 20,
      data: { style },
      startY: element.startY,
      endY
    });
    
    this.currentY = endY;
  }

  private redrawLineSpaceElement(element: CanvasElement): void {
    if (element.type !== 'linespace') return;
    const { space } = element.data as LineSpaceElementData;
    this.lineSpacing = space;
    
    // Draw the styling element as grayed out text
    this.ctx.save();
    this.ctx.font = '12px monospace';
    this.ctx.fillStyle = '#999';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`[Line Spacing: ${space}px]`, 10, this.currentY);
    this.ctx.restore();
    const endY = this.currentY + 20;
    
    // Track the element
    const elementId = `linespace_${++this.elementIdCounter}`;
    this.elements.push({
      id: elementId,
      type: 'linespace',
      x: 10,
      y: element.startY,
      width: this.paperWidth - 20,
      height: 20,
      data: { space },
      startY: element.startY,
      endY
    });
    
    this.currentY = endY;
  }

  private ensureCanvasHeight(requiredHeight: number): void {
    if (requiredHeight > this.canvas.height) {
      const newCanvas = document.createElement('canvas');
      newCanvas.width = this.canvas.width;
      newCanvas.height = Math.max(this.canvas.height * 2, requiredHeight + 500);
      const newCtx = newCanvas.getContext('2d');
      if (!newCtx) throw new Error('Could not get canvas context');
      newCtx.drawImage(this.canvas, 0, 0);
      this.canvas.height = newCanvas.height;
      this.ctx.drawImage(newCanvas, 0, 0);
      this.ctx.font = `${this.baseFontSize * this.currentTextSize.height}px ${this.baseFont}`;
      this.ctx.fillStyle = 'black';
      this.ctx.textBaseline = 'top';
    }
  }

  addText(text: string, options?: TextStyle): void {
    const style = { ...this.currentTextStyle, ...options };
    const fontSize = this.baseFontSize * this.currentTextSize.height;
    this.ctx.font = `${style.bold ? 'bold' : ''} ${fontSize}px ${style.fontFamily || this.baseFont}`;
    this.ctx.fillStyle = 'black';
    const words = text.split(' ');
    let currentLine = words[0];
    const lines: string[] = [];
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = this.ctx.measureText(currentLine + ' ' + word).width;
      if (width < this.paperWidth - 20) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    const lineHeight = fontSize + this.lineSpacing;
    const totalHeight = this.currentY + lines.length * lineHeight;
    this.ensureCanvasHeight(totalHeight);
    
    // Track the text element
    const elementId = `text_${++this.elementIdCounter}`;
    const startY = this.currentY;
    
    lines.forEach((line, idx) => {
      let x = 0;
      let y = this.currentY + idx * lineHeight;
      // Set canvas text alignment and x position
      switch (this.currentTextAlign) {
        case 'center':
          this.ctx.textAlign = 'center';
          x = this.paperWidth / 2;
          break;
        case 'right':
          this.ctx.textAlign = 'right';
          x = this.paperWidth - 10;
          break;
        default:
          this.ctx.textAlign = 'left';
          x = 10;
      }
      this.ctx.fillText(line, x, y);
      if (style.underline) {
        const metrics = this.ctx.measureText(line);
        let underlineStart = x;
        let underlineEnd = x;
        switch (this.currentTextAlign) {
          case 'center':
            underlineStart = x - metrics.width / 2;
            underlineEnd = x + metrics.width / 2;
            break;
          case 'right':
            underlineStart = x - metrics.width;
            underlineEnd = x;
            break;
          default:
            underlineStart = x;
            underlineEnd = x + metrics.width;
        }
        this.ctx.beginPath();
        this.ctx.moveTo(underlineStart, y + fontSize + 2);
        this.ctx.lineTo(underlineEnd, y + fontSize + 2);
        this.ctx.stroke();
      }
    });
    
    // Add element to tracking
    this.elements.push({
      id: elementId,
      type: 'text',
      x: 10,
      y: startY,
      width: this.paperWidth - 20,
      height: totalHeight - startY,
      data: { text, style, alignment: this.currentTextAlign },
      startY,
      endY: totalHeight
    });
    
    this.currentY = totalHeight;
  }

  addTextAlign(alignment: TextAlignment): void {
    this.currentTextAlign = alignment;
    
    // Track the styling element
    const elementId = `textalign_${++this.elementIdCounter}`;
    this.elements.push({
      id: elementId,
      type: 'textalign',
      x: 10,
      y: this.currentY,
      width: this.paperWidth - 20,
      height: 20,
      data: { alignment },
      startY: this.currentY,
      endY: this.currentY + 20
    });
    
    // Draw the styling element as grayed out text
    this.ctx.save();
    this.ctx.font = '12px monospace';
    this.ctx.fillStyle = '#999';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`[Text Alignment: ${alignment}]`, 10, this.currentY);
    this.ctx.restore();
    this.currentY += 20;
    this.ensureCanvasHeight(this.currentY);
  }

  addTextSize(width: number, height: number): void {
    this.currentTextSize = {
      width: Math.max(1, Math.min(8, width)),
      height: Math.max(1, Math.min(8, height))
    };
    
    // Track the styling element
    const elementId = `textsize_${++this.elementIdCounter}`;
    this.elements.push({
      id: elementId,
      type: 'textsize',
      x: 10,
      y: this.currentY,
      width: this.paperWidth - 20,
      height: 20,
      data: { width: this.currentTextSize.width, height: this.currentTextSize.height },
      startY: this.currentY,
      endY: this.currentY + 20
    });
    
    // Draw the styling element as grayed out text
    this.ctx.save();
    this.ctx.font = '12px monospace';
    this.ctx.fillStyle = '#999';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`[Text Size: ${this.currentTextSize.width}x${this.currentTextSize.height}]`, 10, this.currentY);
    this.ctx.restore();
    this.currentY += 20;
    this.ensureCanvasHeight(this.currentY);
  }

  addTextStyle(style: TextStyle): void {
    this.currentTextStyle = { ...this.currentTextStyle, ...style };
    
    // Track the styling element
    const elementId = `textstyle_${++this.elementIdCounter}`;
    this.elements.push({
      id: elementId,
      type: 'textstyle',
      x: 10,
      y: this.currentY,
      width: this.paperWidth - 20,
      height: 20,
      data: { style: this.currentTextStyle },
      startY: this.currentY,
      endY: this.currentY + 20
    });
    
    // Draw the styling element as grayed out text
    this.ctx.save();
    this.ctx.font = '12px monospace';
    this.ctx.fillStyle = '#999';
    this.ctx.textAlign = 'left';
    const styleText = `[Text Style: ${this.currentTextStyle.bold ? 'bold ' : ''}${this.currentTextStyle.underline ? 'underline ' : ''}${this.currentTextStyle.fontFamily || 'default'}]`;
    this.ctx.fillText(styleText, 10, this.currentY);
    this.ctx.restore();
    this.currentY += 20;
    this.ensureCanvasHeight(this.currentY);
  }

  addFeedLine(lines: number): void {
    const lineHeight = this.baseFontSize * this.currentTextSize.height;
    const startY = this.currentY;
    this.currentY += lines * (lineHeight + this.lineSpacing);
    this.ensureCanvasHeight(this.currentY);
    
    // Track the feed line element
    const elementId = `feedline_${++this.elementIdCounter}`;
    this.elements.push({
      id: elementId,
      type: 'feedline',
      x: 0,
      y: startY,
      width: this.paperWidth,
      height: lines * (lineHeight + this.lineSpacing),
      data: { lines },
      startY,
      endY: this.currentY
    });
  }

  addLineSpace(space: number): void {
    this.lineSpacing = space;
    
    // Track the styling element
    const elementId = `linespace_${++this.elementIdCounter}`;
    this.elements.push({
      id: elementId,
      type: 'linespace',
      x: 10,
      y: this.currentY,
      width: this.paperWidth - 20,
      height: 20,
      data: { space },
      startY: this.currentY,
      endY: this.currentY + 20
    });
    
    // Draw the styling element as grayed out text
    this.ctx.save();
    this.ctx.font = '12px monospace';
    this.ctx.fillStyle = '#999';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`[Line Spacing: ${space}px]`, 10, this.currentY);
    this.ctx.restore();
    this.currentY += 20;
    this.ensureCanvasHeight(this.currentY);
  }

  addBarcode(data: string, type: BarcodeType, options?: BarcodeOptions): void {
    const barcodeHeight = options?.height || 100;
    const startY = this.currentY;
    this.ensureCanvasHeight(this.currentY + barcodeHeight + 20);
    this.ctx.save();
    this.ctx.strokeStyle = 'black';
    this.ctx.strokeRect(10, this.currentY, this.paperWidth - 20, barcodeHeight);
    this.ctx.font = '12px monospace';
    this.ctx.fillStyle = 'black';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`[${type} Barcode: ${data}]`, this.paperWidth / 2, this.currentY + barcodeHeight / 2);
    this.ctx.restore();
    const endY = this.currentY + barcodeHeight + 20;
    
    // Track the barcode element
    const elementId = `barcode_${++this.elementIdCounter}`;
    this.elements.push({
      id: elementId,
      type: 'barcode',
      x: 10,
      y: startY,
      width: this.paperWidth - 20,
      height: barcodeHeight + 20,
      data: { data, type, options },
      startY,
      endY
    });
    
    this.currentY = endY;
  }

  addQRCode(data: string, options?: QRCodeOptions): void {
    const size = options?.size || 200;
    const startY = this.currentY;
    this.ensureCanvasHeight(this.currentY + size + 20);
    this.ctx.save();
    this.ctx.strokeStyle = 'black';
    this.ctx.strokeRect(
      (this.paperWidth - size) / 2,
      this.currentY,
      size,
      size
    );
    this.ctx.font = '12px monospace';
    this.ctx.fillStyle = 'black';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('[QR Code]', this.paperWidth / 2, this.currentY + size / 2);
    this.ctx.restore();
    const endY = this.currentY + size + 20;
    
    // Track the QR code element
    const elementId = `qrcode_${++this.elementIdCounter}`;
    this.elements.push({
      id: elementId,
      type: 'qrcode',
      x: (this.paperWidth - size) / 2,
      y: startY,
      width: size,
      height: size + 20,
      data: { data, options },
      startY,
      endY
    });
    
    this.currentY = endY;
  }

  addImage(imageData: ImageData, options?: ImageOptions): void {
    const width = options?.width || imageData.width;
    const height = options?.height || (imageData.height * (width / imageData.width));
    const startY = this.currentY;
    this.ensureCanvasHeight(this.currentY + height + 20);
    let x = 0;
    switch (options?.alignment || 'left') {
      case 'center':
        x = (this.paperWidth - width) / 2;
        break;
      case 'right':
        x = this.paperWidth - width;
        break;
    }
    const imgCanvas = document.createElement('canvas');
    imgCanvas.width = imageData.width;
    imgCanvas.height = imageData.height;
    const imgCtx = imgCanvas.getContext('2d');
    if (!imgCtx) throw new Error('Could not get image canvas context');
    imgCtx.putImageData(imageData, 0, 0);
    this.ctx.drawImage(imgCanvas, x, this.currentY, width, height);
    const endY = this.currentY + height + 20;
    
    // Track the image element
    const elementId = `image_${++this.elementIdCounter}`;
    this.elements.push({
      id: elementId,
      type: 'image',
      x,
      y: startY,
      width,
      height: height + 20,
      data: { imageData, options },
      startY,
      endY
    });
    
    this.currentY = endY;
  }

  cutPaper(): void {
    const startY = this.currentY;
    this.ctx.save();
    this.ctx.setLineDash([10, 5]);
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.currentY);
    this.ctx.lineTo(this.paperWidth, this.currentY);
    this.ctx.strokeStyle = '#666';
    this.ctx.stroke();
    this.ctx.restore();
    this.currentY += 20;
    this.ensureCanvasHeight(this.currentY);
    
    // Track the cut element
    const elementId = `cut_${++this.elementIdCounter}`;
    this.elements.push({
      id: elementId,
      type: 'cut',
      x: 0,
      y: startY,
      width: this.paperWidth,
      height: 20,
      data: {},
      startY,
      endY: this.currentY
    });
  }
}


