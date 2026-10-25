// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX, ReactElement } from 'react';
import { useEffect, useState } from 'react';
import * as durations from '../../util/durations/index.std.ts';
import type { LocalizerType } from '../../types/Util.std.ts';
import { formatDate } from '../../util/formatTimestamp.dom.ts';
import { Time } from '../Time.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import { useTellomiJumpToDate } from './TellomiJumpToDateContext.dom.tsx';

export function TimelineDateHeader({
  i18n,
  timestamp,
  isSignalConversation,
}: Readonly<{
  i18n: LocalizerType;
  timestamp: number;
  isSignalConversation?: boolean;
}>): ReactElement {
  // Tellomi (desktop audit 7.2): inline date → open jump-to-date calendar.
  const jump = useTellomiJumpToDate();
  const pillClass = tw(
    'type-body-medium text-secondary',
    isSignalConversation
      ? 'rounded-3xl border border-secondary bg-(--axo-color-legacy-signal-conversation-bg) px-2.5 py-1 ' +
          'type-body-small font-medium dark:text-secondary-oncolor'
      : null
  );

  const content = <TimelineDate i18n={i18n} timestamp={timestamp} />;

  return (
    <div className={tw('flex justify-center p-5')}>
      {jump ? (
        <button
          type="button"
          className={pillClass}
          onClick={() => jump.onTapDateHeader(timestamp, false)}
          aria-label={i18n('icu:TellomiJumpToDateDialog__title')}
        >
          {content}
        </button>
      ) : (
        <div className={pillClass}>{content}</div>
      )}
    </div>
  );
}

export function TimelineDate({
  i18n,
  timestamp,
}: Readonly<{
  i18n: LocalizerType;
  timestamp: number;
}>): JSX.Element {
  const [text, setText] = useState(formatDate(i18n, timestamp));
  useEffect(() => {
    const update = () => setText(formatDate(i18n, timestamp));
    update();
    const interval = setInterval(update, durations.MINUTE);
    return () => {
      clearInterval(interval);
    };
  }, [i18n, timestamp]);

  return (
    <Time dateOnly timestamp={timestamp}>
      {text}
    </Time>
  );
}
