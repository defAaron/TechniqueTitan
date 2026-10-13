const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

/** Center-crop to a square JPEG small enough for the avatars bucket. */
export function imageFileToAvatarBlob(file: File): Promise<Blob> {
  if (file.type && !ACCEPTED_TYPES.has(file.type)) {
    return Promise.reject(new Error('Choose a JPEG, PNG, or WebP image.'))
  }
  if (file.size > 8 * 1024 * 1024) {
    return Promise.reject(new Error('Image must be 8 MB or smaller.'))
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const size = 256
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('Could not process that image.'))
        return
      }
      const side = Math.min(img.naturalWidth, img.naturalHeight)
      const sx = (img.naturalWidth - side) / 2
      const sy = (img.naturalHeight - side) / 2
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url)
          if (!blob) reject(new Error('Could not process that image.'))
          else resolve(blob)
        },
        'image/jpeg',
        0.85,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image.'))
    }
    img.src = url
  })
}
