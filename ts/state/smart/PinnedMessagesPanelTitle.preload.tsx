// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { memo } from 'react';
import { useSelector } from 'react-redux';
import { getIntl } from '../selectors/user.std.ts';
import { useTellomiShownPins } from './tellomiPinnedList.preload.ts';

// pinned-messages.md 3.5: the title of the list of pins counts them: "7 pinned messages"
export const SmartPinnedMessagesPanelTitle = memo(
  function SmartPinnedMessagesPanelTitle() {
    const i18n = useSelector(getIntl);
    const pins = useTellomiShownPins();
    return (
      <div className="ConversationPanel__header__info">
        <div className="ConversationPanel__header__info__title">
          {i18n('icu:TellomiPinnedPanel__Title', { count: pins.length })}
        </div>
      </div>
    );
  }
);
