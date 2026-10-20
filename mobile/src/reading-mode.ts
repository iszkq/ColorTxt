import { Capacitor, registerPlugin } from '@capacitor/core';

const ReadingMode = registerPlugin<{ setImmersive(options: { enabled: boolean }): Promise<void> }>('ReadingMode');

export async function setReadingMode(enabled: boolean) {
  if (Capacitor.isNativePlatform()) await ReadingMode.setImmersive({ enabled });
}
