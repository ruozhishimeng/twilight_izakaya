import { useState, useEffect } from 'react';

export function useImagePreloader(imageUrls: string[]) {
  const [imagesPreloaded, setImagesPreloaded] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    let loadedCount = 0;

    if (imageUrls.length === 0) {
      setImagesPreloaded(true);
      return;
    }

    imageUrls.forEach((url) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        if (isCancelled) return;
        loadedCount++;
        if (loadedCount === imageUrls.length) {
          setImagesPreloaded(true);
        }
      };
      img.onerror = () => {
        if (isCancelled) return;
        loadedCount++;
        if (loadedCount === imageUrls.length) {
          setImagesPreloaded(true);
        }
      };
    });

    return () => {
      isCancelled = true;
    };
  }, [imageUrls]);

  return { imagesPreloaded };
}
