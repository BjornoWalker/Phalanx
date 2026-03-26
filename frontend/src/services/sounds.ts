const audioCache: Record<string, HTMLAudioElement> = {};

function getAudio(name: string): HTMLAudioElement {
  if (!audioCache[name]) {
    audioCache[name] = new Audio(`/sounds/${name}.mp3`);
  }
  return audioCache[name];
}

export function playMoveSound(): void {
  const audio = getAudio('Move');
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

export function playCaptureSound(): void {
  const audio = getAudio('Capture');
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

export function playNotifySound(): void {
  const audio = getAudio('GenericNotify');
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

export function playBlunderSound(): void {
  const audio = getAudio('GenericNotify');
  audio.currentTime = 0;
  audio.volume = 1.0;
  audio.play().catch(() => {});
}
