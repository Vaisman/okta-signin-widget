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

import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';

import DeviceTrust from '../../../../util/DeviceTrust';
import Logger from '../../../../util/Logger';
import { useWidgetContext } from '../../contexts';
import { useOnSubmit } from '../../hooks';
import {
  DeviceTrustChallengeElement,
  MessageType,
  UISchemaElementComponent,
} from '../../types';
import { loc } from '../../util';
import ActionPending from '../ActionPending/ActionPending';

const DeviceTrustChallenge: UISchemaElementComponent<{
  uischema: DeviceTrustChallengeElement
}> = ({ uischema: { options } }) => {
  const { challengeRequest, content, step } = options;
  const { setMessage } = useWidgetContext();
  const onSubmitHandler = useOnSubmit();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // The browser request may outlive the component, so ignore late completion
    // after unmount.
    let active = true;

    setMessage(undefined);
    setFailed(false);
    DeviceTrust.getAttestation(challengeRequest)
      .then((challengeResponse) => {
        if (!active) {
          return;
        }
        onSubmitHandler({
          params: { challengeResponse },
          step,
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        Logger.error(error);
        const errorMessageKey = DeviceTrust.getErrorMessageKey(error);
        setFailed(true);
        setMessage({
          message: loc(errorMessageKey, 'login'),
          class: MessageType.ERROR,
          i18n: { key: errorMessageKey },
        });
      });

    return () => {
      active = false;
    };
  // The request should only restart when the challenge or its IDX step changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeRequest, step]);

  if (failed) {
    return null;
  }

  return (
    <ActionPending
      uischema={{
        type: 'ActionPending',
        options: { content },
      }}
    />
  );
};

export default DeviceTrustChallenge;
