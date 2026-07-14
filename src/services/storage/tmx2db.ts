/**
 * IndexedDB database wrapper using Dexie.
 * Manages local storage for tournaments, providers, and language idioms.
 *
 * All methods are arrow properties so `this` is bound even when methods
 * are passed as bare references (e.g. `catchAsync(tmx2db.initDB)`).
 */
import { tmxToast } from 'services/notifications/tmxToast';
import Dexie from 'dexie';

export class TMXDatabase {
  dex: any;

  initDB = (): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      try {
        this.dex = new Dexie('TMX', { autoOpen: true });
        const tournaments = '&tournamentId, tournamentName, startDate, endDate';
        const providers = '&providerId, settings, calendar';
        const idioms = 'ioc';
        const policies = '&id, policyType, source';
        const namedSource = '&id, name, source';
        const topologies = namedSource;
        const tieFormats = namedSource;
        this.dex.version(2).stores({ tournaments, providers, idioms });
        this.dex.version(3).stores({ tournaments, providers, idioms, policies });
        this.dex.version(4).stores({ tournaments, providers, idioms, policies, topologies });
        this.dex.version(5).stores({ tournaments, providers, idioms, policies, topologies, tieFormats });
        const compositions = namedSource;
        this.dex.version(6).stores({ tournaments, providers, idioms, policies, topologies, tieFormats, compositions });
        const pdfFonts = '&fontId, cachedAt';
        this.dex
          .version(7)
          .stores({ tournaments, providers, idioms, policies, topologies, tieFormats, compositions, pdfFonts });
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  };

  resetDB = (callback?: () => void): Promise<void> => {
    this.dex.close();
    return Dexie.delete('TMX').then(
      () => {
        // Re-init so subsequent writes don't hit a closed/deleted Dexie
        // instance. Without this the next `addTournament` throws
        // DatabaseClosedError, which (in `localSave`) prevents
        // `mutationRequest`'s `completion()` from firing — UI callbacks
        // that depend on the post-mutation result then never run.
        return this.initDB().then(callback);
      },
      (err: any) => {
        console.error('[IndexedDB] Failed to reset database:', err);
        tmxToast({ message: 'Failed to reset database', intent: 'is-danger' });
      },
    );
  };

  findAll = (table: string): Promise<any[]> => {
    const targetTable = this.dex[table];
    if (targetTable) {
      return targetTable.toArray();
    }
    return Promise.resolve([]);
  };

  findAllTournaments = (): Promise<any[]> => this.findAll('tournaments');
  findAllProviders = (): Promise<any[]> => this.findAll('providers');
  findAllIdioms = (): Promise<any[]> => this.findAll('idioms');

  findWhere = (tbl: string, attr: string, val: any): Promise<any[]> => {
    return this.dex[tbl].where(attr).equals(val).toArray();
  };

  deleteTournament = async (tournamentId: string): Promise<void> => {
    await this.dex['tournaments'].where('tournamentId').equals(tournamentId).delete();
    // Also drop the lightweight calendar mirror. Since the tournaments list renders from
    // calendar entries (not full records), leaving the entry behind lets a deleted tournament
    // linger in the list and be reopened into a record-less, broken view. Scrub it from every
    // provider bucket (we don't know which one held it once the record is gone).
    await this.dex['providers'].toCollection().modify((provider: any) => {
      if (Array.isArray(provider?.calendar)) {
        provider.calendar = provider.calendar.filter((entry: any) => entry?.tournamentId !== tournamentId);
      }
    });
  };

  // Selective clear used on logout and login transitions: keep demo /
  // scratchpad tournaments (no parentOrganisation) so a logged-out user
  // can persist a sandbox draw without losing it on the next login.
  // Provider-bound tournaments are wiped so user A's cached records can't
  // surface to user B on a shared browser via the local-DB fallback.
  // See Mentat/planning/USER_TOURNAMENT_ACCESS_MODEL.md PR 11.
  deleteProviderBoundTournaments = (): Promise<number> => {
    return this.dex['tournaments'].filter(isProviderBoundTournament).delete();
  };

