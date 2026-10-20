const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

const MAX_INPUT_BYTES = 8 * 1024 * 1024
/** Matches the public avatars bucket file_size_limit. */
const MAX_UPLOAD_BYTES = 512 * 1024
const USER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function sniffedImageType(header: Uint8Array): string | null {
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    header.length >= 8 &&
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47 &&
    header[4] === 0x0d &&
    header[5] === 0x0a &&
    header[6] === 0x1a &&
    header[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (
    header.length >= 12 &&
    header[0] === 0x52 &&
    header[1] === 0x49 &&
    header[2] === 0x46 &&
    header[3] === 0x46 &&
    header[8] === 0x57 &&
    header[9] === 0x45 &&
    header[10] === 0x42 &&
    header[11] === 0x50
  ) {
    return 'image/webp'
  }
  if (
    header.length >= 6 &&
    header[0] === 0x47 &&
    header[1] === 0x49 &&
    header[2] === 0x46 &&
    header[3] === 0x38 &&
    (header[4] === 0x37 || header[4] === 0x39) &&
    header[5] === 0x61
  ) {
    return 'image/gif'
  }
  return null
}

/** Storage key stays `{uuid}/avatar.jpg`. Rejects ids that could add extra segments. */
export function avatarStoragePath(userId: string): string {
  if (!USER_ID_RE.test(userId)) {
    throw new Error('Could not save your profile.')
  }
  return `${userId}/avatar.jpg`
}

/** The upload is the re-encoded JPEG, not the original file. */
export async function assertJpegAvatarBlob(file: Blob): Promise<void> {
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Could not process that image.')
  }
  if (file.type && file.type !== 'image/jpeg') {
    throw new Error('Choose a JPEG, PNG, or WebP image.')
  }
  const header = new Uint8Array(await file.slice(0, 3).arrayBuffer())
  if (header.length < 3 || header[0] !== 0xff || header[1] !== 0xd8 || header[2] !== 0xff) {
    throw new Error('Choose a JPEG, PNG, or WebP image.')
  }
}

/** Center-crop to a square JPEG small enough for the avatars bucket. */
export async function imageFileToAvatarBlob(file: File): Promise<Blob> {
  if (file.size > MAX_INPUT_BYTES) {
    return Promise.reject(new Error('Image must be 8 MB or smaller.'))
  }
  if (file.size <= 0) {
    return Promise.reject(new Error('Could not read that image.'))
  }
  if (file.type && !ACCEPTED_TYPES.has(file.type)) {
    return Promise.reject(new Error('Choose a JPEG, PNG, or WebP image.'))
  }
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const detected = sniffedImageType(header)
  if (!detected || (file.type && file.type !== detected)) {
    return Promise.reject(new Error('Choose a JPEG, PNG, or WebP image.'))
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
          if (!blob || blob.size <= 0 || blob.size > MAX_UPLOAD_BYTES) {
            reject(new Error('Could not process that image.'))
          } else resolve(blob)
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
