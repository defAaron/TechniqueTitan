/** Browser MediaPipe Hands helper for live landmark scoring. */

import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision'
import type { LandmarkHand } from './api'

let landmarkerPromise: Promise<HandLandmarker> | null = null

async function getLandmarker(): Promise<HandLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm',
      )
      return HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
      })
    })()
  }
  return landmarkerPromise
}

export function resultToHands(result: HandLandmarkerResult): LandmarkHand[] {
  const hands: LandmarkHand[] = []
  const landmarks = result.landmarks ?? []
  const world = result.worldLandmarks ?? []
  const handedness = result.handednesses ?? []

  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i]
    const category = handedness[i]?.[0]
    // MediaPipe JS handedness is from the subject's perspective when mirrored;
    // map to Left/Right strings expected by the Python scorer.
    const label = (category?.categoryName === 'Left' ? 'Left' : 'Right') as
      | 'Left'
      | 'Right'
    hands.push({
      landmarks: lm.map((p) => [p.x, p.y, p.z]),
      world_landmarks: world[i]?.map((p) => [p.x, p.y, p.z]) ?? null,
      handedness: label,
      confidence: category?.score ?? 1,
    })
  }
  return hands
}

export async function detectHandsVideo(
  video: HTMLVideoElement,
  timestampMs: number,
): Promise<LandmarkHand[]> {
  const landmarker = await getLandmarker()
  const result = landmarker.detectForVideo(video, timestampMs)
  return resultToHands(result)
}

/** Draw skeleton overlays from server-returned landmarks + severity colors. */
export function drawHandOverlays(
  ctx: CanvasRenderingContext2D,
  hands: Array<{ landmarks: number[][]; color: string; marker: string }>,
  width: number,
  height: number,
) {
  const connections: Array<[number, number]> = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12],
    [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20],
    [5, 9], [9, 13], [13, 17],
  ]

  for (const hand of hands) {
    const pts = hand.landmarks.map(([x, y]) => [x * width, y * height] as const)
    ctx.strokeStyle = hand.color
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    for (const [a, b] of connections) {
      ctx.beginPath()
      ctx.moveTo(pts[a][0], pts[a][1])
      ctx.lineTo(pts[b][0], pts[b][1])
      ctx.stroke()
    }
    for (const [x, y] of pts) {
      ctx.beginPath()
      ctx.fillStyle = '#f2f4f8'
      ctx.arc(x, y, 3.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = hand.color
      ctx.stroke()
    }
    if (hand.marker && pts[0]) {
      ctx.font = 'bold 18px "Space Grotesk", sans-serif'
      ctx.fillStyle = hand.color
      ctx.fillText(hand.marker, pts[0][0] - 8, pts[0][1] + 28)
    }
  }
}

export function severityHex(severity: string): string {
  switch (severity) {
    case 'good':
      return '#34d399'
    case 'warning':
      return '#fbbf24'
    case 'critical':
      return '#f87171'
    default:
      return '#98a1b3'
  }
}
