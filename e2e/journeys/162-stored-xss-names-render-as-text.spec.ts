import { test, expect, type Page } from '@playwright/test';
import { initDevBridge, resetState, waitForAppReady } from '../helpers/dev-bridge';

/**
 * Journey 162 — server-delivered names render as text, never as HTML.
 *
 * TMX renders tournament data that came from CFS, another client, a provider-key integrator or an
 * imported file. Any of those can carry markup. Before this journey, a tournament whose names held
 * `<img src=x onerror=…>` ran that script in the director's session from the tournaments table, the
 * page title, the participants and publishing tables, the event/draw dropdowns and the draw view.
 *
 * Every name field a mock record carries is overwritten with a payload tagged by field, and the
 * tournament notes (rich text, so sanitized rather than escaped) carry a handler of their own. Rating
 * scale names and a stored score string are seeded the same way. Each view is then visited and two
 * things are asserted: no payload element exists in the DOM (it was parsed as HTML) and no payload
 * handler ran. The field tag says which field leaked, and the view says where.
 */

async function seedHostileTournament(page: Page): Promise<{ t: string; e: string; d: string; s: string; v: string }> {
  return page.evaluate(async () => {
    const payload = (field: string) =>
      `<img src=x class="xss-${field}" onerror="globalThis.__xss=(globalThis.__xss||[]).concat('${field}')">`;
    const { tournamentRecord: record } = dev.factory.mocksEngine.generateTournamentRecord({
      nonRandom: 1,
      participantsProfile: { scaledParticipantsCount: 16 },
      drawProfiles: [{ drawSize: 8 }, { drawSize: 4, eventType: 'DOUBLES' }],
      venueProfiles: [{ courtsCount: 2 }],
      completeAllMatchUps: false,
    });
    const set = (field: string, prefix: string) => `${prefix} ${payload(field)}`;
    record.tournamentName = set('tournamentName', 'T');
    // Notes are rich text (HTML by design), so they are sanitized, not escaped: the img may stay,
    // but its handler must not run. No class here, so only execution counts as a leak.
    record.notes = `<p>Notes</p><img src=x onerror="globalThis.__xss=(globalThis.__xss||[]).concat('notes')">`;
    for (const event of record.events ?? []) {
      event.eventName = set('eventName', 'E');
      for (const draw of event.drawDefinitions ?? []) {
        draw.drawName = set('drawName', 'D');
        for (const structure of draw.structures ?? []) structure.structureName = set('structureName', 'S');
      }
    }
    for (const venue of record.venues ?? []) {
      venue.venueName = set('venueName', 'V');
      venue.venueAbbreviation = set('venueAbbreviation', 'VA');
      for (const court of venue.courts ?? []) court.courtName = set('courtName', 'C');
    }
    // Scale names are split on dots and upper-cased before they render, so their payload carries no
    // dots and no handler: only its presence in the DOM counts (matched case-insensitively below).
    // Two unknown scales and no WTN make the active-rating prompt open as the tournament loads.
    const scaleItems = ['a', 'b'].map((suffix) => ({
      itemType: `SCALE.RATING.SINGLES.<img src=x class=xss-scaleName-${suffix}>`,
      itemValue: 5,
      createdAt: new Date().toISOString(),
    }));
    for (const participant of record.participants ?? []) {
      participant.participantName = set('participantName', 'P');
      if (participant.person) {
        participant.person.standardGivenName = set('givenName', 'G');
        participant.person.standardFamilyName = set('familyName', 'F');
        participant.person.addresses = [{ city: set('city', 'City') }];
        participant.timeItems = [...scaleItems];
      }
    }
    // A stored score string is record data too; the matchUps table and lucky-loser rows print it.
    const scored = record.events[0].drawDefinitions[0].structures[0].matchUps.find(
      (m: any) => m.drawPositions?.filter(Boolean).length === 2,
    );
    if (scored) {
      scored.winningSide = 1;
      scored.matchUpStatus = 'COMPLETED';
      scored.score = { scoreStringSide1: set('scoreString', '6-1'), scoreStringSide2: set('scoreString', '1-6') };
    }
    dev.factory.tournamentEngine.setState(record);
    await dev.load(record);
    const event = record.events[0];
    const draw = event.drawDefinitions[0];
    return {
      t: record.tournamentId,
      e: event.eventId,
      d: draw.drawId,
      s: draw.structures[0].structureId,
      v: record.venues[0].venueId,
    };
  });
}

/** Payload elements present in the DOM, and handlers that ran, since the last call. */
async function leaks(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const selector = 'img[class^="xss-" i]';
    const parsed = [...document.querySelectorAll(selector)].map((el) => el.className.slice(4).toLowerCase());
    const ran: string[] = (globalThis as any).__xss ?? [];
    (globalThis as any).__xss = [];
    for (const el of document.querySelectorAll(selector)) el.remove();
    return [...new Set([...parsed, ...ran])].sort((a, b) => a.localeCompare(b));
  });
}

test.describe('Journey 162 — stored XSS: names render as text', () => {
  test('no view parses a server-delivered name as HTML', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await initDevBridge(page);
    await resetState(page);
    const ids = await seedHostileTournament(page);

    const routes: Record<string, string> = {
      tournaments: '#/tournaments',
      overview: `#/tournament/${ids.t}`,
      'participants (individuals)': `#/tournament/${ids.t}/participants/individuals`,
      'participants (pairs)': `#/tournament/${ids.t}/participants/pairs`,
      events: `#/tournament/${ids.t}/events`,
      event: `#/tournament/${ids.t}/event/${ids.e}`,
      draw: `#/tournament/${ids.t}/event/${ids.e}/draw/${ids.d}`,
      structure: `#/tournament/${ids.t}/event/${ids.e}/draw/${ids.d}/structure/${ids.s}`,
      'draw entries': `#/tournament/${ids.t}/event/${ids.e}/drawEntries/${ids.d}`,
      matchUps: `#/tournament/${ids.t}/matchUps`,
      schedule2: `#/tournament/${ids.t}/schedule2`,
      scheduling: `#/tournament/${ids.t}/scheduling`,
      venues: `#/tournament/${ids.t}/venues`,
      venue: `#/tournament/${ids.t}/venue/${ids.v}`,
      publishing: `#/tournament/${ids.t}/publishing`,
      'draw report': `#/tournament/${ids.t}/reports/structure.drawReport`,
    };

    const found: Record<string, string[]> = {};
    for (const [view, hash] of Object.entries(routes)) {
      await page.evaluate((h) => {
        globalThis.location.hash = h.slice(1);
      }, hash);
      await page.waitForTimeout(1500);
      const leaked = await leaks(page);
      if (leaked.length) found[view] = leaked;
    }

    expect(found, 'views that parsed a name as HTML (view: fields)').toEqual({});
  });
});
