"use client";

/**
 * FinWatch Zambia - Image Cropper Modal
 */

import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { X, Check, ZoomIn, ZoomOut, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import getCroppedImg from "@/lib/crop-image";
import { cn } from "@/lib/utils";

interface ImageCropperModalProps {
  image: string;
  onClose: () => void;
  onComplete: (croppedImage: Blob) => void;
  portal: "sme" | "regulator" | "analyst";
}

export function ImageCropperModal({
  image,
  onClose,
  onComplete,
  portal,
}: ImageCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const onCropComplete = useCallback(
    (_croppedArea: any, croppedAreaPixels: any) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleSave = async () => {
    try {
      setLoading(true);
      const croppedImage = await getCroppedImg(image, croppedAreaPixels);
      if (croppedImage) {
        onComplete(croppedImage);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const theme = {
    sme: "bg-purple-600 hover:bg-purple-700 shadow-purple-500/20",
    regulator: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20",
    analyst: "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20",
  }[portal];

  const accentText = {
    sme: "text-purple-600 dark:text-purple-400",
    regulator: "text-emerald-600 dark:text-emerald-400",
    analyst: "text-blue-600 dark:text-blue-400",
  }[portal];

  return (
    <div className="fixed inset-0 z-[500] flex items-start justify-center p-4 sm:p-6 overflow-y-auto bg-black/80 animate-in fade-in duration-300 py-10 md:py-12">
      {/* Click-outside backdrop */}
      <div className="fixed inset-0 z-[-1]" onClick={onClose} />

      <div className="bg-white dark:bg-zinc-950 w-full max-w-2xl rounded-[32px] border border-gray-100 dark:border-zinc-800 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] flex flex-col relative my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-50 dark:border-zinc-900 flex items-center justify-between sticky top-0 bg-white dark:bg-zinc-950 z-20 rounded-t-[32px]">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2 rounded-xl bg-gray-50 dark:bg-zinc-900",
                accentText
              )}
            >
              <Move size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100">
                Adjust Profile Photo
              </h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                Crop & Position
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-900 text-gray-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cropper Body */}
        <div className="relative w-full h-[350px] sm:h-[450px] md:h-[500px] bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
            cropShape="round"
            showGrid={false}
          />
        </div>

        {/* Controls */}
        <div className="p-6 space-y-6 bg-gray-50/50 dark:bg-zinc-900/30 rounded-b-[32px]">
          <div className="flex items-center gap-4">
            <ZoomOut size={16} className="text-gray-400" />
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e: any) => setZoom(e.target.value)}
              className="w-full h-1.5 bg-gray-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
            <ZoomIn size={16} className="text-gray-400" />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full sm:flex-1 rounded-2xl h-12 font-bold text-xs"
            >
              Cancel
            </Button>
            <Button
              disabled={loading}
              onClick={handleSave}
              className={cn(
                "w-full sm:flex-1 rounded-2xl h-12 font-bold text-xs text-white transition-all active:scale-[0.98]",
                theme
              )}
            >
              {loading ? (
                "Processing..."
              ) : (
                <>
                  Set Profile Picture <Check size={16} className="ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
