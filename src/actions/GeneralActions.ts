import AsyncStorage from '@react-native-community/async-storage';
import moment from 'moment';
import BackgroundGeolocation from 'react-native-background-geolocation';
import DeviceInfo from 'react-native-device-info';
import { check, PERMISSIONS, PermissionStatus, RESULTS } from 'react-native-permissions';
import config from '../config/config';
import {
  ENABLE_BLE,
  HIDE_LOCATION_HISTORY,


  SET_ONBOARDING_STATE, SHOW_FORCE_TERMS,
  SHOW_FORCE_UPDATE,
  SHOW_MAP_MODAL, TOGGLE_LOADER,
  TOGGLE_WEBVIEW,
  USER_DISABLED_BATTERY
} from '../constants/ActionTypes';
import {
  CURRENT_TERMS_VERSION,
  ENABLE_BLE as ENABLE_BLE_IN_APP,
  FIRST_POINT_TS,
  IS_IOS,
  SHOULD_HIDE_LOCATION_HISTORY,
  USER_AGREED_TO_BATTERY,
  USER_AGREE_TO_BLE
} from '../constants/Constants';
import { onError } from '../services/ErrorService';
import { downloadAndVerifySigning } from '../services/SigningService';
import { Exposure } from '../types';


export const toggleLoader = (isShow: boolean) => (dispatch: any) => dispatch({ type: TOGGLE_LOADER, payload: { isShow } });

export const toggleWebview = (isShow: boolean, usageType: string) => (dispatch: any) => dispatch({ type: TOGGLE_WEBVIEW, payload: { isShow, usageType } });

export const checkForceUpdate = () => async (dispatch: any) => {
  try {
    const { v2: { ios, android, shouldForceIOS, shouldForceAndroid, terms } } = await downloadAndVerifySigning(config().versionsUrl);

    const termsVersion = JSON.parse(await AsyncStorage.getItem(CURRENT_TERMS_VERSION) || '0');

    if (!termsVersion) {
      await AsyncStorage.setItem(CURRENT_TERMS_VERSION, JSON.stringify(terms));
    } else if ((termsVersion !== 0) && (termsVersion < terms)) {
      return dispatch({ type: SHOW_FORCE_TERMS, payload: { terms } });
    }

    const serverVersion = (IS_IOS ? ios : android).split('.').map((level: string) => parseFloat(level));
    const appVersion = DeviceInfo.getVersion().split('.').map((level: string) => parseFloat(level));
    const shouldForce = IS_IOS ? shouldForceIOS : shouldForceAndroid;

    if (isOlderVersion(serverVersion, appVersion)) {
      dispatch({ type: SHOW_FORCE_UPDATE, payload: { shouldForce } });
    }
  } catch (error) {
    onError({ error });
  }
};

const isOlderVersion = (serverVersion: number[], appVersion: number[]) => {
  for (let i = 0; i < serverVersion.length; i++) {
    if (appVersion[i] > serverVersion[i]) {
      return false;
    }

    if (serverVersion[i] > appVersion[i]) {
      return true;
    }
  }

  return false;
};

export const checkIfHideLocationHistory = () => async (dispatch: any) => {
  try {
    const firstPointTS = JSON.parse(await AsyncStorage.getItem(FIRST_POINT_TS) || 'false');
    const shouldHide = await AsyncStorage.getItem(SHOULD_HIDE_LOCATION_HISTORY);

    if (shouldHide || (firstPointTS && (moment().diff(moment(firstPointTS), 'days') > 14))) {
      dispatch({ type: HIDE_LOCATION_HISTORY });
    }
  } catch (error) {
    onError({ error });
  }
};


export const checkIfBleEnabled = () => async (dispatch: any) => {
  let payload: string | null = 'false';
  try {
    // check if permission changed
    if (IS_IOS) {
      const BTCheckStatus: PermissionStatus = await check(PERMISSIONS.IOS.BLUETOOTH_PERIPHERAL);
      
      switch (BTCheckStatus) {
        case RESULTS.UNAVAILABLE: {
          payload = RESULTS.BLOCKED;
          break;
        }
        case RESULTS.BLOCKED: {
          payload = RESULTS.BLOCKED;
          break;
        }
        case RESULTS.GRANTED: {
          if (ENABLE_BLE_IN_APP) {
            const res = await AsyncStorage.getItem(USER_AGREE_TO_BLE);
            if (res) {
              payload = res;
            } else {
              payload = 'true';
            }
          }
          break;
        }
        case RESULTS.DENIED: {
          // if you can ask permission again change to null to ask again
          payload = null;
        }
      }
    } else if (ENABLE_BLE_IN_APP) {
      payload = await AsyncStorage.getItem(USER_AGREE_TO_BLE);
    }
  } catch (error) {
    onError({ error });
    payload = 'false';
  } finally {
    dispatch({ type: ENABLE_BLE, payload });
  }
};

// battery optimization for android phones
export const checkIfBatteryDisabled = () => async (dispatch: any) => {
  let payload: boolean | null = false;
  try {
    if (!IS_IOS) {
      const userAgreed: string | null = await AsyncStorage.getItem(USER_AGREED_TO_BATTERY);
      const isIgnoring = await BackgroundGeolocation.deviceSettings.isIgnoringBatteryOptimizations();

      if (userAgreed) {
        if (userAgreed !== isIgnoring.toString()) {
          await AsyncStorage.setItem(USER_AGREED_TO_BATTERY, isIgnoring.toString());
        }
        payload = isIgnoring;
      } else {
        payload = null;
      }
    }
  } catch (error) {
    onError({ error });
  } finally {
    dispatch({ type: USER_DISABLED_BATTERY, payload });
  }
};


export const showMapModal = ({ properties }: Exposure) => {
  let latitude = 0;
  let longitude = 0;

  if (typeof properties.lat === 'string') { latitude = parseFloat(properties.lat); } else if (typeof properties.lat === 'number') { latitude = properties.lat; }

  if (typeof properties.long === 'string') { longitude = parseFloat(properties.long); } else if (typeof properties.long === 'number') { longitude = properties.long; }

  return ({
    type: SHOW_MAP_MODAL,
    payload: {
      properties,
      region: {
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.001,
      }
    }
  });
};

export const setOnboardingRoutes = (payload: boolean) => ({
  type: SET_ONBOARDING_STATE,
  payload
});