  deleteProvider = (key: string): Promise<any> => {
    return this.dex['providers'].where('providerId').equals(key).delete();
  };

  // Empty every provider's local calendar. Paired with deleteProviderBoundTournaments
  // on logout/login: the calendar entries are the lightweight mirror of
  // provider-bound tournaments and must not leak across users on a shared browser.
  // The surviving (demo) tournaments are re-derived lazily on the next list read.
  clearAllProviderCalendars = (): Promise<number> => {
    return this.dex['providers'].toCollection().modify((provider: any) => {
      provider.calendar = [];
    });
  };

  deleteAllTournamentAttr = (attr: string): Promise<void> => {
    return this.dex['tournaments']
      .toCollection()
      .modify((tournament: any) => delete tournament[attr])
      .then(() => undefined);
  };

  findUnique = async (tbl: string, attr: string, val: any): Promise<any> => {
    const results = await this.findWhere(tbl, attr, val);
    return results?.length ? results[0] : undefined;
  };

  findProvider = (providerId: string): Promise<any> => this.findUnique('providers', 'providerId', providerId);
  findIdiom = (ioc: string): Promise<any> => this.findUnique('idioms', 'ioc', ioc);
  findTournament = (tournamentId: string): Promise<any> => this.findUnique('tournaments', 'tournamentId', tournamentId);
  findProviderTournaments = (providerId: string): Promise<any[]> => this.findWhere('tournaments', 'providerId', providerId);

  addItem = async (tbl: string, item: any): Promise<any> => {
    try {
      return await this.dex[tbl].put(item);
    } catch (err) {
      console.error('[IndexedDB] put failed:', err);
      tmxToast({ message: 'Database write failed', intent: 'is-danger' });
      throw err;
    }
  };

  modifyOrAddUnique = async (tbl: string, attr: string, val: any, item: any): Promise<string | any> => {
    try {
      const result = await this.dex[tbl]
        .where(attr)
        .equals(val)
        .modify((data: any) => Object.assign(data, item));
      if (result) return 'exists';
      return this.addItem(tbl, item);
    } catch (err) {
      console.error('[IndexedDB] modifyOrAddUnique failed:', err);
      throw err;
    }
  };

  addIdiom = (idiom: any): Promise<string | any> => this.modifyOrAddUnique('idioms', 'ioc', idiom.ioc, idiom);
  addTournament = (tournamentRecord: any): Promise<string | any> => {
    return this.modifyOrAddUnique('tournaments', 'tournamentId', tournamentRecord.tournamentId, tournamentRecord);
  };
  addProvider = (provider: any): Promise<string | any> => {
    return this.modifyOrAddUnique('providers', 'providerId', provider.providerId, provider);
  };

  // Upsert a single lightweight calendar entry into a provider's local calendar
  // (replace by tournamentId, else append). This is the local mirror of the
  // server's addToOrUpdateCalendar side-effect: it lets the tournaments list
  // render from calendar entries instead of loading every full record.
  upsertCalendarEntry = async (providerId: string, entry: any): Promise<void> => {
    const provider = await this.findProvider(providerId);
    const calendar = Array.isArray(provider?.calendar) ? provider.calendar.slice() : [];
    const index = calendar.findIndex((existing: any) => existing?.tournamentId === entry?.tournamentId);
    if (index >= 0) calendar[index] = entry;
    else calendar.push(entry);
    await this.addProvider({ providerId, calendar });
  };

  modify = async (tbl: string, attr: string, val: any, fx: (params: any) => void, params: any): Promise<any> => {
    try {
      return await this.dex[tbl]
        .where(attr)
        .equals(val)
        .modify((item: any) => {
          Object.assign(params, { item });
          fx(params);
        });
    } catch (err) {
      console.error('[IndexedDB] modify failed:', err);
      throw err;
    }
  };
}

export const tmx2db = new TMXDatabase();

// Predicate for the logout / login-as-different-user IDB clear. Exported
// for unit-test access without standing up a fake-indexeddb harness.
export function isProviderBoundTournament(tournamentRecord: any): boolean {
  return Boolean(tournamentRecord?.parentOrganisation?.organisationId);
}
