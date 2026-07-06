import { useState, useCallback } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  mode: 'view' | 'crop';
  onClose: () => void;
  onSave?: (croppedBlob: Blob) => Promise<void> | void;
}

/** Renders `imageSrc` into a canvas cropped to `pixelCrop`, capped to 500px for fast uploads. */
async function getCroppedImageBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const MAX_SIZE = 500;
      let targetWidth = pixelCrop.width;
      let targetHeight = pixelCrop.height;

      if (targetWidth > MAX_SIZE) {
        targetHeight = Math.round((targetHeight * MAX_SIZE) / targetWidth);
        targetWidth = MAX_SIZE;
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas 2D context is unavailable'));
        return;
      }

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        targetWidth,
        targetHeight
      );

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode image'))),
        'image/jpeg',
        0.88
      );
    };
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = imageSrc;
  });
}

export default function ImageCropModal({ isOpen, imageSrc, mode, onClose, onSave }: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels || !onSave) return;
    setIsProcessing(true);
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
      await onSave(blob);
    } catch (e) {
      console.error('Error cropping image:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !imageSrc) return null;

  if (mode === 'view') {
    return (
      <AnimatePresence>
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative', maxWidth: 420, width: '100%' }}
          >
            <img
              src={imageSrc}
              alt="Profile"
              style={{ width: '100%', borderRadius: '50%', aspectRatio: '1 / 1', objectFit: 'cover', boxShadow: 'var(--shadow-md)' }}
            />
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: -12,
                right: -12,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '50%',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <X size={18} />
            </button>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="modal"
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: '1.2rem' }}>Crop photo</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)' }}
            >
              <X size={20} />
            </button>
          </div>

          <div
            style={{
              position: 'relative',
              width: '100%',
              height: 300,
              background: 'var(--surface-sunken)',
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
            }}
          >
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>

          <div style={{ marginTop: 20 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 8 }}>
              Zoom
            </label>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              onChange={(e) => setZoom(Number(e.target.value))}
              style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent)' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button className="btn btn-secondary btn-block" onClick={onClose} disabled={isProcessing}>
              Cancel
            </button>
            <button className="btn btn-primary btn-block" onClick={handleSave} disabled={isProcessing || !croppedAreaPixels}>
              {isProcessing ? (
                'Saving…'
              ) : (
                <>
                  <Check size={16} /> Save photo
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
