export function formatTime(sec: number): string {
  const t = Math.max(0, Math.floor(sec));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export const speedLabel = (rate: number) => `${rate.toFixed(2).replace(/0$/, '')}×`;
