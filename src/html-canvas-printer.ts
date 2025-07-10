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

type ElementData = TextElementData | BarcodeElementData | QRCodeElementData | ImageElementData | FeedLineElementData | CutElementData;

interface CanvasElement {
  id: string;
  type: 'text' | 'barcode' | 'qrcode' | 'image' | 'feedline' | 'cut';
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

  // Remove an element by ID
  public removeElement(elementId: string): boolean {
    const index = this.elements.findIndex(el => el.id === elementId);
    if (index === -1) return false;
    
    this.elements.splice(index, 1);
    this.redrawCanvas();
    return true;
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
    
    // Redraw all remaining elements
    elementsToRedraw.forEach(element => {
      switch (element.type) {
        case 'text':
          this.redrawTextElement(element);
          break;
        case 'barcode':
          this.redrawBarcodeElement(element);
          break;
        case 'qrcode':
          this.redrawQRCodeElement(element);
          break;
        case 'image':
          this.redrawImageElement(element);
          break;
        case 'feedline':
          this.redrawFeedLineElement(element);
          break;
        case 'cut':
          this.redrawCutElement(element);
          break;
      }
    });
  }

  private redrawTextElement(element: CanvasElement): void {
    if (element.type !== 'text') return;
    const { text, style, alignment } = element.data as TextElementData;
    this.currentTextStyle = style || {};
    this.currentTextAlign = alignment || 'left';
    this.currentY = element.startY;
    
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
    this.currentY = element.startY;
    
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
    this.currentY = element.startY;
    
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
    this.currentY = element.startY;
    
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
    this.currentY = element.startY;
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
    this.currentY = element.startY;
    
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
  }

  addTextSize(width: number, height: number): void {
    this.currentTextSize = {
      width: Math.max(1, Math.min(8, width)),
      height: Math.max(1, Math.min(8, height))
    };
  }

  addTextStyle(style: TextStyle): void {
    this.currentTextStyle = { ...this.currentTextStyle, ...style };
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


