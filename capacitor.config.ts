import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.iqbaldrughouse.pharmacypos',
  appName: 'Iqbal Drug House',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
