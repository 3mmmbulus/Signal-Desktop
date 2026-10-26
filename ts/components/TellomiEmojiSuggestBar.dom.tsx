// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import { TELLOMI_EMOJI_SUGGEST_BAR_HEIGHT_PX } from '../util/tellomiEmojiSuggestBar.std.ts';
import type { LocalizerType } from '../types/Util.std.ts';

export type TellomiEmojiSuggestBarProps = {
  i18n: LocalizerType;
  emoji: ReadonlyArray<string>;
  onSelect: (emoji: string) => void;
};

/**
 * Tellomi (desktop audit 3.4 / F22): horizontal emoji suggestion row above the
 * composer. Hidden when `emoji` is empty. Aligns with iOS/Android TellomiEmojiSuggestBar.
 */
export function TellomiEmojiSuggestBar({
  i18n,
  emoji,
  onSelect,
}: TellomiEmojiSuggestBarProps): ReactElement | null {
  if (emoji.length === 0) {
    return null;
  }

  return (
    <div
      className="TellomiEmojiSuggestBar"
      role="listbox"
      aria-label={i18n('icu:TellomiEmojiSuggest__accessibility_label')}
      style={{ height: TELLOMI_EMOJI_SUGGEST_BAR_HEIGHT_PX }}
    >
      <div className="TellomiEmojiSuggestBar__scroller">
        {emoji.map(item => (
          <button
            key={item}
            type="button"
            role="option"
            className="TellomiEmojiSuggestBar__item"
            aria-label={item}
            onClick={() => onSelect(item)}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
