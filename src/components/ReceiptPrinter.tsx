'use client';

import React, { useEffect, useRef, useState } from 'react';
import { HTMLCanvasEpsonPrinter } from '../html-canvas-printer';
import type { EpsonPrinter } from '../interfaces/epson-printer';

interface ReceiptPrinterProps {
  width?: number;
  className?: string;
  onPrinterReady?: (printer: EpsonPrinter) => void;
}

interface CanvasElement {
  id: string;
  type: 'text' | 'barcode' | 'qrcode' | 'image' | 'feedline' | 'cut';
  x: number;
  y: number;
  width: number;
  height: number;
  data: unknown;
  startY: number;
  endY: number;
}

export const ReceiptPrinter: React.FC<ReceiptPrinterProps> = ({ 
  width = 576, // Standard 80-column receipt width (at 72dpi)
  className = '',
  onPrinterReady
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const printerRef = useRef<EpsonPrinter | null>(null);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);

  useEffect(() => {
    if (canvasRef.current && !printerRef.current) {
      const canvas = canvasRef.current;
      printerRef.current = new HTMLCanvasEpsonPrinter(canvas);
      if (onPrinterReady) {
        onPrinterReady(printerRef.current);
      }
    }
  }, [onPrinterReady]);

  // Update elements when printer changes
  useEffect(() => {
    const updateElements = () => {
      if (printerRef.current && 'getElements' in printerRef.current) {
        const printer = printerRef.current as HTMLCanvasEpsonPrinter;
        const newElements = printer.getElements();
        setElements(newElements);
      }
    };

    // Update elements periodically
    const interval = setInterval(updateElements, 100);
    return () => clearInterval(interval);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!overlayRef.current || !canvasRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find element under cursor
    const elementUnderCursor = elements.find(element => {
      // Add some padding for easier hovering
      const padding = 5;
      return x >= element.x - padding && x <= element.x + element.width + padding &&
             y >= element.y - padding && y <= element.y + element.height + padding;
    });

    setHoveredElement(elementUnderCursor?.id || null);
  };

  const handleMouseLeave = () => {
    setHoveredElement(null);
  };

  const handleRemoveElement = (elementId: string) => {
    if (printerRef.current && 'removeElement' in printerRef.current) {
      const printer = printerRef.current as HTMLCanvasEpsonPrinter;
      printer.removeElement(elementId);
      // Update elements after removal
      setTimeout(() => {
        const updatedElements = printer.getElements();
        setElements(updatedElements);
      }, 50);
    }
  };

  return (
    <div
      className={`receipt-printer ${className}`}
      style={{
        maxHeight: '600px',
        overflowY: 'auto',
        background: 'repeating-linear-gradient(0deg, #fafafa, #fff 40px, #fafafa 80px)',
        borderRadius: '16px',
        border: '2px solid #e0e0e0',
        boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
        padding: '20px',
        margin: '0 auto',
        width: `${width + 40}px`, // Add padding to width
        minWidth: `${width + 40}px`,
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
          padding: '10px',
          margin: '0 auto',
          width: `${width}px`,
        }}
      >
        <div
          ref={overlayRef}
          style={{
            position: 'relative',
            width: `${width}px`,
            minHeight: '200px',
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <canvas
            ref={canvasRef}
            width={width}
            height={1000} // Initial height, will grow as needed
            className="receipt-canvas"
            style={{
              width: `${width}px`,
              minHeight: '200px',
              display: 'block',
              margin: '0 auto',
              background: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}
          />
          
          {/* Overlay for remove buttons */}
          {elements.map((element) => (
            <div
              key={element.id}
              style={{
                position: 'absolute',
                left: element.x,
                top: element.y,
                width: element.width,
                height: element.height,
                pointerEvents: 'none',
                border: hoveredElement === element.id ? '2px solid #3b82f6' : 'none',
                borderRadius: hoveredElement === element.id ? '4px' : '0',
                backgroundColor: hoveredElement === element.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                transition: 'all 0.2s ease',
              }}
            >
              {hoveredElement === element.id && (
                <button
                  onClick={() => handleRemoveElement(element.id)}
                  className="absolute -top-3 -right-3 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg transition-colors duration-200 z-10 border-2 border-white"
                  style={{ pointerEvents: 'auto' }}
                  title="Remove element"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
