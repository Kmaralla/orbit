// Generates pleasant tones via Web Audio API — no files, no dependencies.
// Fails silently if browser blocks audio (e.g. autoplay policy).

let audioCtx = null

const getCtx = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  // Resume if suspended (required after inactivity on some browsers)
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

const playTone = (frequency, startOffset, duration, volume = 0.28) => {
  try {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.type = 'triangle' // softer, more musical than sine
    osc.frequency.setValueAtTime(frequency, ctx.currentTime + startOffset)

    // Smooth attack + exponential release — no click artifacts
    const start = ctx.currentTime + startOffset
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(volume, start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration)

    osc.start(start)
    osc.stop(start + duration + 0.01)
  } catch {
    // Fail silently — audio blocked or not supported
  }
}

// Two-note ascending chime for checkbox completion: D5 → G5
export const playCheckSound = () => {
  playTone(587.33, 0,    0.14, 0.28) // D5
  playTone(783.99, 0.09, 0.20, 0.22) // G5
}

// Single soft chime for score/number log: C5
export const playLogSound = () => {
  playTone(523.25, 0, 0.16, 0.18) // C5, quieter
}
