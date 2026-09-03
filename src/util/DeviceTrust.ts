/*
 * Copyright (c) 2026-present, Okta, Inc. and/or its affiliates. All rights reserved.
 * The Okta software accompanied by this notice is provided pursuant to the Apache License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and limitations under the License.
 */

const API_UNAVAILABLE_ERROR_CODE = 'API_UNAVAILABLE';
const UNSUPPORTED_FRAME_ERROR_CODE = 'UNSUPPORTED_FRAME';
const UNSUPPORTED_FRAME_I18N_KEY = 'deviceTrust.error.unsupportedFrame';
const DEFAULT_ERROR_I18N_KEY = 'oform.error.unexpected';
const API_DISCOVERY_INTERVAL_MS = 50;
const API_DISCOVERY_TIMEOUT_MS = 2000;

interface DeviceTrustClient {
  isTopLevelFrame(): boolean;
  getErrorMessageKey(error: unknown): string;
  getAttestation(challengeRequest: string): Promise<string>;
}

interface DeviceTrustApi {
  getAttestation(challengeRequest: string): Promise<string>;
}

type DeviceTrustWindow = Window & {
  chrome?: {
    enterprise?: {
      deviceTrust?: DeviceTrustApi;
    };
  };
};

class DeviceTrustClientError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DeviceTrustClientError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const getDeviceTrustApi = (): DeviceTrustApi | undefined => {
  const deviceTrust = (window as DeviceTrustWindow).chrome?.enterprise?.deviceTrust;
  return typeof deviceTrust?.getAttestation === 'function'
    ? deviceTrust
    : undefined;
};

// Chromium installs the page API asynchronously after the main frame becomes available.
// Bound discovery so a missing browser integration still fails promptly.
const waitForDeviceTrustApi = (): Promise<DeviceTrustApi> => {
  const deviceTrust = getDeviceTrustApi();
  if (deviceTrust) {
    return Promise.resolve(deviceTrust);
  }

  return new Promise((resolve, reject) => {
    let pollTimer = 0;
    const timeoutTimer = window.setTimeout(() => {
      window.clearTimeout(pollTimer);
      reject(new DeviceTrustClientError(
        API_UNAVAILABLE_ERROR_CODE,
        'Timed out waiting for the Chrome Device Trust API.',
      ));
    }, API_DISCOVERY_TIMEOUT_MS);

    const checkForApi = () => {
      const availableApi = getDeviceTrustApi();
      if (availableApi) {
        window.clearTimeout(timeoutTimer);
        resolve(availableApi);
        return;
      }

      pollTimer = window.setTimeout(checkForApi, API_DISCOVERY_INTERVAL_MS);
    };

    pollTimer = window.setTimeout(checkForApi, API_DISCOVERY_INTERVAL_MS);
  });
};

const getErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? code : undefined;
};

const DeviceTrust: DeviceTrustClient = {
  // Chromium intentionally exposes Device Trust only to the main frame. Check
  // this separately so iframe deployments get an actionable error instead of
  // being reported as a transient API availability failure.
  isTopLevelFrame: (): boolean => window.self === window.top,

  getErrorMessageKey: (error: unknown): string => (
    getErrorCode(error) === UNSUPPORTED_FRAME_ERROR_CODE
      ? UNSUPPORTED_FRAME_I18N_KEY
      : DEFAULT_ERROR_I18N_KEY
  ),

  getAttestation: (challengeRequest: string): Promise<string> => {
    if (!DeviceTrust.isTopLevelFrame()) {
      return Promise.reject(new DeviceTrustClientError(
        UNSUPPORTED_FRAME_ERROR_CODE,
        'Chrome Device Trust is only available in the top-level frame.',
      ));
    }

    return waitForDeviceTrustApi()
      .then((deviceTrust) => deviceTrust.getAttestation(challengeRequest));
  },
};

export default DeviceTrust;
