import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'io.colortxt.mobile', appName: '彩读', webDir: 'dist',
  backgroundColor: '#f6f7f9',
  ios: { contentInset: 'never', preferredContentMode: 'mobile' },
};
export default config;
