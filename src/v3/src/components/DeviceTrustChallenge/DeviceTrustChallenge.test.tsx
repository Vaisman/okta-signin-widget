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

import { render, waitFor } from '@testing-library/preact';
import { h } from 'preact';
import { act } from 'preact/test-utils';

import { DeviceTrustChallengeElement, MessageType } from '../../types';
import DeviceTrustChallenge from './DeviceTrustChallenge';

const mockGetAttestation = jest.fn();
const mockGetErrorMessageKey = jest.fn();
const mockSetMessage = jest.fn();
const mockSubmit = jest.fn();

jest.mock('../../../../util/DeviceTrust', () => ({
  __esModule: true,
  default: {
    getAttestation: (challengeRequest: string) => mockGetAttestation(challengeRequest),
    getErrorMessageKey: (error: unknown) => mockGetErrorMessageKey(error),
  },
}));
jest.mock('../../../../util/Logger');
jest.mock('../../contexts', () => ({
  useWidgetContext: () => ({
    setMessage: mockSetMessage,
    widgetProps: {},
  }),
}));
jest.mock('../../hooks', () => ({
  useOnSubmit: () => mockSubmit,
}));

describe('DeviceTrustChallenge', () => {
  const uischema: DeviceTrustChallengeElement = {
    type: 'DeviceTrustChallenge',
    options: {
      challengeRequest: 'challenge_request',
      content: 'Verifying your identity',
      step: 'device-challenge-poll',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetErrorMessageKey.mockReturnValue('oform.error.unexpected');
  });

  it('submits the challenge response returned by the browser API', async () => {
    mockGetAttestation.mockResolvedValue('challenge_response');

    render(<DeviceTrustChallenge uischema={uischema} />);

    await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith({
      params: { challengeResponse: 'challenge_response' },
      step: 'device-challenge-poll',
    }));
    expect(mockGetAttestation).toHaveBeenCalledWith('challenge_request');
  });

  it('shows a localized error when device attestation fails', async () => {
    mockGetAttestation.mockRejectedValue(new Error('Device Trust API is unavailable.'));

    render(<DeviceTrustChallenge uischema={uischema} />);

    await waitFor(() => expect(mockSetMessage).toHaveBeenLastCalledWith({
      message: 'oform.error.unexpected',
      class: MessageType.ERROR,
      i18n: { key: 'oform.error.unexpected' },
    }));
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('shows an actionable error for an iframe deployment', async () => {
    const error = Object.assign(new Error('Unsupported frame.'), {
      code: 'UNSUPPORTED_FRAME',
    });
    mockGetAttestation.mockRejectedValue(error);
    mockGetErrorMessageKey.mockReturnValue('deviceTrust.error.unsupportedFrame');

    render(<DeviceTrustChallenge uischema={uischema} />);

    await waitFor(() => expect(mockSetMessage).toHaveBeenLastCalledWith({
      message: 'deviceTrust.error.unsupportedFrame',
      class: MessageType.ERROR,
      i18n: { key: 'deviceTrust.error.unsupportedFrame' },
    }));
    expect(mockGetErrorMessageKey).toHaveBeenCalledWith(error);
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('ignores an attestation response after unmount', async () => {
    let resolveAttestation: (response: string) => void = () => {};
    mockGetAttestation.mockReturnValue(new Promise((resolve) => {
      resolveAttestation = resolve;
    }));
    const { unmount } = render(<DeviceTrustChallenge uischema={uischema} />);

    unmount();
    await act(async () => {
      resolveAttestation('challenge_response');
    });

    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
