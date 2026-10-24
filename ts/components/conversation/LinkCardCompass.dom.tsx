// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

// Tellomi (DESIGN.md §9): the compass at the end of a link card with nothing but its domain, our
// own drawing (the same paths as Android `ic_tellomi_compass_26.xml`): a ring and a two-tone
// needle, in the text colour. Decorative; the card's label carries the meaning.
export function LinkCardCompass(): JSX.Element {
  return (
    <svg
      className="module-message__link-preview__compass"
      width={26}
      height={26}
      viewBox="0 0 26 26"
      aria-hidden
      focusable={false}
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M13,1.5A11.5,11.5 0,1 1,13 24.5A11.5,11.5 0,1 1,13 1.5ZM13,3.1A9.9,9.9 0,1 0,13 22.9A9.9,9.9 0,1 0,13 3.1Z"
      />
      <path fill="currentColor" d="M18.6,7.4L14.4,14.4L11.6,11.6Z" />
      <path
        fill="currentColor"
        fillOpacity={0.45}
        d="M7.4,18.6L11.6,11.6L14.4,14.4Z"
      />
    </svg>
  );
}
