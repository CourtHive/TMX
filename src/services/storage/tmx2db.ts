/**
 * IndexedDB database wrapper using Dexie.
 * Manages local storage for tournaments, providers, and language idioms.
 */
import Dexie from 'dexie';

interface TMXDatabase {
  dex: Dexie;
  initDB: () => Promise<void>;
  resetDB: (callback?: () => void) => void;
  findAll: (table: string) => Promise<any[]>;
  findAllTournaments: () => Promise<any[]>;
  findAllProviders: () => Promise<any[]>;
  findAllIdioms: () => Promise<any[]>;
  findWhere: (tbl: string, attr: string, val: any) => Promise<any[]>;
  deleteTournament: (tournamentId: string) => Promise<void>;
  deleteProvider: (key: string) => Promise<any>;
  deleteAllTournamentAttr: (attr: string) => Promise<void>;
  findUnique: (tbl: string, attr: string, val: any) => Promise<any>;
  findProvider: (providerId: string) => Promise<any>;
  findIdiom: (ioc: string) => Promise<any>;
  findTournament: (tournamentId: string) => Promise<any>;
  findProviderTournaments: (providerId: string) => Promise<any[]>;
  addItem: (tbl: string, item: any) => Promise<any>;
  modifyOrAddUnique: (tbl: string, attr: string, val: any, item: any) => Promise<string | any>;
  addIdiom: (idiom: any) => Promise<string | any>;
  addTournament: (tournamentRecord: any) => Promise<string | any>;
  addProvider: (provider: any) => Promise<string | any>;
  modify: (tbl: string, attr: string, val: any, fx: (params: any) => void, params: any) => Promise<any>;
}

export const tmx2db: TMXDatabase = (function () {
  const idb: any = {};

  idb.initDB = () => {
    return new Promise<void>((resolve, reject) => {
      try {
        idb.dex = new Dexie('TMX', { autoOpen: true });
        const tournaments = '&tournamentId, tournamentName, startDate, endDate';
        const providers = '&providerId, settings, calendar';
        const idioms = 'ioc';
        idb.dex.version(2).stores({ tournaments, providers, idioms });
        resolve();
      } catch (err) {
        return reject(err);
      }
    });
  };

  idb.resetDB = (callback?: () => void) => {
    idb.dex.close();
    Dexie.delete('TMX').then(callback, () => alert('Failed to Reset Database'));
  };

  idb.findAll = (table: string) => {
    return new Promise((resolve, reject) => {
      const targetTable = idb.dex[table];
      if (targetTable) {
        return targetTable.toArray(resolve, reject).catch(reject);
      } else {
        return resolve([]);
      }
    });
  };
  idb.findAllTournaments = () => idb.findAll('tournaments');
  idb.findAllProviders = () => idb.findAll('providers');
  idb.findAllIdioms = () => idb.findAll('idioms');

  idb.findWhere = (tbl: string, attr: string, val: any) =>
    new Promise((resolve, reject) => idb.dex[tbl].where(attr).equals(val).toArray(resolve, reject).catch(reject));

  idb.deleteTournament = (tournamentId: string) => {
    return new Promise((resolve, reject) => {
      idb.dex.tournaments.where('tournamentId').equals(tournamentId).delete().then(resolve, reject);
    });
  };
  idb.deleteProvider = (key: string) => idb.dex.providers.where('providerId').equals(key).delete();

  idb.deleteAllTournamentAttr = (attr: string) =>
    idb.dex.tournaments
      .toCollection()
      .modify((tournament: any) => delete tournament[attr])
      .then(() => console.log('done'));

  idb.findUnique = (tbl: string, attr: string, val: any) =>
    new Promise((resolve, reject) => {
      idb.findWhere(tbl, attr, val).then((d: any[]) => resolve(d?.length ? d[0] : undefined), reject);
    });
  idb.findProvider = (providerId: string) => idb.findUnique('providers', 'providerId', providerId);
  idb.findIdiom = (ioc: string) => idb.findUnique('idioms', 'ioc', ioc);
  idb.findTournament = (tournamentId: string) => idb.findUnique('tournaments', 'tournamentId', tournamentId);
  idb.findProviderTournaments = (providerId: string) => idb.findWhere('tournaments', 'providerId', providerId);
  idb.addItem = (tbl: string, item: any) =>
    new Promise((resolve, reject) =>
      idb.dex[tbl]
        .put(item)
        .then(resolve, reject)
        .catch((err: any) => {
          alert('try again:' + err);
          reject(err);
        }),
    );

  idb.modifyOrAddUnique = (tbl: string, attr: string, val: any, item: any) =>
    new Promise((resolve, reject) => {
      idb.dex[tbl]
        .where(attr)
        .equals(val)
        .modify((data: any) => Object.assign(data, item))
        .then(
          (result: any) => {
            if (result) {
              return resolve('exists');
            } else {
              idb.addItem(tbl, item).then(resolve, reject);
            }
          },
          (err: any) => {
            console.log({ err });
            reject(err);
          },
        );
    });

  idb.addIdiom = (idiom: any) => idb.modifyOrAddUnique('idioms', 'ioc', idiom.ioc, idiom);
  idb.addTournament = (tournamentRecord: any) => {
    return idb.modifyOrAddUnique('tournaments', 'tournamentId', tournamentRecord.tournamentId, tournamentRecord);
  };
  idb.addProvider = (provider: any) => idb.modifyOrAddUnique('providers', 'providerId', provider.providerId, provider);
  idb.modify = (tbl: string, attr: string, val: any, fx: (params: any) => void, params: any) =>
    new Promise((resolve, reject) => {
      idb.dex[tbl]
        .where(attr)
        .equals(val)
        .modify((item: any) => {
          Object.assign(params, { item });
          fx(params);
        })
        .then(resolve, (err: any) => {
          console.log('error:', err);
          reject();
        });
    });

  return idb;
})();
