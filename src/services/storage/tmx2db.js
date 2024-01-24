import Dexie from 'dexie';

export const tmx2db = (function () {
  const idb = {};

  idb.initDB = () => {
    return new Promise((resolve, reject) => {
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

  idb.resetDB = (callback) => {
    idb.dex.close();
    Dexie.delete('TMX').then(callback, () => alert('Failed to Reset Database'));
  };

  idb.findAll = (table) => {
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

  idb.findWhere = (tbl, attr, val) =>
    new Promise((resolve, reject) => idb.dex[tbl].where(attr).equals(val).toArray(resolve, reject).catch(reject));

  idb.deleteTournament = (tournamentId) => {
    return new Promise((resolve, reject) => {
      idb.dex.tournaments.where('tournamentId').equals(tournamentId).delete().then(resolve, reject);
    });
  };
  idb.deleteProvider = (key) => idb.dex.providers.where('providerId').equals(key).delete();

  // dangerous!
  idb.deleteAllTournamentAttr = (attr) =>
    idb.dex.tournaments
      .toCollection()
      .modify((tournament) => delete tournament[attr])
      .then(() => console.log('done'));

  idb.findUnique = (tbl, attr, val) =>
    new Promise((resolve, reject) => {
      idb.findWhere(tbl, attr, val).then((d) => resolve(d?.length ? d[0] : undefined), reject)
    });
  idb.findProvider = (providerId) => idb.findUnique('providers', 'providerId', providerId);
  idb.findIdiom = (ioc) => idb.findUnique('idioms', 'ioc', ioc);
  idb.findTournament = (tournamentId) => idb.findUnique('tournaments', 'tournamentId', tournamentId);
  idb.findProviderTournaments = (providerId) => idb.findWhere('tournaments', 'providerId', providerId);
  idb.addItem = (tbl, item) =>
    new Promise((resolve, reject) =>
      idb.dex[tbl]
        .put(item)
        .then(resolve, reject)
        .catch((err) => {
          alert('try again:', err);
          reject(err);
        })
    );

  idb.modifyOrAddUnique = (tbl, attr, val, item) =>
    new Promise((resolve, reject) => {
      idb.dex[tbl]
        .where(attr)
        .equals(val)
        .modify((data) => Object.assign(data, item))
        .then(
          (result) => {
            if (result) {
              return resolve('exists');
            } else {
              idb.addItem(tbl, item).then(resolve, reject);
            }
          },
          (err) => {
            console.log({err});
            reject(err);
          }
        );
    });

  idb.addIdiom = (idiom) => idb.modifyOrAddUnique('idioms', 'ioc', idiom.ioc, idiom);
  idb.addTournament = (tournamentRecord) => {
    return idb.modifyOrAddUnique('tournaments', 'tournamentId', tournamentRecord.tournamentId, tournamentRecord);
  };
  idb.addProvider = (provider) => idb.modifyOrAddUnique('providers', 'providerId', provider.providerId, provider);
  idb.modify = (tbl, attr, val, fx, params) =>
    new Promise((resolve, reject) => {
      idb.dex[tbl]
        .where(attr)
        .equals(val)
        .modify((item) => {
          Object.assign(params, { item });
          fx(params);
        })
        .then(resolve, (err) => {
          console.log('error:', err);
          reject();
        });
    });

  return idb;
})();
