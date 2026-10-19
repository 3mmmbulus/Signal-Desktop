// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

// pinned-messages.md 3.5 / 3.6, ADR-0081 P3 / P4: pins that were unpinned but have not taken effect yet — one pin (the ×
// on the bar, "Unpin" in a message's menu) or all of them ("Unpin all" in the list).
//
// - During the 5 seconds of "Undo" the bar no longer shows them, and they can still be brought back;
// - after that they are sent. From sending until the pin is really gone the bar still doesn't show them (so it doesn't
//   jump back and then vanish); when sending fails they go back on the bar;
// - once the pin is really gone they are forgotten, so a later pin of the same message shows again.
//
// Both Telegram apps delay the unpin like this (Android `BulletinFactory.createUnpinAllMessagesBulletin`, iOS
// `ChatController.performRequestedUnpinAllMessages`). The same rules as Android's and iOS's `TellomiHeldUnpins`.
// How long "Undo" is offered (both Telegram apps: 5 seconds).
export const TELLOMI_UNPIN_UNDO_MS = 5000;

export class TellomiHeldUnpins {
  // Not shown on the bar: those still waiting on "Undo", and those sent but not gone yet.
  #held: ReadonlySet<string> = new Set();
  #undoable: ReadonlySet<string> = new Set();

  get held(): ReadonlySet<string> {
    return this.#held;
  }

  hold(messageIds: Iterable<string>): void {
    const ids = [...messageIds];
    this.#held = new Set([...this.#held, ...ids]);
    this.#undoable = new Set([...this.#undoable, ...ids]);
  }

  // Undo: those that can still be undone go back on the bar; returns them.
  undo(messageIds: Iterable<string>): Set<string> {
    const back = new Set([...messageIds].filter(id => this.#undoable.has(id)));
    this.#undoable = difference(this.#undoable, back);
    this.#held = difference(this.#held, back);
    return back;
  }

  // The time for "Undo" is up: what wasn't undone is to be sent (and stays off the bar); returns it.
  commit(messageIds: Iterable<string>): Set<string> {
    const send = new Set([...messageIds].filter(id => this.#undoable.has(id)));
    this.#undoable = difference(this.#undoable, send);
    return send;
  }

  // The chat is closed: everything still waiting on "Undo" is sent.
  commitAll(): Set<string> {
    return this.commit(this.#undoable);
  }

  // Could not send: back on the bar.
  failed(messageIds: Iterable<string>): void {
    this.#held = difference(this.#held, new Set(messageIds));
  }

  // The pinned messages changed: what was sent and whose pin is really gone is forgotten.
  prune(pinnedMessageIds: ReadonlySet<string>): void {
    const kept = new Set(
      [...this.#held].filter(
        id => this.#undoable.has(id) || pinnedMessageIds.has(id)
      )
    );
    if (kept.size !== this.#held.size) {
      this.#held = kept;
    }
  }
}

function difference(
  from: ReadonlySet<string>,
  remove: ReadonlySet<string>
): ReadonlySet<string> {
  return new Set([...from].filter(id => !remove.has(id)));
}
