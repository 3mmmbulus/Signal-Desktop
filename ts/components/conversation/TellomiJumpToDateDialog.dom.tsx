// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useState, type JSX } from 'react';
import type { CalendarDate } from '@internationalized/date';
import {
  fromDateToLocal,
  getLocalTimeZone,
  toCalendarDate,
} from '@internationalized/date';

import type { LocalizerType } from '../../types/Util.std.ts';
import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import { DatePicker } from '../DatePicker.dom.tsx';
import { jumpLowerBoundMs } from '../../util/tellomiJumpToDate.std.ts';

export type PropsType = Readonly<{
  open: boolean;
  i18n: LocalizerType;
  initialTimestamp: number;
  onJump: (dayStartMs: number) => void;
  onClose: () => void;
}>;

/**
 * Tellomi (desktop audit 7.2): pick a day and jump to its first message.
 * Empty days are still selectable; jump lands on the first message on or after
 * that local midnight (same as iOS firstMessageOnOrAfter). Grey-out of empty
 * days is a follow-up.
 */
export function TellomiJumpToDateDialog({
  open,
  i18n,
  initialTimestamp,
  onJump,
  onClose,
}: PropsType): JSX.Element {
  const [date, setDate] = useState<CalendarDate | null>(() =>
    toCalendarDate(fromDateToLocal(new Date(initialTimestamp)))
  );

  const handleJump = useCallback(() => {
    if (date == null) {
      return;
    }
    const dayStart = jumpLowerBoundMs(
      date.toDate(getLocalTimeZone()).getTime()
    );
    onJump(dayStart);
  }, [date, onJump]);

  return (
    <AxoDialog.Root
      open={open}
      onOpenChange={isOpen => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <AxoDialog.Content
        size="sm"
        escape="cancel-is-noop"
        disableMissingAriaDescriptionWarning
      >
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:TellomiJumpToDateDialog__title')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <div className={tw('flex items-center gap-2')}>
            <DatePicker
              i18n={i18n}
              aria-label={i18n('icu:TellomiJumpToDateDialog__dateLabel')}
              value={date}
              onUpdateDate={setDate}
            />
          </div>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="strong-secondary" onClick={onClose}>
              {i18n('icu:cancel')}
            </AxoDialog.Action>
            <AxoDialog.Action
              variant="strong-primary"
              disabled={date == null}
              onClick={handleJump}
            >
              {i18n('icu:TellomiJumpToDateDialog__jump')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
