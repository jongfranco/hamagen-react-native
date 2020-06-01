import { NativeEventEmitter, Clipboard, Alert } from 'react-native';
import AsyncStorage from '@react-native-community/async-storage';
// @ts-ignore
import SpecialBle from 'rn-contact-tracing';
import { IS_IOS } from '../constants/Constants';
import { onError } from './ErrorService';
import { downloadAndVerifySigning } from './SigningService';
import config from '../config/config';

export const initBLETracing = () => new Promise(async (resolve) => {
  try {
    const UUID = '00000000-0000-1000-8000-00805F9B34FB';

    // TODO move to config
    let config: any = {
      serviceUUID: UUID,
      scanDuration: 60000,
      scanInterval: 240000,
      advertiseInterval: 50000,
      advertiseDuration: 10000,
      token: 'default_token'
    };

    if (!IS_IOS) {
      config = {
        ...config,
        advertiseMode: 0,
        advertiseTXPowerLevel: 3,
        scanMatchMode: 1,
        notificationTitle: '',
        notificationContent: 'סריקת BLE פועלת',
        notificationLargeIconPath: '../assets/main/moreInfoBig.png',
        notificationSmallIconPath: '../assets/main/moreInfo.png'
      };
    }

    await SpecialBle.setConfig(config);
    await SpecialBle.startBLEService();

    resolve();
  } catch (error) {
    resolve();
    onError({ error });
  }
});

export const registerBLEListeners = () => {
  const eventEmitter = new NativeEventEmitter(SpecialBle);
  eventEmitter.addListener('scanningStatus', (status) => {
    // TODO handle ble event
  });

  eventEmitter.addListener('advertisingStatus', (status) => {
    // TODO handle ble event
  });
};

export const fetchInfectionDataByConsent = async () => new Promise(async (resolve) => {
  try {
    SpecialBle.fetchInfectionDataByConsent((res: any) => {
      const parsedRes = JSON.parse(res || '[]');
      resolve(parsedRes);
    });
  } catch (error) {
    resolve([]);
    onError({ error });
  }
});

export const match = async () => new Promise(async (resolve) => {
  try {
    const responseJson = await downloadAndVerifySigning(config().BleDataUrl_utc);

    SpecialBle.match(JSON.stringify(responseJson), (res: string) => {
      const parsedRes: any[] = JSON.parse(res || '[]');
    
      resolve(parsedRes);
    });
  } catch (error) {
    resolve([]);
    onError({ error });
  }
});