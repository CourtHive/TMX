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
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  };

  resetDB = (callback?: () => void): void => {
    this.dex.close();
    Dexie.delete('TMX').then(callback, (err: any) => {
      console.error('[IndexedDB] Failed to reset database:', err);
      tmxToast({ message: 'Failed to reset database', intent: 'is-danger' });
    });
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

  deleteTournament = (tournamentId: string): Promise<void> => {
    return this.dex['tournaments'].where('tournamentId').equals(tournamentId).delete().then(() => undefined);
  };

  deleteProvider = (key: string): Promise<any> => {
    return this.dex['providers'].where('providerId').equals(key).delete();
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
