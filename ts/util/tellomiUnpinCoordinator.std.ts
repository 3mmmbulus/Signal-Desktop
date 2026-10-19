// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { TellomiHeldUnpins } from './tellomiHeldUnpins.std.ts';

export type TellomiUnpinItem = Readonly<{
  messageId: string;
  // A pin for me only: taking it back only touches my own devices.
  forMe: boolean;
}>;

export type TellomiUnpinCoordinatorDeps = Readonly<{
  // How long "Undo" is offered.
  undoMs: number;
  // Takes one pin back for real (queues the unpin, deletes the pin).
  send: (item: TellomiUnpinItem) => Promise<void>;
  // Offer "Undo" (the toast).
  onHeld: (messageIds: ReadonlyArray<string>) => void;
  // Some unpins could not be sent; they are back on the bar. Called once per batch.
  onFailed: (messageIds: ReadonlyArray<string>) => void;
  setTimeout: (callback: () => void, ms: number) => unknown;
}>;

// Ties `TellomiHeldUnpins` to a timer and to sending, and lets the bar subscribe to what is held. It outlives any one
// chat view: leaving the chat doesn't cancel an unpin that is waiting on "Undo" — it still goes out when the time is up.
export class TellomiUnpinCoordinator {
  readonly #deps: TellomiUnpinCoordinatorDeps;
  readonly #heldUnpins = new TellomiHeldUnpins();
  readonly #items = new Map<string, TellomiUnpinItem>();
  readonly #listeners = new Set<() => void>();
  #snapshot: ReadonlySet<string> = new Set();

  constructor(deps: TellomiUnpinCoordinatorDeps) {
    this.#deps = deps;
  }

  // For `useSyncExternalStore`: the same set until something changes.
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  getSnapshot = (): ReadonlySet<string> => this.#snapshot;

  // Unpin: gone from the bar now, "Undo" for a while, then sent.
  request(items: ReadonlyArray<TellomiUnpinItem>): void {
    const fresh = items.filter(item => !this.#items.has(item.messageId));
    if (fresh.length === 0) {
      return;
    }
    const ids = fresh.map(item => item.messageId);
    for (const item of fresh) {
      this.#items.set(item.messageId, item);
    }
    this.#heldUnpins.hold(ids);
    this.#changed();
    this.#deps.onHeld(ids);
    this.#deps.setTimeout(() => {
      void this.#send(this.#heldUnpins.commit(ids));
    }, this.#deps.undoMs);
  }

  undo(messageIds: Iterable<string>): void {
    const back = this.#heldUnpins.undo(messageIds);
    for (const id of back) {
      this.#items.delete(id);
    }
    if (back.size > 0) {
      this.#changed();
    }
  }

  // Everything still waiting on "Undo" goes out now (the app is closing).
  async flush(): Promise<void> {
    await this.#send(this.#heldUnpins.commitAll());
  }

  // Call when the pinned messages change.
  prune(pinnedMessageIds: ReadonlySet<string>): void {
    const before = this.#heldUnpins.held;
    this.#heldUnpins.prune(pinnedMessageIds);
    for (const id of [...this.#items.keys()]) {
      if (!this.#heldUnpins.held.has(id)) {
        this.#items.delete(id);
      }
    }
    if (before !== this.#heldUnpins.held) {
      this.#changed();
    }
  }

  async #send(ids: ReadonlySet<string>): Promise<void> {
    const failed: Array<string> = [];
    for (const id of ids) {
      const item = this.#items.get(id);
      if (item == null) {
        continue;
      }
      try {
        // oxlint-disable-next-line no-await-in-loop
        await this.#deps.send(item);
      } catch {
        failed.push(id);
      }
    }
    if (failed.length > 0) {
      this.#heldUnpins.failed(failed);
      for (const id of failed) {
        this.#items.delete(id);
      }
      this.#changed();
      this.#deps.onFailed(failed);
    }
  }

  #changed(): void {
    this.#snapshot = this.#heldUnpins.held;
    for (const listener of this.#listeners) {
      listener();
    }
  }
}
