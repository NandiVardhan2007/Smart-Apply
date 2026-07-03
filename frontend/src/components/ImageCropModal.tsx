import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  mode: 'view' | 'crop';
  onClose: () => void;
  onSave?: (croppedBlob: Blob) => Promise<void> | void;
}

// Utility to create a cropped image from the original image and crop area
const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      // Cap avatar size to 500x500 for faster uploads
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
        return reject(new Error('No 2d context'));
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

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(blob);
      }, 'image/jpeg', 0.85);
    };
    image.onerror = (error) => reject(error);
    image.src = imageSrc;
  });
};

export default function ImageCropModal({ isOpen, imageSrc, mode, onClose, onSave }: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels || !onSave) return;
    setIsProcessing(true);
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      await onSave(croppedBlob);
    } catch (e) {
      console.error('Error cropping image:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !imageSrc) return null;

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
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          style={{
            maxWidth: mode === 'crop' ? '500px' : '400px',
            position: 'relative',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, textTransform: 'uppercase' }}>
              {mode === 'crop' ? 'Crop Photo' : 'Profile Photo'}
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#000',
              }}
            >
              <X size={24} />
            </button>
          </div>

          {mode === 'crop' ? (
            <div style={{ position: 'relative', width: '100%', height: '300px', background: '#f5f5f5', border: 'var(--border-thin)', overflow: 'hidden' }}>
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="rect"
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
          ) : (
            <div style={{ width: '100%', aspectRatio: '1/1', border: 'var(--border-thin)', overflow: 'hidden', background: '#000' }}>
              <img src={imageSrc} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}

          {mode === 'crop' && (
            <div style={{ marginTop: '20px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '8px' }}>Zoom</label>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => setZoom(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>
          )}

          {mode === 'crop' && (
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                className="btn btn-outline"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={onClose}
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={handleSave}
                disabled={isProcessing}
              >
                {isProcessing ? 'Saving...' : (
                  <>
                    <Check size={18} style={{ marginRight: '8px' }} />
                    Save Photo
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
