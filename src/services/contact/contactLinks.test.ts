/**
 * The call sheet's dial-string layer.
 *
 * These are the decisions that turn stored contact text into a tappable href, and every one of them
 * has a failure mode that is invisible on screen: a `tel:` link with no digits behind it looks live
 * and does nothing, and a `mailto:` that addresses fifteen people in `to:` discloses fifteen personal
 * addresses to fifteen people. Both are asserted in the negative direction as well as the positive.
 */
import {
  isPublicContact,
  reachableContacts,
  contactNumbers,
  looksLikeEmail,
  primaryNumber,
  mailtoHref,
  dialNumber,
  isReachable,
  smsHref,
  telHref,
} from './contactLinks';
import { describe, expect, it } from 'vitest';

const MOBILE = '+1 (555) 010-0100';
const LANDLINE = '555.0199';
const EMAIL = 'ana@example.org';
const MAILTO_EMAIL = `mailto:${EMAIL}`;

describe('dialNumber', () => {
  it('strips everything a dialler will not accept, keeping a leading +', () => {
    expect(dialNumber(MOBILE)).toEqual('+15550100100');
    expect(dialNumber(LANDLINE)).toEqual('5550199');
    expect(dialNumber('  +44 20 7946 0958 ')).toEqual('+442079460958');
  });

  it('never returns a + with no digits behind it', () => {
    // The failure this guards: `tel:+` renders as a live link and dials nothing.
    expect(dialNumber('+')).toBeUndefined();
    expect(dialNumber('   ')).toBeUndefined();
    expect(dialNumber('n/a')).toBeUndefined();
    expect(dialNumber('')).toBeUndefined();
    expect(dialNumber(undefined)).toBeUndefined();
  });

  it('does not invent a + that was not typed', () => {
    expect(dialNumber('5550100')).toEqual('5550100');
  });
});

describe('telHref', () => {
  it('builds a dialable href', () => {
    expect(telHref(MOBILE)).toEqual('tel:+15550100100');
  });

  it('returns undefined rather than a bare tel:', () => {
    expect(telHref('ext. 4')).toEqual('tel:4');
    expect(telHref('n/a')).toBeUndefined();
    expect(telHref(undefined)).toBeUndefined();
  });
});

describe('smsHref', () => {
  it('addresses several recipients with one comma-separated href', () => {
    expect(smsHref([MOBILE, '+1 555 010 0200'])).toEqual('sms:+15550100100,+15550100200');
  });

  it('de-duplicates by dial string, not by the text as typed', () => {
    // "+1 (555) 010-0100" and "+15550100100" are the same phone. Texting it twice is a bug the
    // director sees only in their sent messages.
    expect(smsHref([MOBILE, '+15550100100'])).toEqual('sms:+15550100100');
  });

  it('drops unusable entries instead of emitting an empty recipient', () => {
    expect(smsHref([MOBILE, undefined, '', 'no number'])).toEqual('sms:+15550100100');
  });

  it('returns undefined when nobody is reachable', () => {
    expect(smsHref([])).toBeUndefined();
    expect(smsHref([undefined, 'n/a'])).toBeUndefined();
  });

  it('carries no body parameter', () => {
    // Deliberate: iOS wants `&body=`, Android wants `?body=`, and one href cannot be both. Asserted
    // so a later "helpful" addition has to come with a platform branch and a test per platform.
    expect(smsHref([MOBILE])).not.toContain('body');
  });
});

describe('mailtoHref', () => {
  it('addresses a single recipient directly', () => {
    expect(mailtoHref([EMAIL])).toEqual(MAILTO_EMAIL);
  });

  it('BCCs several recipients so nobody learns the others addresses', () => {
    // The disclosure the director never chose to make. Asserted as an absence of `to=` as well as a
    // presence of `bcc=`, because a `to:` that also carried a bcc would still leak.
    const href = mailtoHref([EMAIL, 'raj@example.org']) as string;
    expect(href).toContain('bcc=');
    expect(href).toEqual(`mailto:?bcc=${EMAIL},raj@example.org`);
    expect(href).not.toContain('to=');
  });

  it('escapes a plus-addressed recipient in the query string', () => {
    // A bare `+` in a query string means SPACE. `ana+tmx@example.org` would arrive as
    // `ana tmx@example.org` and bounce.
    const href = mailtoHref(['ana+tmx@example.org', 'raj@example.org']) as string;
    expect(href).toContain('ana%2Btmx@example.org');
    expect(href).not.toContain('ana+tmx@example.org');
  });

  it('drops entries that are not addresses', () => {
    expect(mailtoHref(['not-an-address', EMAIL])).toEqual(MAILTO_EMAIL);
    expect(mailtoHref(['@example.org', 'ana@'])).toBeUndefined();
    expect(mailtoHref([])).toBeUndefined();
  });
});

describe('looksLikeEmail', () => {
  it('accepts an ordinary address and rejects the shapes a mailto cannot use', () => {
    expect(looksLikeEmail(EMAIL)).toBe(true);
    expect(looksLikeEmail('ana@')).toBe(false);
    expect(looksLikeEmail('@example.org')).toBe(false);
    expect(looksLikeEmail('ana example@org')).toBe(false);
    expect(looksLikeEmail(undefined)).toBe(false);
  });
});

describe('contact shape helpers', () => {
  it('puts the mobile first, because only a mobile can receive an SMS', () => {
    const contact = { telephone: LANDLINE, mobileTelephone: MOBILE };
    expect(contactNumbers(contact)).toEqual([MOBILE, LANDLINE]);
    expect(primaryNumber(contact)).toEqual(MOBILE);
  });

  it('falls back to the landline when there is no mobile', () => {
    expect(primaryNumber({ telephone: LANDLINE })).toEqual(LANDLINE);
  });

  it('treats a name-only contact as unreachable', () => {
    // A director cannot ring a name. This is the third state the participants table already
    // distinguishes: has no contact at all.
    expect(isReachable({ name: 'desk' })).toBe(false);
    expect(isReachable({ name: 'desk', mobileTelephone: MOBILE })).toBe(true);
    expect(isReachable({ emailAddress: EMAIL })).toBe(true);
    expect(isReachable(undefined)).toBe(false);
  });

  it('treats whitespace as absent', () => {
    expect(isReachable({ mobileTelephone: '   ', emailAddress: '  ' })).toBe(false);
  });

  it('requires isPublic === true, so absent and false both withhold', () => {
    // Nothing wrote this flag before factory #4680, so a truthy check reads every imported contact
    // as having consented to publication.
    expect(isPublicContact({ isPublic: true })).toBe(true);
    expect(isPublicContact({ isPublic: false })).toBe(false);
    expect(isPublicContact({})).toBe(false);
    expect(isPublicContact(undefined)).toBe(false);
  });

  it('filters a stored list down to the actionable entries, preserving order', () => {
    const contacts = [{ name: 'desk' }, { mobileTelephone: MOBILE }, { emailAddress: EMAIL }];
    expect(reachableContacts(contacts)).toEqual([contacts[1], contacts[2]]);
    expect(reachableContacts(undefined)).toEqual([]);
  });
});
