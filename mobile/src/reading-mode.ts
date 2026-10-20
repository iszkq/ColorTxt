import { Capacitor, registerPlugin, SystemBars } from '@capacitor/core';

const ReadingMode = registerPlugin<{ setImmersive(options: { enabled: boolean }): Promise<void> }>('ReadingMode');

export async function setReadingMode(enabled: boolean) {
  if (Capacitor.getPlatform() === 'ios') {
    // Capacitor owns the Home indicator override; use its bundled public API.
    if (enabled) await SystemBars.hide({ animation: 'NONE' });
    else await SystemBars.show({ animation: 'NONE' });
  } else if (Capacitor.getPlatform() === 'android') {
    await ReadingMode.setImmersive({ enabled });
  }
}
