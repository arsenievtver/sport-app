import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const CROP_SIZE = 280;
const OUTPUT_SIZE = 512;

interface AvatarCropModalProps {
  file: File;
  onCancel: () => void;
  onConfirm: (blob: Blob) => Promise<void>;
}

interface CropState {
  scale: number;
  minScale: number;
  offsetX: number;
  offsetY: number;
}

function clampAxisOffset(offset: number, axisSize: number): number {
  const minOffset = CROP_SIZE - axisSize;
  return Math.min(0, Math.max(minOffset, offset));
}

function exportCroppedImage(image: HTMLImageElement, scale: number, offsetX: number, offsetY: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Promise.reject(new Error("Canvas unavailable"));
  }

  const sourceSize = CROP_SIZE / scale;
  const sourceX = -offsetX / scale;
  const sourceY = -offsetY / scale;

  ctx.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Не удалось подготовить фото"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.9,
    );
  });
}

export function AvatarCropModal({ file, onCancel, onConfirm }: AvatarCropModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [crop, setCrop] = useState<CropState | null>(null);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const applyScale = useCallback((image: HTMLImageElement, minScale: number, nextZoom: number, prev?: CropState) => {
    const scale = minScale * nextZoom;
    const renderedW = image.naturalWidth * scale;
    const renderedH = image.naturalHeight * scale;
    setCrop({
      scale,
      minScale,
      offsetX: clampAxisOffset(prev?.offsetX ?? (CROP_SIZE - renderedW) / 2, renderedW),
      offsetY: clampAxisOffset(prev?.offsetY ?? (CROP_SIZE - renderedH) / 2, renderedH),
    });
  }, []);

  const initCrop = useCallback(
    (image: HTMLImageElement) => {
      imageRef.current = image;
      setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
      const minScale = Math.max(CROP_SIZE / image.naturalWidth, CROP_SIZE / image.naturalHeight);
      setZoom(1);
      applyScale(image, minScale, 1);
    },
    [applyScale],
  );

  const handleZoomChange = (nextZoom: number) => {
    setZoom(nextZoom);
    if (!imageRef.current || !crop) return;
    applyScale(imageRef.current, crop.minScale, nextZoom, crop);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!crop) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: crop.offsetX,
      offsetY: crop.offsetY,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !crop || !imageRef.current) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    const renderedW = imageRef.current.naturalWidth * crop.scale;
    const renderedH = imageRef.current.naturalHeight * crop.scale;
    setCrop({
      ...crop,
      offsetX: clampAxisOffset(dragRef.current.offsetX + dx, renderedW),
      offsetY: clampAxisOffset(dragRef.current.offsetY + dy, renderedH),
    });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleSave = async () => {
    if (!crop || !imageRef.current || saving) return;
    setSaving(true);
    setError(null);
    try {
      const blob = await exportCroppedImage(imageRef.current, crop.scale, crop.offsetX, crop.offsetY);
      await onConfirm(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить фото");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="avatar-crop" role="dialog" aria-modal="true" aria-label="Обрезка фото">
      <div className="avatar-crop__backdrop" onClick={onCancel} />
      <div className="avatar-crop__sheet glass glass--panel">
        <h2 className="avatar-crop__title">Фото профиля</h2>
        <p className="avatar-crop__hint">Перетащите и масштабируйте — в профиле будет квадрат.</p>

        <div
          className="avatar-crop__viewport"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {imageSrc ? (
            <img
              ref={imageRef}
              src={imageSrc}
              alt=""
              className="avatar-crop__image"
              draggable={false}
              style={
                crop
                  ? {
                      width: imageSize.width * crop.scale,
                      height: imageSize.height * crop.scale,
                      transform: `translate(${crop.offsetX}px, ${crop.offsetY}px)`,
                    }
                  : undefined
              }
              onLoad={(event) => initCrop(event.currentTarget)}
            />
          ) : null}
          <div className="avatar-crop__frame" aria-hidden="true" />
        </div>

        <label className="avatar-crop__zoom">
          <span>Масштаб</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => handleZoomChange(Number(event.target.value))}
          />
        </label>

        {error ? <p className="avatar-crop__error">{error}</p> : null}

        <div className="avatar-crop__actions">
          <button type="button" className="settings-btn settings-btn--ghost" onClick={onCancel} disabled={saving}>
            Отмена
          </button>
          <button
            type="button"
            className="settings-btn settings-btn--primary"
            onClick={() => void handleSave()}
            disabled={saving || !crop}
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
