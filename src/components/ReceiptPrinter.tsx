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
  type: 'text' | 'barcode' | 'qrcode' | 'image' | 'feedline' | 'cut' | 'textalign' | 'textsize' | 'textstyle' | 'linespace';
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
  const [draggedElement, setDraggedElement] = useState<string | null>(null);
  const [dragOverElement, setDragOverElement] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);

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

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, elementId: string) => {
    console.log('Drag start:', elementId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', elementId);
    setDraggedElement(elementId);
  };



  const handleDragEnd = () => {
    setDraggedElement(null);
    setDragOverElement(null);
    setDropPosition(null);
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
          
          {/* Drop zones for top and bottom of canvas */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '20px',
              pointerEvents: 'auto',
              backgroundColor: dragOverElement === 'top-zone' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              borderTop: dragOverElement === 'top-zone' ? '2px solid #3b82f6' : 'none',
              transition: 'all 0.2s ease',
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDragOverElement('top-zone');
              setDropPosition('before');
            }}
            onDragLeave={() => {
              if (dragOverElement === 'top-zone') {
                setDragOverElement(null);
                setDropPosition(null);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              const draggedElementId = e.dataTransfer.getData('text/plain');
              if (draggedElementId && printerRef.current && 'reorderElement' in printerRef.current) {
                const printer = printerRef.current as HTMLCanvasEpsonPrinter;
                printer.reorderElement(draggedElementId, 0);
                setTimeout(() => {
                  const updatedElements = printer.getElements();
                  setElements(updatedElements);
                }, 50);
              }
              setDraggedElement(null);
              setDragOverElement(null);
              setDropPosition(null);
            }}
          />
          
          <div
            style={{
              position: 'absolute',
              left: 0,
              bottom: 0,
              width: '100%',
              height: '20px',
              pointerEvents: 'auto',
              backgroundColor: dragOverElement === 'bottom-zone' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              borderBottom: dragOverElement === 'bottom-zone' ? '2px solid #3b82f6' : 'none',
              transition: 'all 0.2s ease',
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDragOverElement('bottom-zone');
              setDropPosition('after');
            }}
            onDragLeave={() => {
              if (dragOverElement === 'bottom-zone') {
                setDragOverElement(null);
                setDropPosition(null);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              const draggedElementId = e.dataTransfer.getData('text/plain');
              if (draggedElementId && printerRef.current && 'reorderElement' in printerRef.current) {
                const printer = printerRef.current as HTMLCanvasEpsonPrinter;
                const lastIndex = elements.length - 1;
                printer.reorderElement(draggedElementId, lastIndex);
                setTimeout(() => {
                  const updatedElements = printer.getElements();
                  setElements(updatedElements);
                }, 50);
              }
              setDraggedElement(null);
              setDragOverElement(null);
              setDropPosition(null);
            }}
          />
          
          {/* Single drop zone for the entire canvas */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'auto',
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              
              if (!overlayRef.current) return;
              
              const rect = overlayRef.current.getBoundingClientRect();
              const y = e.clientY - rect.top;
              
              // Find the element under the cursor
              const elementUnderCursor = elements.find(element => {
                return y >= element.y && y <= element.y + element.height;
              });
              
              if (elementUnderCursor) {
                const threshold = elementUnderCursor.height * 0.3;
                const position = y < (elementUnderCursor.y + threshold) ? 'before' : 'after';
                
                console.log('Drag over element:', { elementId: elementUnderCursor.id, y, elementY: elementUnderCursor.y, threshold, position });
                
                setDragOverElement(elementUnderCursor.id);
                setDropPosition(position);
              } else {
                setDragOverElement(null);
                setDropPosition(null);
              }
            }}
            onDragLeave={() => {
              setDragOverElement(null);
              setDropPosition(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const draggedElementId = e.dataTransfer.getData('text/plain');
              
              console.log('Drop event:', { draggedElementId, dragOverElement, dropPosition });
              
              if (draggedElementId && dragOverElement && draggedElementId !== dragOverElement && printerRef.current && 'reorderElement' in printerRef.current) {
                const printer = printerRef.current as HTMLCanvasEpsonPrinter;
                const targetIndex = elements.findIndex(el => el.id === dragOverElement);
                const draggedIndex = elements.findIndex(el => el.id === draggedElementId);
                
                console.log('Indexes:', { targetIndex, draggedIndex, elementsLength: elements.length });
                
                if (targetIndex !== -1 && draggedIndex !== -1) {
                  let newIndex: number;
                  
                  // Simple logic: if dropping "after", move to the next position
                  if (dropPosition === 'after') {
                    newIndex = targetIndex + 1;
                  } else {
                    // If dropping "before", move to the current position
                    newIndex = targetIndex;
                  }
                  
                  // Adjust for the fact that we're removing the element first
                  if (draggedIndex < newIndex) {
                    newIndex -= 1;
                  }
                  
                  // Ensure the new index is within bounds
                  newIndex = Math.max(0, Math.min(newIndex, elements.length - 1));
                  
                  console.log('Reordering:', { draggedElementId, newIndex });
                  
                  const success = printer.reorderElement(draggedElementId, newIndex);
                  console.log('Reorder result:', success);
                  
                  // Update elements after reordering
                  setTimeout(() => {
                    const updatedElements = printer.getElements();
                    console.log('Updated elements:', updatedElements.length);
                    setElements(updatedElements);
                  }, 50);
                }
              }
              
              setDraggedElement(null);
              setDragOverElement(null);
              setDropPosition(null);
            }}
          />
          
          {/* Overlay for remove buttons and drag handles */}
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
                opacity: draggedElement === element.id ? 0.5 : 1,
              }}
            >
              {/* Drop position indicator */}
              {dragOverElement === element.id && draggedElement && draggedElement !== element.id && (
                <>
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: dropPosition === 'before' ? -2 : element.height - 2,
                      width: '100%',
                      height: '4px',
                      backgroundColor: '#3b82f6',
                      borderRadius: '2px',
                      zIndex: 20,
                      pointerEvents: 'none',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: dropPosition === 'before' ? -10 : element.height + 2,
                      transform: 'translateX(-50%)',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      zIndex: 21,
                      pointerEvents: 'none',
                    }}
                  >
                    {dropPosition}
                  </div>
                </>
              )}
              {hoveredElement === element.id && (
                <>
                  <button
                    onClick={() => handleRemoveElement(element.id)}
                    className="absolute -top-3 -right-3 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg transition-colors duration-200 z-10 border-2 border-white"
                    style={{ pointerEvents: 'auto' }}
                    title="Remove element"
                  >
                    ×
                  </button>
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, element.id)}
                    onDragEnd={handleDragEnd}
                    className="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg transition-colors duration-200 z-10 border-2 border-white cursor-move"
                    style={{ pointerEvents: 'auto' }}
                    title="Drag to reorder"
                  >
                    ⋮⋮
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
