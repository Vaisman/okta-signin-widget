import { loc } from '@okta/courage';
import DeviceTrust from 'util/DeviceTrust';
import Logger from 'util/Logger';
import BaseOktaVerifyChallengeView from '../../../../../../src/v2/view-builder/internals/BaseOktaVerifyChallengeView';

describe('v2/internals/BaseOktaVerifyChallengeView', function() {
  let view;

  beforeEach(function() {
    view = {
      model: {
        set: jasmine.createSpy('set'),
        trigger: jasmine.createSpy('model.trigger'),
      },
      removed: false,
      stopPolling: jasmine.createSpy('stopPolling'),
      trigger: jasmine.createSpy('trigger'),
    };
  });

  it('submits the challenge response returned by the Device Trust API', async function() {
    spyOn(DeviceTrust, 'getAttestation').and.returnValue(Promise.resolve('challenge_response'));

    await BaseOktaVerifyChallengeView.prototype.doChromeDTCJS.call(
      view, { challengeRequest: 'challenge_request' }
    );

    expect(DeviceTrust.getAttestation).toHaveBeenCalledWith('challenge_request');
    expect(view.model.set).toHaveBeenCalledWith('challengeResponse', 'challenge_response');
    expect(view.stopPolling).toHaveBeenCalled();
    expect(view.trigger).toHaveBeenCalledWith('save', view.model);
  });

  it('reports a localized error when attestation fails', async function() {
    const error = new Error('Device Trust API is unavailable.');
    spyOn(DeviceTrust, 'getAttestation').and.returnValue(Promise.reject(error));
    spyOn(Logger, 'error');

    await BaseOktaVerifyChallengeView.prototype.doChromeDTCJS.call(
      view, { challengeRequest: 'challenge_request' }
    );

    expect(Logger.error).toHaveBeenCalledWith(error);
    expect(view.model.trigger).toHaveBeenCalledWith('error', view.model, {
      responseJSON: {
        errorSummary: loc('oform.error.unexpected', 'login'),
      },
    });
  });

  it('reports an actionable error for an iframe deployment', async function() {
    const error = Object.assign(new Error('Unsupported frame.'), {
      code: 'UNSUPPORTED_FRAME',
    });
    spyOn(DeviceTrust, 'getAttestation').and.returnValue(Promise.reject(error));
    spyOn(Logger, 'error');

    await BaseOktaVerifyChallengeView.prototype.doChromeDTCJS.call(
      view, { challengeRequest: 'challenge_request' }
    );

    expect(Logger.error).toHaveBeenCalledWith(error);
    expect(view.model.trigger).toHaveBeenCalledWith('error', view.model, {
      responseJSON: {
        errorSummary: loc('deviceTrust.error.unsupportedFrame', 'login'),
      },
    });
  });

  it('ignores an attestation response after the view is removed', async function() {
    spyOn(DeviceTrust, 'getAttestation').and.returnValue(Promise.resolve('challenge_response'));
    view.removed = true;

    await BaseOktaVerifyChallengeView.prototype.doChromeDTCJS.call(
      view, { challengeRequest: 'challenge_request' }
    );

    expect(view.model.set).not.toHaveBeenCalled();
    expect(view.trigger).not.toHaveBeenCalled();
  });
});
