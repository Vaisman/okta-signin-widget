import DeviceTrust from 'util/DeviceTrust';

type TestWindow = Window & {
  chrome?: {
    enterprise?: {
      deviceTrust?: {
        getAttestation: (challengeRequest: string) => Promise<string>;
      };
    };
  };
};

describe('util/DeviceTrust', () => {
  const testWindow = window as TestWindow;
  let originalChrome: TestWindow['chrome'];

  beforeEach(() => {
    originalChrome = testWindow.chrome;
  });

  afterEach(() => {
    if (originalChrome) {
      testWindow.chrome = originalChrome;
    } else {
      delete testWindow.chrome;
    }
    jest.useRealTimers();
  });

  it('calls the Chromium enterprise Device Trust API', async () => {
    const getAttestation = jest.fn().mockResolvedValue('challenge_response');
    testWindow.chrome = {
      enterprise: {
        deviceTrust: { getAttestation },
      },
    };

    await expect(DeviceTrust.getAttestation('challenge_request'))
      .resolves.toBe('challenge_response');
    expect(getAttestation).toHaveBeenCalledWith('challenge_request');
  });

  it('waits for the Device Trust API to become available', async () => {
    jest.useFakeTimers();
    testWindow.chrome = undefined;

    const request = DeviceTrust.getAttestation('challenge_request');
    const getAttestation = jest.fn().mockResolvedValue('challenge_response');
    testWindow.chrome = {
      enterprise: {
        deviceTrust: { getAttestation },
      },
    };

    expect(getAttestation).not.toHaveBeenCalled();
    jest.advanceTimersByTime(50);

    await expect(request).resolves.toBe('challenge_response');
    expect(getAttestation).toHaveBeenCalledWith('challenge_request');
  });

  it('rejects when the API is unavailable after the discovery deadline', async () => {
    jest.useFakeTimers();
    testWindow.chrome = undefined;

    const request = DeviceTrust.getAttestation('challenge_request');
    const assertion = expect(request).rejects.toMatchObject({
      code: 'API_UNAVAILABLE',
      message: 'Timed out waiting for the Chrome Device Trust API.',
    });

    jest.advanceTimersByTime(2000);
    await assertion;
  });

  it('rejects immediately with an actionable error inside an iframe', async () => {
    const getAttestation = jest.fn().mockResolvedValue('challenge_response');
    testWindow.chrome = {
      enterprise: {
        deviceTrust: { getAttestation },
      },
    };
    spyOn(DeviceTrust, 'isTopLevelFrame').and.returnValue(false);

    const request = DeviceTrust.getAttestation('challenge_request');

    await expect(request).rejects.toMatchObject({
      code: 'UNSUPPORTED_FRAME',
      message: 'Chrome Device Trust is only available in the top-level frame.',
    });
    expect(DeviceTrust.getErrorMessageKey({ code: 'UNSUPPORTED_FRAME' }))
      .toBe('deviceTrust.error.unsupportedFrame');
    expect(getAttestation).not.toHaveBeenCalled();
  });

  it('converts a synchronous browser API exception into a rejection', async () => {
    const error = new Error('Browser call failed.');
    testWindow.chrome = {
      enterprise: {
        deviceTrust: {
          getAttestation: () => {
            throw error;
          },
        },
      },
    };

    await expect(DeviceTrust.getAttestation('challenge_request')).rejects.toBe(error);
  });
});
