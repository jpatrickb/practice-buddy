/** iOS silent-switch handling and context resume. */
declare global {
  interface Navigator {
    audioSession?: { type: string };
  }
}

let silent: HTMLAudioElement | null = null;

/** Route audio as "playback" so the ring/silent switch does not mute it. Call from a user gesture. */
export function enterPlaybackSession() {
  if (typeof navigator === 'undefined') return;
  if (navigator.audioSession) {
    try {
      navigator.audioSession.type = 'playback';
    } catch {
      /* ignore */
    }
    return;
  }
  // Older iOS: a looping silent <audio> element moves the page to the playback category.
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    if (!silent) {
      // 44-byte WAV header + 1 silent sample
      const wav = new Uint8Array([
        82, 73, 70, 70, 38, 0, 0, 0, 87, 65, 86, 69, 102, 109, 116, 32, 16, 0, 0, 0, 1, 0, 1, 0, 68,
        172, 0, 0, 136, 88, 1, 0, 2, 0, 16, 0, 100, 97, 116, 97, 2, 0, 0, 0, 0, 0,
      ]);
      silent = new Audio(URL.createObjectURL(new Blob([wav], { type: 'audio/wav' })));
      silent.loop = true;
    }
    void silent.play().catch(() => undefined);
  }
}

export function leavePlaybackSession() {
  silent?.pause();
}

/** Resume a suspended/interrupted context on the first gesture (and after iOS interruptions). */
export function resumeOnGesture(ctx: AudioContext): () => void {
  const events = ['pointerdown', 'touchend', 'keydown'] as const;
  const resume = () => {
    if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
  };
  events.forEach((e) => document.addEventListener(e, resume, { passive: true }));
  ctx.addEventListener('statechange', resume);
  return () => {
    events.forEach((e) => document.removeEventListener(e, resume));
    ctx.removeEventListener('statechange', resume);
  };
}
